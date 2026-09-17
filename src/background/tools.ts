import { tool } from 'ai';
import { z } from 'zod';
import { ToolBudget, FailureCircuit } from '../shared/budget';
import { mapProviderError, mapTabError } from '../shared/errors';
import { isAllowedHost, isBlockedUrl, normalizeNavigationTarget } from '../shared/urlGuard';
import { MAX_SNAPSHOT_CHARS } from '../shared/settings';
import { extractDomain, shouldApprove, type ApprovalContext, type ApprovalPolicy } from '../shared/approval';
import { formatSnapshotHeader } from '../shared/header';
import { maskPii, maskUrlTokens } from '../shared/pii';
import { containsStop } from '../shared/task';

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
  trustedDomains: string[];
  snapshotMaxChars: number;
  stopText: string;
  budgetMax: number;
  policy: ApprovalPolicy;
  signal: AbortSignal;
  /** Il worker chiede al panel; true = approvato. Rifiuta su STOP. */
  requestApproval: (tool: string, description: string, domain?: string) => Promise<boolean>;
  onApprovalDecision?: (tool: string, approved: boolean, reason: string) => void;
}

export interface SnapshotResult {
  ok: boolean;
  tree?: string;
  error?: string;
  valueLength?: number;
  scrollPercent?: number;
  selected?: string;
  waitedMs?: number;
  focused?: string;
  text?: string;
  links?: { text: string; href: string }[];
  rect?: { x: number; y: number; w: number; h: number; dpr: number };
  refs?: number[];
  count?: number;
  table?: string;
}

/** Ultimo screenshot catturato (PNG base64, senza prefisso data:). */
let lastScreenshot: string | null = null;

function base64Of(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Ritaglia un PNG (data URL) al rettangolo CSS px dato (con DPR). */
async function cropPng(
  dataUrl: string,
  rect: { x: number; y: number; w: number; h: number; dpr: number },
): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const bmp = await createImageBitmap(blob);
  const sx = Math.max(0, Math.round(rect.x * rect.dpr));
  const sy = Math.max(0, Math.round(rect.y * rect.dpr));
  const sw = Math.min(bmp.width - sx, Math.round(rect.w * rect.dpr));
  const sh = Math.min(bmp.height - sy, Math.round(rect.h * rect.dpr));
  if (sw < 2 || sh < 2) throw new Error('Elemento fuori dallo schermo visibile.');
  const canvas = new OffscreenCanvas(sw, sh);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas non disponibile.');
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
  const out = await canvas.convertToBlob({ type: 'image/png' });
  return base64Of(await out.arrayBuffer());
}

const TAB_REPLY_TIMEOUT_MS = 10_000;
const UNREACHABLE_PREFIX = 'Content script non raggiungibile';

