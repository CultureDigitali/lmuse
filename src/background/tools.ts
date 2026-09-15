import { tool } from 'ai';
import { z } from 'zod';
import { ToolBudget } from '../shared/budget';
import { mapProviderError } from '../shared/errors';
import { isAllowedHost, isBlockedUrl, normalizeNavigationTarget } from '../shared/urlGuard';
import { MAX_SNAPSHOT_CHARS } from '../shared/settings';

// ---------------------------------------------------------------------------
// Strato di accesso al browser: i tool dell'agente parlano con il content
// script (snapshot DOM + azioni) e con le chrome.* API per tab e screenshot.
// Ogni execute passa da `guarded`: budget tool-call per run + errori mappati
// in italiano. Timeout di 10s sulle risposte del content script. (S12-S13,
// R46, R48)
// ---------------------------------------------------------------------------

export interface BrowserToolConfig {
  maskPii: boolean;
  hidePasswords: boolean;
  sendScreenshots: boolean;
  allowedDomains: string;
  budgetMax: number;
}

export interface SnapshotResult {
  ok: boolean;
  tree?: string;
  error?: string;
}

/** Ultimo screenshot catturato (PNG base64, senza prefisso data:). */
let lastScreenshot: string | null = null;

const TAB_REPLY_TIMEOUT_MS = 10_000;

function truncate(text: string, max = MAX_SNAPSHOT_CHARS): string {
  return text.length > max ? `${text.slice(0, max)}\n…[troncato]` : text;
}

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (!tab?.id) throw new Error('Nessun tab attivo trovato.');
  return tab;
}

/** Invia al content script con timeout; distingue "non raggiungibile" da errore della pagina. */
async function sendToTab<T>(tabId: number, message: unknown): Promise<T> {
  try {
    const result = await Promise.race([
      chrome.tabs.sendMessage(tabId, message),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout risposta content script (10s).')), TAB_REPLY_TIMEOUT_MS),
      ),
    ]);
    return result as T;
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    if (raw.includes('Timeout risposta')) throw new Error(raw, { cause: error });
    throw new Error(
      'Content script non raggiungibile in questo tab. Cause possibili: pagina chrome:// o Web Store (lmuse non opera lì), tab ricaricato da poco, o estensione da ricaricare.',
      { cause: error },
    );
  }
}

function waitForTabComplete(tabId: number, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      void chrome.tabs
        .get(tabId)
        .then(
          (tab) => tab.status === 'complete',
          () => true,
        )
        .then((done) => {
          if (done || Date.now() - started > timeoutMs) {
            clearInterval(timer);
            resolve();
          }
        });
    }, 300);
  });
}

/** Snapshot del tab; usato anche per "rescuare" ref scaduti. */
async function snapshotTab(tabId: number, maskPii: boolean): Promise<string> {
  const tab = await chrome.tabs.get(tabId);
  const res = await sendToTab<SnapshotResult>(tabId, { kind: 'LMUSE_SNAPSHOT', maskPii });
  if (!res.ok || !res.tree) throw new Error(res.error ?? 'Snapshot fallito.');
  return truncate(`URL: ${tab.url}\nTitolo: ${tab.title}\n${res.tree}`);
}

/**
 * Quando un ref è scaduto non lanciamo un errore secco: restituiamo il motivo
 * + un nuovo snapshot così l'agente può riprovare subito. (R48)
 */
async function refRescue(
  tabId: number,
  ref: number,
  maskPii: boolean,
  reason: string,
): Promise<{ observation: string }> {
  try {
    const fresh = await snapshotTab(tabId, maskPii);
    return {
      observation: `${reason} Ref [${ref}] non esiste più. Ecco un nuovo snapshot; riprova con un ref attuale:\n\n${fresh}`,
    };
  } catch {
    throw new Error(reason);
  }
}

const BUDGET_EXHAUSTED = 'Budget tool esaurito: chiudi il task o aumenta i passi massimi nelle impostazioni.';

