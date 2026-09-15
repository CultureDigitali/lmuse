import { buildSnapshot, getElement } from './snapshot';

// Content script (isolated world): esegue snapshot e azioni DOM su richiesta
// del service worker. Non legge né esporta nulla di suo: agisce solo su
// messaggi espliciti con kind convalidato. (P31, R56, R57)

type Incoming =
  | { kind: 'LMUSE_SNAPSHOT'; maskPii: boolean }
  | { kind: 'LMUSE_CLICK'; ref: number }
  | { kind: 'LMUSE_TYPE'; ref: number; text: string; submit: boolean; allowPassword: boolean }
  | { kind: 'LMUSE_SCROLL'; direction: 'up' | 'down' | 'top' | 'bottom'; ref?: number };

const KINDS = new Set(['LMUSE_SNAPSHOT', 'LMUSE_CLICK', 'LMUSE_TYPE', 'LMUSE_SCROLL']);
const MAX_TYPE_CHARS = 2000;

function clickElement(el: Element): void {
  if (el instanceof HTMLElement) {
    el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    el.focus({ preventScroll: true });
  }
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  (el as HTMLElement).click?.();
}

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

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
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
  const reply = (payload: { ok: boolean; tree?: string; error?: string }): void => {
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
          const text = String(msg.text ?? '').slice(0, MAX_TYPE_CHARS);
          if (!text) throw new Error('Testo vuoto.');
          const el = getElement(msg.ref);
          if (!el) throw new Error(`Ref [${msg.ref}] scaduto: fai un nuovo snapshot.`);
          if (isPasswordField(el) && msg.allowPassword !== true) {
            throw new Error(
              'Campo password bloccato dalla privacy di lmuse: se serve, digita la password manualmente.',
            );
          }
          typeIntoElement(el, text);
          if (msg.submit) {
            await new Promise((r) => setTimeout(r, 300));
            submitFrom(el);
          }
          reply({ ok: true });
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
          reply({ ok: true });
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
