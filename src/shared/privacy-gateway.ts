/**
 * Privacy Gateway: pseudonimi reversibili SOLO nel service worker, per singolo run.
 * Non salva la mappa in chrome.storage e non la invia al modello.
 *
 * Non è anonimizzazione universale: nomi, testi liberi, immagini e contenuti
 * non riconosciuti possono rivelare dati. Le immagini sono bloccate nelle
 * modalità protette (vedi tools.ts).
 */
export type PrivacyMode = 'off' | 'pseudonymize' | 'strict';

const TOKEN_RE = /\[LMUSE_[A-Z]+_[a-p]{24}\]/g;
const SUSPECT_TOKEN_RE = /\[LMUSE_[^\]\s]+\]/g;
const MAX_TEXT = 200_000;
const MAX_TOKENS = 5_000;

const PATTERNS: ReadonlyArray<{ kind: string; re: RegExp }> = [
  {
    kind: 'SECRET',
    re: /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{16,}|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{16,})\b/g,
  },
  {
    kind: 'AUTH',
    re: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/gi,
  },
  {
    kind: 'EMAIL',
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    kind: 'IBAN',
    re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/g,
  },
  {
    kind: 'CARD',
    re: /\b(?:\d{4}[ -]?){3}\d{4}\b/g,
  },
  {
    kind: 'PHONE',
    re: /(?<![A-Za-z0-9])(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3}[\s.-]?\d{4,6}(?![A-Za-z0-9])/g,
  },
];
const QUERY_SECRETS =
  /([?&](?:token|auth|secret|password|api[-_]?key|session|sid|access[_-]?token|refresh[_-]?token|code)=)([^&\s"'<>]+)/gi;

type Secret = { value: string; origin: string | null };

function toOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : null;
  } catch {
    return null;
  }
}

/** Identificatori casuali solo alfabetici: non collidono con regex di PII. */
function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const letters = 'abcdefghijklmnop';
  let result = '';
  for (const byte of bytes) result += letters[byte >> 4] + letters[byte & 15];
  return result;
}

export class PrivacyGateway {
  private readonly byToken = new Map<string, Secret>();
  private readonly byValue = new Map<string, string>();

  constructor(readonly mode: PrivacyMode) {}

  get size(): number {
    return this.byToken.size;
  }

  /** Pseudonimo stabile all'interno dello stesso origin e dello stesso run. */
  private replace(value: string, kind: string, sourceUrl?: string): string {
    const origin = toOrigin(sourceUrl);
    const key = JSON.stringify([origin, value]);
    const previous = this.byValue.get(key);
    if (previous) return previous;
    if (this.byToken.size >= MAX_TOKENS) throw new Error('Privacy Gateway: troppi valori sensibili.');
    let token: string;
    do {
      token = '[LMUSE_' + kind + '_' + randomId() + ']';
    } while (this.byToken.has(token));
    this.byToken.set(token, { value, origin });
    this.byValue.set(key, token);
    return token;
  }

  protectText(text: string, sourceUrl?: string): string {
    if (this.mode === 'off' || !text) return text;
    if (text.length > MAX_TEXT) throw new Error('Privacy Gateway: contenuto troppo grande, invio bloccato.');
    let result = text.replace(QUERY_SECRETS, (_match, prefix: string, value: string) =>
      prefix + this.replace(value, 'QUERY', sourceUrl),
    );
    for (const { kind, re } of PATTERNS) {
      result = result.replace(re, (value) => this.replace(value, kind, sourceUrl));
    }
    return result;
  }

  /** Protegge TUTTI i campi testuali di una risposta di tool (anche i nuovi tool). */
  protectUnknown<T>(value: T, sourceUrl?: string, depth = 0): T {
    if (this.mode === 'off') return value;
    if (depth > 12) throw new Error('Privacy Gateway: risultato troppo annidato.');
    if (typeof value === 'string') return this.protectText(value, sourceUrl) as T;
    if (Array.isArray(value)) {
      return value.map((item) => this.protectUnknown(item, sourceUrl, depth + 1)) as T;
    }
    if (value && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value)) {
        result[key] = this.protectUnknown(item, sourceUrl, depth + 1);
      }
      return result as T;
    }
    return value;
  }

  hasTokens(value: string): boolean {
    return /\[LMUSE_[^\]\s]+\]/.test(value);
  }

  /**
   * Solo verso l'origin dal quale il dato è stato osservato. Un testo
   * pseudonimizzato nel task o su un altro sito NON può essere scritto qui.
   * Un modello che inventa o modifica token provoca un errore, non un invio.
   */
  restoreForPage(text: string, destinationUrl: string): string {
    if (this.mode === 'off' || !this.hasTokens(text)) return text;
    const destination = toOrigin(destinationUrl);
    if (!destination) throw new Error('Privacy Gateway: destinazione non HTTP(S).');
    return text.replace(SUSPECT_TOKEN_RE, (token) => {
      const record = this.byToken.get(token);
      if (!record || !TOKEN_RE.test(token)) {
        TOKEN_RE.lastIndex = 0;
        throw new Error('Privacy Gateway: segnaposto non riconosciuto.');
      }
      TOKEN_RE.lastIndex = 0;
      if (record.origin !== destination) {
        throw new Error('Privacy Gateway: ripristino tra siti diversi non autorizzato.');
      }
      return record.value;
    });
  }

  /** Ripristino solo nel risultato rivolto all'utente, mai verso il provider. */
  restoreForUser(text: string): string {
    if (this.mode === 'off') return text;
    return text.replace(TOKEN_RE, (token) => this.byToken.get(token)?.value ?? token);
  }

  clear(): void {
    this.byToken.clear();
    this.byValue.clear();
  }
}
