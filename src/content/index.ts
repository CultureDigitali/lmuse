import { buildSnapshot, getElement, registerElements } from './snapshot';
import { isPressAllowed } from './keys';
import { describeFocused, selectOption, waitFor, hoverElement } from './actions';
import { findInPage, tableToMarkdown } from './extract';
import { maskPii } from '../shared/pii';

// Content script (isolated world): esegue snapshot e azioni DOM su richiesta
// del service worker. Non legge né esporta nulla di suo: agisce solo su
// messaggi espliciti con kind convalidato. (P31, R56, R57)

type Incoming =
  | { kind: 'LMUSE_SNAPSHOT'; maskPii: boolean }
  | { kind: 'LMUSE_CLICK'; ref: number }
  | { kind: 'LMUSE_TYPE'; ref: number; text: string; submit: boolean; allowPassword: boolean }
  | { kind: 'LMUSE_SCROLL'; direction: 'up' | 'down' | 'top' | 'bottom'; ref?: number }
  | { kind: 'LMUSE_SELECT'; ref: number; value: string }
  | { kind: 'LMUSE_WAIT'; waitKind: 'text' | 'selector'; value: string; timeoutMs: number }
  | { kind: 'LMUSE_PRESS'; key: string }
  | { kind: 'LMUSE_HOVER'; ref: number }
  | { kind: 'LMUSE_CLIPBOARD_WRITE'; text: string }
  | { kind: 'LMUSE_CLIPBOARD_READ' }
  | { kind: 'LMUSE_TEXT'; maxChars: number; maskPii: boolean; mode: 'full' | 'main' }
  | { kind: 'LMUSE_LINKS'; max: number }
  | { kind: 'LMUSE_RECT'; ref: number }
  | { kind: 'LMUSE_FIND'; text: string; index: number }
  | { kind: 'LMUSE_TABLE'; ref: number }
  | { kind: 'LMUSE_QUERY'; selector: string; max: number };

const KINDS = new Set([
  'LMUSE_SNAPSHOT',
  'LMUSE_CLICK',
  'LMUSE_TYPE',
  'LMUSE_SCROLL',
  'LMUSE_SELECT',
  'LMUSE_WAIT',
  'LMUSE_PRESS',
  'LMUSE_HOVER',
  'LMUSE_CLIPBOARD_WRITE',
  'LMUSE_CLIPBOARD_READ',
  'LMUSE_TEXT',
  'LMUSE_LINKS',
  'LMUSE_RECT',
  'LMUSE_FIND',
  'LMUSE_TABLE',
  'LMUSE_QUERY',
]);
const MAX_TYPE_CHARS = 2000;
const MAX_TEXT_CHARS = 8000;
const MAX_LINKS = 200;

function clickElement(el: Element): void {
  if (el instanceof HTMLElement) {
    el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    el.focus({ preventScroll: true });
  }
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  (el as HTMLElement).click?.();
}

/** Hover sintetico (in actions.ts, testato): menu, tooltip, hover-state. */

function isPasswordField(el: Element): boolean {
  return el instanceof HTMLInputElement && el.type === 'password';
}

function typeIntoElement(el: Element, text: string): void {
  const editable =
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable);
  if (!editable) throw new Error('Il ref non è un campo di testo.');
  if (el instanceof HTMLElement) {
    el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    el.focus({ preventScroll: true });
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.select?.();
    const applied = document.execCommand?.('insertText', false, text) ?? false;
    if (!applied) {
      const setter =
        (el instanceof HTMLInputElement
          ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
          : undefined) ?? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(el, text);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    document.execCommand?.('selectAll', false);
    document.execCommand?.('insertText', false, text);
  }
}

function submitFrom(el: Element): void {
  const form = el.closest('form');
  if (form) {
    form.requestSubmit();
    return;
  }
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
}

function validRef(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 10_000;
}

interface ReplyPayload {
  ok: boolean;
  tree?: string;
  error?: string;
  /** Lunghezza valore campo dopo type (conferma applicazione, R150). */
  valueLength?: number;
  /** % scroll raggiunta dopo scroll (R151). */
  scrollPercent?: number;
  /** Label opzione selezionata (SELECT). */
  selected?: string;
  /** Ms attesi dal WAIT. */
  waitedMs?: number;
  /** Descrittore elemento focalizzato dopo PRESS. */
  focused?: string;
  /** Testo pagina (TEXT). */
  text?: string;
  /** Link pagina (LINKS). */
  links?: { text: string; href: string }[];
  /** Ref registrati da QUERY. */
  refs?: number[];
  /** Conteggi FIND/TABLE. */
  count?: number;
  /** Markdown tabella (TABLE). */
  table?: string;
  /** Rettangolo elemento in CSS px + DPR (RECT). */
  rect?: { x: number; y: number; w: number; h: number; dpr: number };
}

