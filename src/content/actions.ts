// Azioni DOM testabili (jsdom): select, attesa, focus. Il listener
// chrome.runtime resta in index.ts per non eseguirlo nei test.

export const MAX_WAIT_MS = 30_000;

/** Testo del body: innerText dove c'è layout, textContent come fallback. */
export function bodyText(): string {
  const body = document.body;
  if (!body) return '';
  return body.innerText ?? body.textContent ?? '';
}

export function describeFocused(): string {
  const el = document.activeElement;
  if (!el || el === document.body) return 'nessuno (body)';
  const tag = el.tagName.toLowerCase();
  const label = el.getAttribute('aria-label') || (el as HTMLElement).innerText?.slice(0, 40) || el.id || '';
  return label ? `${tag} "${label.trim()}"` : tag;
}

export function selectOption(el: Element, value: string): string {
  if (!(el instanceof HTMLSelectElement)) throw new Error('Il ref non è un menu a tendina.');
  if (el.disabled) throw new Error('Menu disabilitato.');
  const wanted = value.trim().toLowerCase();
  const options = [...el.options];
  const found = options.find(
    (o) => o.value.toLowerCase() === wanted || (o.text ?? '').trim().toLowerCase() === wanted,
  );
  if (!found) {
    const available = options
      .slice(0, 10)
      .map((o) => o.text.trim() || o.value)
      .join(', ');
    throw new Error(`Opzione "${value}" non trovata. Disponibili: ${available || '(nessuna)'}.`);
  }
  el.focus({ preventScroll: true });
  el.selectedIndex = found.index;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return found.text.trim() || found.value;
}

export function waitFor(waitKind: 'text' | 'selector', value: string, timeoutMs: number): Promise<number> {
  const capped = Math.min(Math.max(timeoutMs, 500), MAX_WAIT_MS);
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = (): void => {
      const found = waitKind === 'text' ? bodyText().includes(value) : document.querySelector(value) != null;
      if (found) {
        resolve(Date.now() - started);
        return;
      }
      if (Date.now() - started >= capped) {
        reject(
          new Error(
            `Timeout ${capped}ms: ${waitKind === 'text' ? 'testo' : 'selettore'} "${value}" non apparso.`,
          ),
        );
        return;
      }
      setTimeout(check, 250);
    };
    check();
  });
}

/** Hover sintetico: pointermove + mouseover/mouseenter (menu, tooltip). */
export function hoverElement(el: Element): void {
  if (el instanceof HTMLElement) {
    el.scrollIntoView?.({ block: 'center', behavior: 'instant' as ScrollBehavior });
  }
  const rect = el.getBoundingClientRect();
  const opts: MouseEventInit & { clientX: number; clientY: number } = {
    bubbles: true,
    cancelable: true,
    clientX: Math.round(rect.left + rect.width / 2),
    clientY: Math.round(rect.top + rect.height / 2),
  };
  el.dispatchEvent(new PointerEvent('pointermove', opts));
  el.dispatchEvent(new MouseEvent('mousemove', opts));
  el.dispatchEvent(new MouseEvent('mouseover', opts));
  el.dispatchEvent(new MouseEvent('mouseenter', { ...opts, bubbles: false }));
}