export function createBrowserTools(cfg: BrowserToolConfig) {
  const budget = new ToolBudget(cfg.budgetMax);

  /** Guardia centrale: budget + mappatura errori in italiano. */
  async function guarded<O>(fn: () => Promise<O>): Promise<O> {
    if (!budget.tryConsume()) throw new Error(`${BUDGET_EXHAUSTED} (${budget.max} chiamate per run).`);
    try {
      return await fn();
    } catch (error) {
      throw new Error(mapProviderError(error), { cause: error });
    }
  }

  const tools = {
    browser_snapshot: tool({
      description:
        'Fotografa la pagina del tab attivo: restituisce URL, titolo e albero degli elementi interattivi con ref numerici [n]. Chiamalo per primo e dopo ogni azione che cambia la pagina.',
      inputSchema: z.object({}),
      execute: async () =>
        guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          return { observation: await snapshotTab(tab.id, cfg.maskPii) };
        }),
    }),

    browser_navigate: tool({
      description: 'Naviga il tab attivo a un URL e restituisce il nuovo snapshot della pagina.',
      inputSchema: z.object({ url: z.string().describe('URL completo, es. https://example.com') }),
      execute: async ({ url }: { url: string }) =>
        guarded(async () => {
          const target = normalizeNavigationTarget(url);
          if (!target || isBlockedUrl(target)) {
            throw new Error('URL bloccato: lmuse non naviga pagine chrome://, interne o del Web Store.');
          }
          if (!isAllowedHost(target, cfg.allowedDomains)) {
            throw new Error(
              `Dominio fuori dall'allowlist utente (${cfg.allowedDomains}). Chiedi all'utente di aggiornare "Domini consentiti".`,
            );
          }
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          await chrome.tabs.update(tab.id, { url: target });
          await waitForTabComplete(tab.id);
          await new Promise((r) => setTimeout(r, 800));
          try {
            return { observation: await snapshotTab(tab.id, cfg.maskPii) };
          } catch {
            return {
              observation: `Navigato a ${target}, ma il content script non è raggiungibile in questa pagina.`,
            };
          }
        }),
    }),

    browser_back: tool({
      description: 'Torna alla pagina precedente nel tab attivo e restituisce il nuovo snapshot.',
      inputSchema: z.object({}),
      execute: async () =>
        guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          await chrome.tabs.goBack(tab.id);
          await waitForTabComplete(tab.id);
          return { observation: await snapshotTab(tab.id, cfg.maskPii) };
        }),
    }),

    browser_click: tool({
      description: 'Clicca un elemento usando il suo ref numerico [n] dello snapshot più recente.',
      inputSchema: z.object({ ref: z.number().int().describe('Ref numerico dallo snapshot, es. 12') }),
      execute: async ({ ref }: { ref: number }) =>
        guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          const res = await sendToTab<SnapshotResult>(tab.id, { kind: 'LMUSE_CLICK', ref });
          if (!res.ok) {
            if (res.error?.includes('scaduto')) {
              return refRescue(tab.id, ref, cfg.maskPii, 'Click non riuscito.');
            }
            throw new Error(res.error ?? 'Click fallito.');
          }
          return {
            observation: `Click su [${ref}] eseguito. Fai un nuovo snapshot per vedere il risultato.`,
          };
        }),
    }),

    browser_type: tool({
      description:
        'Scrive testo in un campo input/textarea (ref dallo snapshot). Opzionalmente invia il form.',
      inputSchema: z.object({
        ref: z.number().int().describe('Ref numerico del campo dallo snapshot'),
        text: z.string().describe('Testo da digitare (sostituisce il contenuto)'),
        submit: z.boolean().optional().describe('Se true, preme Invio / invia il form dopo la digitazione'),
      }),
      execute: async ({ ref, text, submit }: { ref: number; text: string; submit?: boolean }) =>
        guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          const res = await sendToTab<SnapshotResult>(tab.id, {
            kind: 'LMUSE_TYPE',
            ref,
            text,
            submit: submit ?? false,
            allowPassword: !cfg.hidePasswords,
          });
          if (!res.ok) {
            if (res.error?.includes('scaduto')) {
              return refRescue(tab.id, ref, cfg.maskPii, 'Digitazione non riuscita.');
            }
            throw new Error(res.error ?? 'Digitazione fallita.');
          }
          return {
            observation: `Testo inserito in [${ref}]. Fai un nuovo snapshot per vedere il risultato.`,
          };
        }),
    }),

    browser_scroll: tool({
      description: 'Scorre la pagina o un elemento scrollabile.',
      inputSchema: z.object({
        direction: z.enum(['up', 'down', 'top', 'bottom']).describe('Direzione dello scroll'),
        ref: z
          .number()
          .int()
          .optional()
          .describe('Ref di un elemento scrollabile (se omesso, scorre la pagina)'),
      }),
      execute: async ({ direction, ref }: { direction: 'up' | 'down' | 'top' | 'bottom'; ref?: number }) =>
        guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          const res = await sendToTab<SnapshotResult>(tab.id, { kind: 'LMUSE_SCROLL', direction, ref });
          if (!res.ok) {
            if (res.error?.includes('scaduto')) {
              return refRescue(tab.id, ref ?? 0, cfg.maskPii, 'Scroll non riuscito.');
            }
            throw new Error(res.error ?? 'Scroll fallito.');
          }
          return { observation: 'Scroll eseguito. Fai un nuovo snapshot per vedere i nuovi elementi.' };
        }),
    }),

    browser_screenshot: tool({
      description:
        'Cattura uno screenshot del tab visibile. Lo VEDI come immagine: usalo quando lo snapshot testuale non basta (layout, verifica grafica).',
      inputSchema: z.object({}),
      execute: async () =>
        guarded(async () => {
          if (!cfg.sendScreenshots) {
            throw new Error('Screenshot disattivato dalla privacy di lmuse (impostazioni ⚙).');
          }
          const win = await chrome.windows.getLastFocused();
          if (win.id == null) throw new Error('Finestra non trovata.');
          const dataUrl = (await chrome.tabs.captureVisibleTab(win.id, { format: 'png' })) as string;
          lastScreenshot = dataUrl.replace(/^data:image\/png;base64,/, '');
          return { captured: true };
        }),
      toModelOutput: (options: { output: unknown }) => {
        const output = options.output as { captured?: boolean } | null;
        const shot = output?.captured === true ? lastScreenshot : null;
        if (!shot) return { type: 'text', value: 'Screenshot non riuscito.' };
        return {
          type: 'content',
          value: [
            { type: 'text', text: 'Ecco lo screenshot della pagina visibile:' },
            { type: 'file', mediaType: 'image/png', data: { type: 'data', data: shot } },
          ],
        };
      },
    }),

    browser_tabs_list: tool({
      description: 'Elenca i tab aperti (id, titolo, URL) per scegliere su quale lavorare.',
      inputSchema: z.object({}),
      execute: async () =>
        guarded(async () => {
          const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
          const lines = tabs.map((t) => `#${t.id} "${(t.title ?? '').slice(0, 60)}" ${t.url}`);
          return { observation: truncate(lines.join('\n') || 'Nessun tab.', 2000) };
        }),
    }),

    browser_tab_focus: tool({
      description: 'Porta in primo piano un tab dato il suo id (vedi browser_tabs_list).',
      inputSchema: z.object({ tabId: z.number().int().describe('Id numerico del tab') }),
      execute: async ({ tabId }: { tabId: number }) =>
        guarded(async () => {
          await chrome.tabs.update(tabId, { active: true });
          const tab = await chrome.tabs.get(tabId);
          await waitForTabComplete(tabId, 5_000);
          try {
            return { observation: await snapshotTab(tabId, cfg.maskPii) };
          } catch {
            return { observation: `Focus sul tab "${tab.title}". Content script non raggiungibile qui.` };
          }
        }),
    }),
  };

  return { tools, budget };
}
