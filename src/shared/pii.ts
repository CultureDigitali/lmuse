// Redazione PII e token segreti: funzioni pure, testate in vitest.

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/g;
const IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,26}\b/g;
const CARD = /\b(?:\d{4}[ -]){3}\d{1,4}\b/g;
// 7-19 cifre con separatori opzionali (spazi, punti, trattini) e prefisso
// internazionale opzionale. Esegue DOPO iban/carte così quelli vincono.
// Trade-off voluto: meglio sovra-mascherare (es. decimali lunghe) che
// far trapelare un numero di telefono.
const PHONE = /(?:\+\d{1,3}[ .-]?)?\b\d(?:[ .-]?\d){6,18}\b/g;
const URL_TOKEN = /([?&](?:token|key|auth|secret|api[-_]?key|session|sid|code|access[_-]?token)=)[^&\s]+/gi;

export function maskUrlTokens(text: string): string {
  return text.replace(URL_TOKEN, '$1[redatto]');
}

export function maskEmails(text: string): string {
  return text.replace(EMAIL, '[email]');
}

export function maskIbans(text: string): string {
  return text.replace(IBAN, '[iban]');
}

export function maskCards(text: string): string {
  return text.replace(CARD, '[carta]');
}

export function maskPhones(text: string): string {
  return text.replace(PHONE, '[numero]');
}

/** Applica tutte le redazioni nell'ordine che minimizza i falsi positivi. */
export function maskPii(text: string): string {
  return maskPhones(maskCards(maskIbans(maskEmails(maskUrlTokens(text)))));
}
