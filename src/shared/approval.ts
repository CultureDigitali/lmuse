// Policy di approvazione umana per le azioni sensibili dell'agente.
// Funzioni pure (testate): la runtime (attesa risposta panel) vive nel worker.

export type ApprovalPolicy = 'off' | 'sensitive' | 'all';

/** Tool di sola lettura/passivi: mai soggetti ad approval nemmeno con policy 'all'. */
const READONLY_TOOLS = new Set([
  'browser_snapshot',
  'browser_iframe_snapshot',
  'browser_tabs_list',
  'browser_wait',
]);

export interface ApprovalContext {
  /** Domini già visitati in questo run (per capire se un dominio è "nuovo"). */
  seenDomains: string[];
  /** Domini fidati dall'utente: mai domanda di navigazione. */
  trustedDomains: string[];
}

/**
 * Match dominio fidato: esatto o sottodominio (stessa semantica dell'allowlist).
 * Il confronto è case-insensitive; voci vuote ignorate.
 */
export function isTrustedDomain(host: string, trusted: string[]): boolean {
  const h = host.trim().toLowerCase();
  if (!h) return false;
  return trusted
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
    .some((d) => h === d || h.endsWith(`.${d}`));
}

export interface ApprovalDecision {
  needed: boolean;
  /** Motivo in chiaro mostrato nel banner di approvazione. */
  reason: string;
}

/** Estrae l'hostname minuscolo da un URL, null se non valido. */
export function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function toolArgs(record: unknown): Record<string, unknown> {
  return record != null && typeof record === 'object' ? (record as Record<string, unknown>) : {};
}

/**
 * Nomi dei parametri URL che possono trasportare dati verso l'esterno
 * (token di sessione, chiavi, codici). Stessa famiglia di URL_TOKEN in pii.ts.
 */
const SENSITIVE_QUERY_PARAM =
  /(token|^key$|^auth|secret|api[-_]?key|session|^sid$|^code$|access[_-]?token|password|credential)/i;

/**
 * True se la query string dell'URL contiene dati potenzialmente sensibili:
 * un parametro con nome sospetto o un valore insolitamente lungo (base64/blob).
 * Serve a chiudere il canale di exfiltration "naviga verso il dominio già
 * approvato portandosi dietro i dati nella query": senza questo check bastava
 * un solo consenso a inizio run per aprire un canale in uscita silenzioso.
 */
export function hasSensitiveQuery(url: string): boolean {
  try {
    const params = new URL(url).searchParams;
    for (const [name, value] of params) {
      if (SENSITIVE_QUERY_PARAM.test(name)) return true;
      if (value.length > 80) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Decide se un tool richiede approvazione umana.
 * Safety floor (vale anche con policy 'off'): invio di form.
 */
export function shouldApprove(
  toolName: string,
  args: unknown,
  policy: ApprovalPolicy,
  ctx: ApprovalContext,
): ApprovalDecision {
  const input = toolArgs(args);

  // Safety floor: un click può inviare un form, eliminare dati o fare acquisti.
  // Il flag submit del solo browser_type NON copriva questi casi.
  if (toolName === 'browser_click') {
    return { needed: true, reason: 'Click su elemento (può inviare o eliminare dati)' };
  }
  if (toolName === 'browser_type') {
    return {
      needed: true,
      reason: input['submit'] === true ? 'Digitazione e invio form' : 'Digitazione in pagina',
    };
  }
  if (policy === 'off') return { needed: false, reason: '' };
  if (policy === 'all' && !READONLY_TOOLS.has(toolName)) {
    return { needed: true, reason: `Azione "${toolName}" (policy: approva tutto)` };
  }
  if (policy === 'all') return { needed: false, reason: '' };

  // policy 'sensitive'
  if (toolName === 'browser_navigate' && typeof input['url'] === 'string') {
    const domain = extractDomain(input['url']);
    // Navigare con dati nella query verso un dominio già visto fidato resta un
    // canale in uscita: chiedere sempre, anche sul dominio già approvato.
    if (hasSensitiveQuery(input['url'])) {
      return { needed: true, reason: 'Navigazione con dati potenzialmente sensibili nell’URL' };
    }
    if (domain && !ctx.seenDomains.includes(domain) && !isTrustedDomain(domain, ctx.trustedDomains)) {
      return { needed: true, reason: `Navigazione verso un dominio nuovo: ${domain}` };
    }
    return { needed: false, reason: '' };
  }
  if (toolName === 'browser_back' || toolName === 'browser_forward') {
    // back/forward navigano verso qualunque dominio della cronologia del tab:
    // senza questo check erano l'unico modo di cambiare dominio senza conferma.
    return { needed: true, reason: 'Navigazione nella cronologia (il dominio di arrivo può cambiare)' };
  }
  if (toolName === 'browser_tab_focus') {
    return { needed: true, reason: 'Cambio di tab' };
  }
  if (toolName === 'browser_select') {
    return { needed: true, reason: 'Modifica di un menu a tendina' };
  }
  if (toolName === 'browser_reload') {
    return { needed: true, reason: 'Ricarica pagina (perde lo stato dei form)' };
  }
  if (toolName === 'browser_clipboard_write' || toolName === 'browser_tab_close') {
    return {
      needed: true,
      reason: toolName === 'browser_tab_close' ? 'Chiusura scheda' : 'Modifica appunti',
    };
  }
  if (toolName === 'browser_download') {
    return { needed: true, reason: 'Download di un file dal sito' };
  }
  if (toolName === 'browser_screenshot' || toolName === 'browser_screenshot_element') {
    return { needed: true, reason: 'Invio di una schermata della pagina al modello' };
  }
  if (toolName === 'browser_drag') {
    return { needed: true, reason: 'Trascinamento di un elemento (può riordinare o spostare dati)' };
  }
  if (toolName === 'browser_clipboard_read') {
    return { needed: true, reason: 'Lettura degli appunti (può contenere dati personali)' };
  }
  if (toolName === 'browser_clipboard_write') {
    // Scrivere negli appunti è il classico clipboard-swap: il contenuto
    // sostituito viene incollato altrove dall'utente. Simmetrico alla lettura.
    return { needed: true, reason: 'Scrittura negli appunti (sostituisce ciò che hai copiato)' };
  }
  return { needed: false, reason: '' };
}

const RUN_COOLDOWN_MS = 5_000;
const UNATTENDED_APPROVAL_SEC = 20;

/** Anti-doppio-click: un RUN ogni 5s (S111). */
export function canStartRun(lastStartedAt: number | null, now: number): boolean {
  if (lastStartedAt == null) return true;
  return now - lastStartedAt >= RUN_COOLDOWN_MS;
}

/**
 * Timeout conferma: 20s secchi quando nessuno può rispondere (panel chiuso),
 * altrimenti il setting utente. Mai auto-approve: il timeout nega sempre.
 */
export function approvalTimeoutFor(audience: 'panel' | 'unattended', settingSec: number): number {
  if (audience === 'unattended') return UNATTENDED_APPROVAL_SEC;
  return settingSec;
}

/** Sanity check chiave: evita di avviare run con placeholder corti ("test", "abc"). */
export function isPlausibleKey(key: string): boolean {
  return key.trim().length >= 8;
}

/** "12s", "3m 05s", "1h 02m" per il footer run. */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
