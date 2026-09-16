// Policy di approvazione umana per le azioni sensibili dell'agente.
// Funzioni pure (testate): la runtime (attesa risposta panel) vive nel worker.

export type ApprovalPolicy = 'off' | 'sensitive' | 'all';

/** Tool di sola lettura/passivi: mai soggetti ad approval nemmeno con policy 'all'. */
const READONLY_TOOLS = new Set(['browser_snapshot', 'browser_tabs_list', 'browser_wait']);

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

  if (toolName === 'browser_type' && input['submit'] === true) {
    return { needed: true, reason: 'Invio di un form (digita + Invio)' };
  }
  if (policy === 'off') return { needed: false, reason: '' };
  if (policy === 'all' && !READONLY_TOOLS.has(toolName)) {
    return { needed: true, reason: `Azione "${toolName}" (policy: approva tutto)` };
  }
  if (policy === 'all') return { needed: false, reason: '' };

  // policy 'sensitive'
  if (toolName === 'browser_navigate' && typeof input['url'] === 'string') {
    const domain = extractDomain(input['url']);
    if (domain && !ctx.seenDomains.includes(domain) && !isTrustedDomain(domain, ctx.trustedDomains)) {
      return { needed: true, reason: `Navigazione verso un dominio nuovo: ${domain}` };
    }
    return { needed: false, reason: '' };
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
