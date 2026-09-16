import { tool } from 'ai';
import { z } from 'zod';
import { ToolBudget } from '../shared/budget';
import { mapProviderError, mapTabError } from '../shared/errors';
import { isAllowedHost, isBlockedUrl, normalizeNavigationTarget } from '../shared/urlGuard';
import { MAX_SNAPSHOT_CHARS } from '../shared/settings';
import { extractDomain, shouldApprove, type ApprovalContext, type ApprovalPolicy } from '../shared/approval';
import { formatSnapshotHeader } from '../shared/header';
import { maskPii, maskUrlTokens } from '../shared/pii';

// ---------------------------------------------------------------------------
// Strato di accesso al browser: i tool dell'agente parlano con il content
// script (iniettato on-demand, solo quando serve) e con le chrome.* API.
// Ogni execute: approval umana se la policy lo richiede, poi guardia centrale
// (budget tool-call per run + errori mappati in italiano). Dopo ogni azione
// riuscita allega il nuovo snapshot. Timeout 10s sul content script.
// (S12-S13, S102-S110, R46, R48, R146)
// ---------------------------------------------------------------------------

export interface BrowserToolConfig {
  maskPii: boolean;
  hidePasswords: boolean;
  hostOnly: boolean;
  sendScreenshots: boolean;
  allowedDomains: string;
  budgetMax: number;
  policy: ApprovalPolicy;
  signal: AbortSignal;
  /** Il worker chiede al panel; true = approvato. Rifiuta su STOP. */
  requestApproval: (tool: string, description: string) => Promise<boolean>;
  onApprovalDecision?: (tool: string, approved: boolean, reason: string) => void;
}

export interface SnapshotResult {
  ok: boolean;
  tree?: string;
  error?: string;
  valueLength?: number;
  scrollPercent?: number;
}

/** Ultimo screenshot catturato (PNG base64, senza prefisso data:). */
let lastScreenshot: string | null = null;

const TAB_REPLY_TIMEOUT_MS = 10_000;
const UNREACHABLE_PREFIX = 'Content script non raggiungibile';

function truncate(text: string, max = MAX_SNAPSHOT_CHARS): string {
  return text.length > max ? `${text.slice(0, max)}\n…[troncato]` : text;
}

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (!tab?.id) throw new Error('Nessun tab attivo trovato.');
  return tab;
}

/**
 * Iniezione on-demand (S102): niente content script statico nel manifest.
 * Solo file locali via `files:` (mai `func:` con stringhe) e solo su
 * http/https — altrove chrome.scripting rigetta e mappiamo in chiaro.
 */
async function injectContentScript(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  } catch (error) {
    throw new Error(
      `${UNREACHABLE_PREFIX} in questo tab. Cause possibili: pagina chrome:// o Web Store (lmuse non opera lì), tab ricaricato da poco, o estensione da ricaricare.`,
      { cause: error },
    );
  }
}

