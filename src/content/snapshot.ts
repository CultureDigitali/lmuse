// Distillazione del DOM in un albero compatto con ref numerici stabili
// per lo snapshot corrente. I ref sono validi fino al prossimo snapshot.
//
// Privacy: i valori dei campi password NON vengono MAI inclusi (solo marker
// [password]); se maskPii è attivo email/IBAN/carte/numeri/token URL vengono
// redatti prima che il testo lascii la pagina.

import { maskPii } from '../shared/pii';

const MAX_NODES = 250;
const MAX_NAME_CHARS = 80;

let refCounter = 0;
let refMap = new Map<number, Element>();

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="textbox"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="combobox"]',
  '[role="option"]',
  '[role="tab"]',
  '[role="menuitem"]',
  'summary',
  '[contenteditable="true"]',
].join(',');

function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return true;
  if (el.hidden || el.ariaHidden === 'true') return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  return true;
}

function isPasswordField(el: Element): boolean {
  return el instanceof HTMLInputElement && el.type === 'password';
}

function elementName(el: Element): string {
  // Mai il valore di un campo password: solo marker.
  if (isPasswordField(el)) return '[password]';
  const labelled =
    el.getAttribute('aria-label') ||
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value || el.placeholder : '') ||
    (el instanceof HTMLSelectElement ? el.options[el.selectedIndex]?.text : '') ||
    (el instanceof HTMLImageElement ? el.alt : '') ||
    el.getAttribute('placeholder') ||
    el.getAttribute('title') ||
    el.getAttribute('alt') ||
    (el.textContent ?? '');
  return labelled.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_CHARS);
}

function describeExtra(el: Element): string {
  if (el instanceof HTMLAnchorElement && el.href) {
    try {
      const url = new URL(el.href, location.href);
      return ` -> ${url.hostname}${url.pathname !== '/' ? url.pathname : ''}`.slice(0, 70);
    } catch {
      return '';
    }
  }
  if (el instanceof HTMLInputElement) {
    const type = el.type || 'text';
    const extra = el.checked ? ' [checked]' : el.disabled ? ' [disabled]' : '';
    return ` (input ${type})${extra}`;
  }
  if (el instanceof HTMLSelectElement) return ' (select)';
  if (el instanceof HTMLTextAreaElement) return ' (textarea)';
  if (el.getAttribute('role')) return ` (role ${el.getAttribute('role')})`;
  return '';
}

/**
 * Raccoglie gli elementi interattivi attraversando anche gli shadow DOM
 * aperti (molti siti moderni li usano; querySelectorAll da solo non li vede).
 */
function collectInteractive(root: Document | ShadowRoot): Element[] {
  const found: Element[] = [...root.querySelectorAll(INTERACTIVE_SELECTOR)];
  for (const el of root.querySelectorAll('*')) {
    if (el.shadowRoot) found.push(...collectInteractive(el.shadowRoot));
  }
  return found;
}

/** Registra elementi extra (es. da browser_query) nella mappa ref corrente. */
export function registerElements(els: Element[]): number[] {
  const refs: number[] = [];
  for (const el of els) {
    const ref = refCounter++;
    refMap.set(ref, el);
    refs.push(ref);
  }
  return refs;
}

/** Costruisce lo snapshot testuale della pagina. */
export function buildSnapshot(maskPiiEnabled = true): string {
  refCounter = 0;
  refMap = new Map();
  const lines: string[] = [];
  const found = collectInteractive(document);

  for (const el of found) {
    if (lines.length >= MAX_NODES) {
      lines.push(`…[altri ${found.length - lines.length} elementi omessi]`);
      break;
    }
    if (!isVisible(el)) continue;
    const tag = el.tagName.toLowerCase();
    const name = elementName(el);
    if (!name && tag !== 'input') continue;
    const ref = refCounter++;
    refMap.set(ref, el);
    lines.push(`[${ref}] ${tag} "${name}"${describeExtra(el)}`);
  }

  const headings = Array.from(document.querySelectorAll('h1, h2'))
    .slice(0, 8)
    .map((h) => (h.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 100))
    .filter(Boolean);
  const scroll = Math.round(
    (window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight)) * 100,
  );
  const header = `URL pagina corrente: ${location.href}\nScroll: ${isFinite(scroll) ? scroll : 0}%\n${
    headings.length > 0 ? `Contenuto: ${headings.join(' | ')}\n` : ''
  }`;
  const body = `Elementi interattivi (${lines.length}):\n${lines.join('\n') || '(nessuno)'}`;
  const text = header + body;
  return maskPiiEnabled ? maskPii(text) : text;
}

export function getElement(ref: number): Element | null {
  return refMap.get(ref) ?? null;
}
