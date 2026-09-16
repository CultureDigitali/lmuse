// Igiene del testo task: rimuove caratteri di controllo e zero-width
// (vettore di offuscamento per prompt injection) preservando a capo e tab.

const CONTROL_CHARS =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

/** Testo pulito per prompt e storage; stringhe vuote restano vuote. */
export function sanitizeTaskText(text: string): string {
  return text.replace(CONTROL_CHARS, '');
}