function truncateTo(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n…[troncato]` : text;
}

function truncate(text: string, max = MAX_SNAPSHOT_CHARS): string {
  return truncateTo(text, max);
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
  maxChars: number;
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
  return truncateTo(out, opts.maxChars);
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
const STOP_TEXT_PREFIX = 'STOP_TEXT:';

export function createBrowserTools(cfg: BrowserToolConfig) {
  const budget = new ToolBudget(cfg.budgetMax);
  const circuit = new FailureCircuit(5);
  const seenDomains: string[] = [];
  const snapOpts: SnapshotOpts = {
    maskPii: cfg.maskPii,
    hostOnly: cfg.hostOnly,
    maxChars: cfg.snapshotMaxChars,
  };

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

  /** Guardia centrale: budget + circuit breaker + errori in italiano. */
  async function guarded<O>(fn: () => Promise<O>): Promise<O> {
    if (circuit.open) {
      throw new Error(
        `Troppi errori consecutivi (${circuit.failures}): run interrotto. Riformula il task o cambia pagina e riprova.`,
      );
    }
    if (!budget.tryConsume()) throw new Error(`${BUDGET_EXHAUSTED} (${budget.max} chiamate per run).`);
    try {
      const out = await fn();
      circuit.recordSuccess();
      return out;
    } catch (error) {
      circuit.recordFailure();
      throw new Error(mapProviderError(error), { cause: error });
    }
  }

  /** Approval umana prima dell'azione; niente consumo budget se negata. */
  async function approved(
    toolName: string,
    args: unknown,
    description: string,
    domain?: string,
  ): Promise<void> {
    const ctx: ApprovalContext = { seenDomains: [...seenDomains], trustedDomains: cfg.trustedDomains };
    const { needed, reason } = shouldApprove(toolName, args, cfg.policy, ctx);
    if (!needed) return;
    const full = reason ? `${description} — ${reason}` : description;
    let ok: boolean;
    try {
      ok = await cfg.requestApproval(toolName, full, domain);
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
      return { observation: checkStop(`${message}\n\nNuovo snapshot:\n${fresh}`) };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith(STOP_TEXT_PREFIX)) throw error;
      return { observation: `${message} Fai un nuovo snapshot per vedere il risultato.` };
    }
  }

  /** Se l'osservazione contiene lo stop-text utente, termina il run con successo parziale. */
  function checkStop(observation: string): string {
    if (cfg.stopText && containsStop(observation, cfg.stopText)) {
      throw new Error(`${STOP_TEXT_PREFIX}condizione "${cfg.stopText}" rilevata nella pagina.`);
    }
    return observation;
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
          return { observation: checkStop(await snapshotTab(tab.id, snapOpts, sendToTab)) };
        }),
    }),

    browser_navigate: tool({
      description: 'Naviga il tab attivo a un URL e restituisce il nuovo snapshot della pagina.',
      inputSchema: z.object({ url: z.string().describe('URL completo, es. https://example.com') }),
      execute: async ({ url }: { url: string }) => {
        const target = normalizeNavigationTarget(url);
        const domain = target ? extractDomain(target) : null;
        await approved('browser_navigate', { url }, `Naviga a ${url}`, domain ?? undefined);
        return guarded(async () => {
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

    browser_forward: tool({
      description: 'Va alla pagina successiva nel tab attivo e restituisce il nuovo snapshot.',
      inputSchema: z.object({}),
      execute: async () => {
        await approved('browser_forward', {}, 'Vai avanti');
        return guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          await chrome.tabs.goForward(tab.id);
          await waitForTabComplete(tab.id);
          return acted(tab.id, 'Andato avanti.');
        });
      },
    }),

    browser_reload: tool({
      description: 'Ricarica la pagina del tab attivo e restituisce il nuovo snapshot.',
      inputSchema: z.object({}),
      execute: async () => {
        await approved('browser_reload', {}, 'Ricarica pagina');
        return guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          await chrome.tabs.reload(tab.id);
          await waitForTabComplete(tab.id);
          await new Promise((r) => setTimeout(r, 800));
          return acted(tab.id, 'Pagina ricaricata.');
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

    browser_hover: tool({
      description:
        'Passa il mouse su un elemento (ref dallo snapshot): apre menu, tooltip, hover-state.',
      inputSchema: z.object({ ref: z.number().int().describe('Ref numerico dallo snapshot') }),
      execute: async ({ ref }: { ref: number }) => {
        await approved('browser_hover', { ref }, `Hover su [${ref}]`);
        return guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          const res = await sendToTab<SnapshotResult>(tab.id, { kind: 'LMUSE_HOVER', ref });
          if (!res.ok) throw new Error(res.error ?? 'Hover fallito.');
          return acted(
            tab.id,
            'Hover eseguito. Se è apparso un menu, fai uno snapshot per vedere le nuove voci.',
          );
        });
      },
    }),

    browser_clipboard_write: tool({
      description: 'Scrive testo negli appunti della pagina (come se l’utente lo copiasse).',
      inputSchema: z.object({ text: z.string().describe('Testo da copiare (max 2000 caratteri)') }),
      execute: async ({ text }: { text: string }) => {
        await approved('browser_clipboard_write', { text: `${text.slice(0, 80)}…` }, 'Scrive negli appunti');
        return guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          const res = await sendToTab<SnapshotResult>(tab.id, { kind: 'LMUSE_CLIPBOARD_WRITE', text });
          if (!res.ok) throw new Error(res.error ?? 'Scrittura appunti fallita (permesso?).');
          return acted(tab.id, 'Testo copiato negli appunti della pagina.');
        });
      },
    }),

    browser_clipboard_read: tool({
      description: 'Legge il testo negli appunti della pagina (richiede conferma: dato sensibile).',
      inputSchema: z.object({}),
      execute: async () => {
        await approved('browser_clipboard_read', {}, 'Legge gli appunti (dato sensibile)');
        return guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          const res = await sendToTab<SnapshotResult>(tab.id, { kind: 'LMUSE_CLIPBOARD_READ' });
          if (!res.ok) throw new Error(res.error ?? 'Lettura appunti fallita (permesso?).');
          return acted(tab.id, `Appunti: "${String(res.text ?? '').slice(0, 120)}"`);
        });
      },
    }),

    browser_select: tool({
      description:
        'Sceglie un’opzione in un menu a tendina <select> (ref dallo snapshot), per valore o testo visibile.',
      inputSchema: z.object({
        ref: z.number().int().describe('Ref numerico del menu dallo snapshot'),
        value: z.string().describe('Valore o testo visibile dell’opzione'),
      }),
      execute: async ({ ref, value }: { ref: number; value: string }) => {
        await approved('browser_select', { ref, value }, `Seleziona "${value}" in [${ref}]`);
        return guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          const res = await sendToTab<SnapshotResult>(tab.id, { kind: 'LMUSE_SELECT', ref, value });
          if (!res.ok) {
            if (res.error?.includes('scaduto')) {
              return refRescue(tab.id, ref, snapOpts, 'Selezione non riuscita.', sendToTab);
            }
            throw new Error(res.error ?? 'Selezione fallita.');
          }
          return acted(tab.id, `Selezionato "${res.selected ?? value}" in [${ref}].`);
        });
      },
    }),

    browser_wait: tool({
      description:
        'Attende (max 30s) che un testo appaia nella pagina o un selettore CSS esista. Per pagine dinamiche.',
      inputSchema: z.object({
        waitKind: z.enum(['text', 'selector']).describe('Cosa attendere'),
        value: z.string().describe('Testo o selettore CSS'),
        timeoutMs: z.number().int().min(500).max(30_000).optional().describe('Timeout ms (default 10000)'),
      }),
      execute: async ({
        waitKind,
        value,
        timeoutMs,
      }: {
        waitKind: 'text' | 'selector';
        value: string;
        timeoutMs?: number;
      }) =>
        guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          const res = await sendToTab<SnapshotResult>(tab.id, {
            kind: 'LMUSE_WAIT',
            waitKind,
            value,
            timeoutMs: timeoutMs ?? 10_000,
          });
          if (!res.ok) throw new Error(res.error ?? 'Attesa fallita.');
          return acted(tab.id, `Trovato dopo ${res.waitedMs ?? '?'}ms.`);
        }),
    }),

    browser_press: tool({
      description: 'Premere un tasto di navigazione (Escape, Tab, frecce, Home, End, Pag). Mai Invio.',
      inputSchema: z.object({
        key: z.string().describe('Tasto: Escape, Tab, ArrowUp/Down/Left/Right, Home, End, PageUp, PageDown'),
      }),
      execute: async ({ key }: { key: string }) => {
        await approved('browser_press', { key }, `Tasto ${key}`);
        return guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          const res = await sendToTab<SnapshotResult>(tab.id, { kind: 'LMUSE_PRESS', key });
          if (!res.ok) throw new Error(res.error ?? 'Pressione tasto fallita.');
          return acted(tab.id, `Tasto ${key} premuto (focus: ${res.focused ?? '?'}).`);
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

    browser_screenshot_element: tool({
      description:
        'Screenshot ritagliato su un elemento (ref dallo snapshot). Invia MENO dati del full-page: usalo per leggere dettagli.',
      inputSchema: z.object({ ref: z.number().int().describe('Ref numerico dallo snapshot') }),
      execute: async ({ ref }: { ref: number }) => {
        await approved('browser_screenshot_element', { ref }, `Screenshot di [${ref}]`);
        return guarded(async () => {
          if (!cfg.sendScreenshots) {
            throw new Error('Screenshot disattivato dalla privacy di lmuse (impostazioni ⚙).');
          }
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          const res = await sendToTab<SnapshotResult>(tab.id, { kind: 'LMUSE_RECT', ref });
          if (!res.ok || !res.rect) {
            if (res.error?.includes('scaduto')) {
              return refRescue(tab.id, ref, snapOpts, 'Screenshot elemento non riuscito.', sendToTab);
            }
            throw new Error(res.error ?? 'Misura elemento fallita.');
          }
          const win = await chrome.windows.getLastFocused();
          if (win.id == null) throw new Error('Finestra non trovata.');
          const dataUrl = (await chrome.tabs.captureVisibleTab(win.id, { format: 'png' })) as string;
          lastScreenshot = await cropPng(dataUrl, res.rect);
          return { captured: true };
        });
      },
      toModelOutput: (options: { output: unknown }) => {
        const output = options.output as { captured?: boolean } | null;
        const shot = output?.captured === true ? lastScreenshot : null;
        if (!shot) return { type: 'text', value: 'Screenshot elemento non riuscito.' };
        return {
          type: 'content',
          value: [
            { type: 'text', text: 'Ecco lo screenshot ritagliato:' },
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

    browser_tab_duplicate: tool({
      description: 'Duplica il tab attivo (per esplorare senza perdere la pagina) e lo porta in primo piano.',
      inputSchema: z.object({}),
      execute: async () => {
        await approved('browser_tab_duplicate', {}, 'Duplica tab');
        return guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          let dup: chrome.tabs.Tab | undefined;
          try {
            dup = await chrome.tabs.duplicate(tab.id);
          } catch (error) {
            throw new Error(mapTabError(error), { cause: error });
          }
          if (dup?.id == null) throw new Error('Duplicazione fallita.');
          await waitForTabComplete(dup.id, 5_000);
          trackDomain(dup.url);
          try {
            const fresh = await snapshotTab(dup.id, snapOpts, sendToTab);
            return { observation: `Tab duplicato (#${dup.id}).\n\nNuovo snapshot:\n${fresh}` };
          } catch {
            return { observation: `Tab duplicato (#${dup.id}). Content script non raggiungibile qui.` };
          }
        });
      },
    }),

    browser_read_text: tool({
      description:
        'Legge il testo visibile della pagina (max 8000 caratteri, redatto se privacy attiva). Mode main = solo contenuto principale.',
      inputSchema: z.object({
        mode: z.enum(['full', 'main']).optional().describe('full = tutta la pagina, main = article/main'),
      }),
      execute: async ({ mode }: { mode?: 'full' | 'main' }) =>
        guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          const res = await sendToTab<SnapshotResult>(tab.id, {
            kind: 'LMUSE_TEXT',
            maxChars: Math.min(cfg.snapshotMaxChars, 8000),
            maskPii: cfg.maskPii,
            mode: mode ?? 'full',
          });
          if (!res.ok) throw new Error(res.error ?? 'Lettura testo fallita.');
          return { observation: checkStop(truncateTo(res.text ?? '(vuoto)', 8000)) };
        }),
    }),

    browser_links: tool({
      description: 'Elenca i link della pagina (testo + URL, max 200, token redatti).',
      inputSchema: z.object({}),
      execute: async () =>
        guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          const res = await sendToTab<SnapshotResult>(tab.id, { kind: 'LMUSE_LINKS', max: 200 });
          if (!res.ok) throw new Error(res.error ?? 'Lettura link fallita.');
          const lines = (res.links ?? []).map((l) => {
            const href = maskUrlTokens(l.href);
            return cfg.maskPii ? `- ${maskPii(l.text)} → ${href}` : `- ${l.text} → ${href}`;
          });
          return { observation: checkStop(truncateTo(lines.join('\n') || 'Nessun link.', 6000)) };
        }),
    }),

    browser_find: tool({
      description:
        'Cerca un testo nella pagina, evidenzia le occorrenze (max 100) e scorre a quella indicata.',
      inputSchema: z.object({
        text: z.string().describe('Testo da cercare'),
        index: z.number().int().min(0).optional().describe('Quale occorrenza mostrare (default 0)'),
      }),
      execute: async ({ text, index }: { text: string; index?: number }) =>
        guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          const res = await sendToTab<SnapshotResult>(tab.id, {
            kind: 'LMUSE_FIND',
            text,
            index: index ?? 0,
          });
          if (!res.ok) throw new Error(res.error ?? 'Ricerca fallita.');
          return { observation: `Trovate ${res.count ?? 0} occorrenze di "${text.slice(0, 80)}".` };
        }),
    }),

    browser_table: tool({
      description: 'Estrae una tabella come markdown (ref di un elemento dentro la tabella).',
      inputSchema: z.object({ ref: z.number().int().describe('Ref numerico dallo snapshot') }),
      execute: async ({ ref }: { ref: number }) =>
        guarded(async () => {
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          const res = await sendToTab<SnapshotResult>(tab.id, { kind: 'LMUSE_TABLE', ref });
          if (!res.ok) {
            if (res.error?.includes('scaduto')) {
              return refRescue(tab.id, ref, snapOpts, 'Lettura tabella non riuscita.', sendToTab);
            }
            throw new Error(res.error ?? 'Lettura tabella fallita.');
          }
          return { observation: checkStop(truncateTo(res.table ?? '(vuota)', 6000)) };
        }),
    }),

    browser_query: tool({
      description:
        'Elenca elementi con un selettore CSS e assegna ref usabili (max 100). Per casi che lo snapshot non copre.',
      inputSchema: z.object({
        selector: z.string().describe('Selettore CSS, es. "table.tbl td.num"'),
        max: z.number().int().min(1).max(100).optional().describe('Max elementi (default 30)'),
      }),
      execute: async ({ selector, max }: { selector: string; max?: number }) =>
        guarded(async () => {
          if (!selector.trim()) throw new Error('Selettore vuoto.');
          const tab = await getActiveTab();
          if (!tab.id) throw new Error('Tab senza id.');
          const res = await sendToTab<SnapshotResult>(tab.id, {
            kind: 'LMUSE_QUERY',
            selector,
            max: max ?? 30,
          });
          if (!res.ok) throw new Error(res.error ?? 'Query fallita.');
          return {
            observation: `Trovati ${(res.refs ?? []).length} elementi (ref riusabili): ${res.text ?? ''}`,
          };
        }),
    }),
  };

  return { tools, budget };
}
