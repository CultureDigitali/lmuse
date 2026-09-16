// Allowlist tasti per browser_press. Niente Invio/Spazio: potrebbero
// inviare form o attivare controlli (serve approval esplicita via type).

const PRESS_ALLOWLIST = new Set([
  'Escape',
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

export function isPressAllowed(key: string): boolean {
  return PRESS_ALLOWLIST.has(key);
}