/** Invia al content script con timeout; distingue "non raggiungibile" da errore della pagina. */
async function rawSendToTab<T>(tabId: number, message: unknown): Promise<T> {
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
      `${UNREACHABLE_PREFIX} in questo tab. Cause possibili: pagina chrome:// o Web Store (lmuse non opera lì), tab ricaricato da poco, o estensione da ricaricare.`,
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

export interface SnapshotOpts {
  maskPii: boolean;
  hostOnly: boolean;
}

/** Snapshot del tab; usato anche per "rescuare" ref scaduti. */
async function snapshotTab(
  tabId: number,
  opts: SnapshotOpts,
  send: <T>(tabId: number, message: unknown) => Promise<T>,
): Promise<string> {
  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (error) {
    throw new Error(mapTabError(error), { cause: error });
  }
  const res = await send<SnapshotResult>(tabId, { kind: 'LMUSE_SNAPSHOT', maskPii: opts.maskPii });
  if (!res.ok || !res.tree) throw new Error(res.error ?? 'Snapshot fallito.');
  let out = formatSnapshotHeader(tab.url, tab.title, res.tree, {
    maskPiiEnabled: opts.maskPii,
    hostOnly: opts.hostOnly,
  });
  if (res.tree.includes('(nessuno)')) {
    out +=
      '\nSuggerimento: nessun elemento interattivo rilevato (pagina grafica/Canvas?). Prova browser_screenshot.';
  }
  return truncate(out);
}

/**
 * Quando un ref è scaduto non lanciamo un errore secco: restituiamo il motivo
 * + un nuovo snapshot così l'agente può riprovare subito. (R48)
 */
async function refRescue(
  tabId: number,
  ref: number,
  opts: SnapshotOpts,
  reason: string,
  send: <T>(tabId: number, message: unknown) => Promise<T>,
): Promise<{ observation: string }> {
  try {
    const fresh = await snapshotTab(tabId, opts, send);
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
  const seenDomains: string[] = [];
  const snapOpts: SnapshotOpts = { maskPii: cfg.maskPii, hostOnly: cfg.hostOnly };

  function trackDomain(url: string | undefined): void {
    const domain = url ? extractDomain(url) : null;
    if (domain && !seenDomains.includes(domain)) seenDomains.push(domain);
  }

  /** Invia al tab iniettando on-demand al primo uso + un retry dopo navigazioni. */
  async function sendToTab<T>(tabId: number, message: unknown): Promise<T> {
    try {
      return await rawSendToTab<T>(tabId, message);
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      if (!raw.startsWith(UNREACHABLE_PREFIX)) throw error;
      await injectContentScript(tabId);
      return rawSendToTab<T>(tabId, message);
    }
  }

  /** Guardia centrale: budget + mappatura errori in italiano. */
  async function guarded<O>(fn: () => Promise<O>): Promise<O> {
    if (!budget.tryConsume()) throw new Error(`${BUDGET_EXHAUSTED} (${budget.max} chiamate per run).`);
    try {
      return await fn();
    } catch (error) {
      throw new Error(mapProviderError(error), { cause: error });
    }
  }

  /** Approval umana prima dell'azione; niente consumo budget se negata. */
  async function approved(toolName: string, args: unknown, description: string): Promise<void> {
    const ctx: ApprovalContext = { seenDomains: [...seenDomains] };
    const { needed, reason } = shouldApprove(toolName, args, cfg.policy, ctx);
    if (!needed) return;
    const full = reason ? `${description} — ${reason}` : description;
    let ok: boolean;
    try {
      ok = await cfg.requestApproval(toolName, full);
    } catch (error) {
      if (cfg.signal.aborted) throw new Error('Task fermato durante la conferma.', { cause: error });
      throw new Error(mapProviderError(error), { cause: error });
    }
    cfg.onApprovalDecision?.(toolName, ok, reason);
    if (!ok) {
      throw new Error(
        `Azione non approvata (${description}). Spiega all'utente come procedere o cambia strategia.`,
      );
    }
  }

  /** Dopo un'azione riuscita allega il nuovo snapshot (niente roundtrip). */
  async function acted(tabId: number, message: string): Promise<{ observation: string }> {
    try {
      const fresh = await snapshotTab(tabId, snapOpts, sendToTab);
      return { observation: `${message}\n\nNuovo snapshot:\n${fresh}` };
    } catch {
      return { observation: `${message} Fai un nuovo snapshot per vedere il risultato.` };
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
          return { observation: await snapshotTab(tab.id, snapOpts, sendToTab) };
        }),
    }),

    browser_navigate: tool({
      description: 'Naviga il tab attivo a un URL e restituisce il nuovo snapshot della pagina.',
      inputSchema: z.object({ url: z.string().describe('URL completo, es. https://example.com') }),
      execute: async ({ url }: { url: string }) => {
        await approved('browser_navigate', { url }, `Naviga a ${url}`);
        return guarded(async () => {
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
            const fresh = await snapshotTab(tab.id, snapOpts, sendToTab);
            trackDomain(target);
            const final = (await chrome.tabs.get(tab.id)).url ?? '';
            const samePath =
              final &&
              (() => {
                try {
                  const a = new URL(final);
                  const b = new URL(target);
                  return a.origin + a.pathname === b.origin + b.pathname;
                } catch {
                  return true;
                }
              })();
            const note = final && !samePath ? ` (redirect: URL finale ${final})` : '';
            return { observation: `Navigato a ${target}${note}.\n\nNuovo snapshot:\n${fresh}` };
          } catch {
            return {
              observation: `Navigato a ${target}, ma il content script non è raggiungibile in questa pagina.`,
            };
          }
        });
      },
    }),

    browser_back: tool({
      description: 'Torna alla pagina precedente nel tab attivo e restituisce il nuovo snapshot.',
      inputSchema: z.object({}),
      execute: async () => {
        await approved('browser_back', {}, 'Torna indietro');
        return guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          await chrome.tabs.goBack(tab.id);
          await waitForTabComplete(tab.id);
          return acted(tab.id, 'Tornato indietro.');
        });
      },
    }),

    browser_click: tool({
      description: 'Clicca un elemento usando il suo ref numerico [n] dello snapshot più recente.',
      inputSchema: z.object({ ref: z.number().int().describe('Ref numerico dallo snapshot, es. 12') }),
      execute: async ({ ref }: { ref: number }) => {
        await approved('browser_click', { ref }, `Click su [${ref}]`);
        return guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          const res = await sendToTab<SnapshotResult>(tab.id, { kind: 'LMUSE_CLICK', ref });
          if (!res.ok) {
            if (res.error?.includes('scaduto')) {
              return refRescue(tab.id, ref, snapOpts, 'Click non riuscito.', sendToTab);
            }
            throw new Error(res.error ?? 'Click fallito.');
          }
          const done = await acted(tab.id, `Click su [${ref}] eseguito.`);
          return {
            observation: `${done.observation}\nSe la pagina non è cambiata, fai uno screenshot per verificare.`,
          };
        });
      },
    }),

    browser_type: tool({
      description:
        'Scrive testo in un campo input/textarea (ref dallo snapshot). Opzionalmente invia il form.',
      inputSchema: z.object({
        ref: z.number().int().describe('Ref numerico del campo dallo snapshot'),
        text: z.string().describe('Testo da digitare (sostituisce il contenuto)'),
        submit: z.boolean().optional().describe('Se true, preme Invio / invia il form dopo la digitazione'),
      }),
      execute: async ({ ref, text, submit }: { ref: number; text: string; submit?: boolean }) => {
        await approved(
          'browser_type',
          { ref, text, submit },
          `Digita in [${ref}]${submit ? ' + Invio' : ''}`,
        );
        return guarded(async () => {
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
              return refRescue(tab.id, ref, snapOpts, 'Digitazione non riuscita.', sendToTab);
            }
            throw new Error(res.error ?? 'Digitazione fallita.');
          }
          return acted(tab.id, `Testo inserito in [${ref}] (${res.valueLength ?? '?'} caratteri nel campo).`);
        });
      },
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
      execute: async ({ direction, ref }: { direction: 'up' | 'down' | 'top' | 'bottom'; ref?: number }) => {
        await approved('browser_scroll', { direction, ref }, `Scroll ${direction}`);
        return guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          const res = await sendToTab<SnapshotResult>(tab.id, { kind: 'LMUSE_SCROLL', direction, ref });
          if (!res.ok) {
            if (res.error?.includes('scaduto')) {
              return refRescue(tab.id, ref ?? 0, snapOpts, 'Scroll non riuscito.', sendToTab);
            }
            throw new Error(res.error ?? 'Scroll fallito.');
          }
          const done = await acted(tab.id, `Scroll eseguito (${res.scrollPercent ?? '?'}%).`);
          return done;
        });
      },
    }),

    browser_screenshot: tool({
      description:
        'Cattura uno screenshot del tab visibile. Lo VEDI come immagine: usalo quando lo snapshot testuale non basta (layout, verifica grafica).',
      inputSchema: z.object({}),
      execute: async () => {
        await approved('browser_screenshot', {}, 'Cattura screenshot');
        return guarded(async () => {
          if (!cfg.sendScreenshots) {
            throw new Error('Screenshot disattivato dalla privacy di lmuse (impostazioni ⚙).');
          }
          const win = await chrome.windows.getLastFocused();
          if (win.id == null) throw new Error('Finestra non trovata.');
          const dataUrl = (await chrome.tabs.captureVisibleTab(win.id, { format: 'png' })) as string;
          lastScreenshot = dataUrl.replace(/^data:image\/png;base64,/, '');
          return { captured: true };
        });
      },
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
          const lines = tabs.map((t) => {
            const title = (t.title ?? '').slice(0, 60);
            const url = maskUrlTokens(t.url ?? '');
            return cfg.maskPii ? `#${t.id} "${maskPii(title)}" ${url}` : `#${t.id} "${title}" ${url}`;
          });
          return { observation: truncate(lines.join('\n') || 'Nessun tab.', 2000) };
        }),
    }),

    browser_tab_focus: tool({
      description: 'Porta in primo piano un tab dato il suo id (vedi browser_tabs_list).',
      inputSchema: z.object({ tabId: z.number().int().describe('Id numerico del tab') }),
      execute: async ({ tabId }: { tabId: number }) => {
        if (!Number.isInteger(tabId) || tabId < 0) throw new Error('Id tab non valido.');
        await approved('browser_tab_focus', { tabId }, `Focus sul tab #${tabId}`);
        return guarded(async () => {
          try {
            await chrome.tabs.update(tabId, { active: true });
          } catch (error) {
            throw new Error(mapTabError(error), { cause: error });
          }
          let tab: chrome.tabs.Tab;
          try {
            tab = await chrome.tabs.get(tabId);
          } catch (error) {
            throw new Error(mapTabError(error), { cause: error });
          }
          trackDomain(tab.url);
          await waitForTabComplete(tabId, 5_000);
          try {
            const fresh = await snapshotTab(tabId, snapOpts, sendToTab);
            return { observation: `Focus sul tab "${tab.title}".\n\nNuovo snapshot:\n${fresh}` };
          } catch {
            return { observation: `Focus sul tab "${tab.title}". Content script non raggiungibile qui.` };
          }
        });
      },
    }),
  };

  return { tools, budget };
}
