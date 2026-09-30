// Auto-lock chiave di sessione: dopo N minuti di INATTIVITÀ del pannello la
// chiave in session storage viene cancellata. Logica pura qui (testata),
// orchestration nel worker.
//
// Chrome alarms ha granularità di 1 minuto: l'alarm da solo non distingue
// "sessione viva" da "utente assente", quindi confrontiamo l'orario
// dell'ultima attività registrata dal pannello.

export const ACTIVITY_KEY = 'lmuse.activity.v1';
export const LOCK_ALARM = 'lmuse-lock';

/** Soglia minima: sotto 1 minuto chrome.alarms non è affidabile. */
export const LOCK_MIN_MINUTES = 1;

export interface LockDecision {
  /** true se la chiave va cancellata ora. */
  lock: boolean;
  /** Minuti mancanti prima del prossimo controllo (0 = controller subito). */
  retryInMin: number;
}

/**
 * Decide se la chiave di sessione va bloccata.
 * - lastActivity null  → nessuna attività mai registrata: non bloccare (non sappiamo).
 * - scaduto             → blocca.
 * - ancora valido        → non bloccare, riprova più avanti.
 */
export function decideSessionLock(lastActivity: number | null, lockMin: number, now: number): LockDecision {
  if (lockMin < LOCK_MIN_MINUTES) return { lock: false, retryInMin: 0 };
  if (lastActivity == null) return { lock: false, retryInMin: 0 };
  const idleMin = (now - lastActivity) / 60_000;
  if (idleMin >= lockMin) return { lock: true, retryInMin: 0 };
  return { lock: false, retryInMin: Math.max(1, Math.ceil(lockMin - idleMin)) };
}

/** L'alarm di lock va (ri)programmato solo se l'auto-lock è attivo. */
export function lockAlarmDelay(lockMin: number): { periodInMinutes: number } | null {
  if (lockMin < LOCK_MIN_MINUTES) return null;
  return { periodInMinutes: Math.max(1, lockMin) };
}
