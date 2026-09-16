// Policy di approvazione umana per le azioni sensibili dell'agente.
// Funzioni pure (testate): la runtime (attesa risposta panel) vive nel worker.

export type ApprovalPolicy = 'off' | 'sensitive' | 'all';

/** Tool di sola lettura: mai soggetti ad approval nemmeno con policy 'all'. */
const READONLY_TOOLS = new Set(['browser_snapshot', 'browser_tabs_list']);

export interface ApprovalContext {
  /** Domini già visitati in questo run (per capire se un dominio è "nuovo"). */
  seenDomains: string[];
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
    if (domain && !ctx.seenDomains.includes(domain)) {
      return { needed: true, reason: `Navigazione verso un dominio nuovo: ${domain}` };
    }
    return { needed: false, reason: '' };
  }
  if (toolName === 'browser_tab_focus') {
    return { needed: true, reason: 'Cambio di tab' };
  }
  return { needed: false, reason: '' };
}

const RUN_COOLDOWN_MS = 5_000;

/** Anti-doppio-click: un RUN ogni 5s (S111). */
export function canStartRun(lastStartedAt: number | null, now: number): boolean {
  if (lastStartedAt == null) return true;
  return now - lastStartedAt >= RUN_COOLDOWN_MS;
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