function currentScrollPercent(): number {
  const max = document.body.scrollHeight - window.innerHeight;
  if (max <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((window.scrollY / max) * 100)));
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  // Solo la nostra estensione può comandarci (S101).
  if (sender.id !== chrome.runtime.id) return false;
  if (
    !message ||
    typeof message !== 'object' ||
    !('kind' in message) ||
    typeof (message as { kind: unknown }).kind !== 'string' ||
    !KINDS.has((message as { kind: string }).kind)
  ) {
    return false;
  }
  const msg = message as Incoming;
  let responded = false;
  const reply = (payload: ReplyPayload): void => {
    if (responded) return;
    responded = true;
    sendResponse(payload);
  };
  void (async () => {
    try {
      switch (msg.kind) {
        case 'LMUSE_SNAPSHOT':
          reply({ ok: true, tree: buildSnapshot(msg.maskPii !== false) });
          break;
        case 'LMUSE_CLICK': {
          if (!validRef(msg.ref)) throw new Error('Ref non valido.');
          const el = getElement(msg.ref);
          if (!el) throw new Error(`Ref [${msg.ref}] scaduto: fai un nuovo snapshot.`);
          clickElement(el);
          reply({ ok: true });
          break;
        }
        case 'LMUSE_TYPE': {
          if (!validRef(msg.ref)) throw new Error('Ref non valido.');
          const rawText = String(msg.text ?? '');
          // Niente troncamenti silenziosi: il worker deve sapere cosa digita (S114).
          if (rawText.length > MAX_TYPE_CHARS) {
            throw new Error(`Testo troppo lungo (${rawText.length} caratteri, max ${MAX_TYPE_CHARS}).`);
          }
          if (!rawText) throw new Error('Testo vuoto.');
          const el = getElement(msg.ref);
          if (!el) throw new Error(`Ref [${msg.ref}] scaduto: fai un nuovo snapshot.`);
          if (isPasswordField(el) && msg.allowPassword !== true) {
            throw new Error(
              'Campo password bloccato dalla privacy di lmuse: se serve, digita la password manualmente.',
            );
          }
          typeIntoElement(el, rawText);
          if (msg.submit) {
            await new Promise((r) => setTimeout(r, 300));
            submitFrom(el);
          }
          const valueLength =
            el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
              ? el.value.length
              : rawText.length;
          reply({ ok: true, valueLength });
          break;
        }
        case 'LMUSE_SCROLL': {
          if (msg.ref != null && !validRef(msg.ref)) throw new Error('Ref non valido.');
          const amount = window.innerHeight * 0.8;
          if (msg.ref != null) {
            const el = getElement(msg.ref);
            if (!el) throw new Error(`Ref [${msg.ref}] scaduto: fai un nuovo snapshot.`);
            el.scrollIntoView(
              msg.direction === 'top'
                ? { block: 'start' }
                : msg.direction === 'bottom'
                  ? { block: 'end' }
                  : { block: 'center' },
            );
          } else if (msg.direction === 'up') {
            window.scrollBy({ top: -amount });
          } else if (msg.direction === 'down') {
            window.scrollBy({ top: amount });
          } else if (msg.direction === 'top') {
            window.scrollTo({ top: 0 });
          } else {
            window.scrollTo({ top: document.body.scrollHeight });
          }
          reply({ ok: true, scrollPercent: currentScrollPercent() });
          break;
        }
        case 'LMUSE_SELECT': {
          if (!validRef(msg.ref)) throw new Error('Ref non valido.');
          const value = String(msg.value ?? '').trim();
          if (!value) throw new Error('Valore opzione vuoto.');
          const el = getElement(msg.ref);
          if (!el) throw new Error(`Ref [${msg.ref}] scaduto: fai un nuovo snapshot.`);
          const label = selectOption(el, value);
          reply({ ok: true, selected: label });
          break;
        }
        case 'LMUSE_WAIT': {
          const value = String(msg.value ?? '').trim();
          if (!value) throw new Error('Testo/selettore vuoto.');
          if (msg.waitKind !== 'text' && msg.waitKind !== 'selector') {
            throw new Error('Tipo attesa non valido (text|selector).');
          }
          if (msg.waitKind === 'selector') {
            try {
              document.querySelector(value);
            } catch {
              throw new Error(`Selettore CSS non valido: "${value}".`);
            }
          }
          const waitedMs = await waitFor(msg.waitKind, value, msg.timeoutMs);
          reply({ ok: true, waitedMs });
          break;
        }
        case 'LMUSE_PRESS': {
          if (!isPressAllowed(msg.key)) {
            throw new Error(
              `Tasto "${msg.key}" non consentito (solo navigazione: Escape, Tab, frecce, Home, End, Pag).`,
            );
          }
          const target = (document.activeElement as HTMLElement) ?? document.body;
          target.dispatchEvent(new KeyboardEvent('keydown', { key: msg.key, bubbles: true }));
          target.dispatchEvent(new KeyboardEvent('keyup', { key: msg.key, bubbles: true }));
          reply({ ok: true, focused: describeFocused() });
          break;
        }
        case 'LMUSE_HOVER': {
          if (!validRef(msg.ref)) throw new Error('Ref non valido.');
          const el = getElement(msg.ref);
          if (!el) throw new Error(`Ref [${msg.ref}] scaduto: fai un nuovo snapshot.`);
          hoverElement(el);
          reply({ ok: true });
          break;
        }
        case 'LMUSE_CLIPBOARD_WRITE': {
          const text = String(msg.text ?? '');
          if (!text) throw new Error('Testo vuoto.');
          if (text.length > MAX_TYPE_CHARS) {
            throw new Error(`Testo troppo lungo (${text.length} caratteri, max ${MAX_TYPE_CHARS}).`);
          }
          await navigator.clipboard.writeText(text);
          reply({ ok: true });
          break;
        }
        case 'LMUSE_CLIPBOARD_READ': {
          const text = await navigator.clipboard.readText();
          reply({ ok: true, text: text.slice(0, MAX_TYPE_CHARS) });
          break;
        }
        case 'LMUSE_TEXT': {
          const max = Math.min(Math.max(msg.maxChars, 500), MAX_TEXT_CHARS);
          const scope =
            msg.mode === 'main'
              ? (document.querySelector('article, main, [role="main"]') ?? document.body)
              : document.body;
          const raw = ((scope as HTMLElement).innerText ?? scope?.textContent ?? '').slice(0, max);
          reply({ ok: true, text: msg.maskPii !== false ? maskPii(raw) : raw });
          break;
        }
        case 'LMUSE_LINKS': {
          const max = Math.min(Math.max(msg.max, 1), MAX_LINKS);
          const links = [...document.querySelectorAll('a[href]')].slice(0, max).map((a) => ({
            text: ((a.textContent ?? '').replace(/\s+/g, ' ').trim() || '(senza testo)').slice(0, 80),
            href: (a as HTMLAnchorElement).href,
          }));
          reply({ ok: true, links });
          break;
        }
        case 'LMUSE_RECT': {
          if (!validRef(msg.ref)) throw new Error('Ref non valido.');
          const el = getElement(msg.ref);
          if (!el) throw new Error(`Ref [${msg.ref}] scaduto: fai un nuovo snapshot.`);
          const rect = el.getBoundingClientRect();
          if (rect.width < 2 || rect.height < 2) throw new Error('Elemento non visibile.');
          reply({
            ok: true,
            rect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              w: Math.round(rect.width),
              h: Math.round(rect.height),
              dpr: window.devicePixelRatio || 1,
            },
          });
          break;
        }
        case 'LMUSE_FIND': {
          const text = String(msg.text ?? '').trim();
          if (!text) throw new Error('Testo da cercare vuoto.');
          const count = findInPage(text.slice(0, 200), Math.max(0, msg.index || 0));
          reply({ ok: true, count });
          break;
        }
        case 'LMUSE_TABLE': {
          if (!validRef(msg.ref)) throw new Error('Ref non valido.');
          const el = getElement(msg.ref);
          if (!el) throw new Error(`Ref [${msg.ref}] scaduto: fai un nuovo snapshot.`);
          const table = el.closest('table') ?? (el.tagName.toLowerCase() === 'table' ? el : null);
          if (!(table instanceof HTMLTableElement)) throw new Error('Il ref non è in una tabella.');
          reply({ ok: true, table: tableToMarkdown(table) });
          break;
        }
        case 'LMUSE_QUERY': {
          const selector = String(msg.selector ?? '').trim();
          if (!selector) throw new Error('Selettore vuoto.');
          let els: Element[];
          try {
            els = [...document.querySelectorAll(selector)].slice(0, Math.min(Math.max(msg.max, 1), 100));
          } catch {
            throw new Error(`Selettore CSS non valido: "${selector}".`);
          }
          if (els.length === 0) throw new Error(`Nessun elemento per "${selector}".`);
          const refs = registerElements(els);
          reply({
            ok: true,
            refs,
            text: els.map((el, i) => `[${refs[i]}] ${(el.tagName ?? '').toLowerCase()}`).join(', '),
          });
          break;
        }
      }
    } catch (error) {
      reply({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();
  return true;
});

export {};
