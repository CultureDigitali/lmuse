// Task programmati: validazione pura + label prossimo run.
// La runtime (chrome.alarms) vive nel worker; qui solo dati e regole.

import { sanitizeTaskText } from './task';

export interface Schedule {
  id: string;
  task: string;
  intervalMin: number;
  enabled: boolean;
  createdAt: number;
  lastFire?: number;
}

export const SCHEDULE_MAX = 5;
export const SCHEDULE_MIN_MIN = 60;
export const SCHEDULE_MAX_MIN = 10080;

export interface ScheduleCheck {
  ok: boolean;
  error?: string;
  task?: string;
}

/** Valida un nuovo schedule (pura, testata). */
export function validateSchedule(task: string, intervalMin: number, existingCount: number): ScheduleCheck {
  const clean = sanitizeTaskText(task.trim()).slice(0, 4000);
  if (!clean) return { ok: false, error: 'Task vuoto.' };
  if (!Number.isInteger(intervalMin) || intervalMin < SCHEDULE_MIN_MIN || intervalMin > SCHEDULE_MAX_MIN) {
    return { ok: false, error: `Intervallo 60–10080 minuti (1h–7gg).` };
  }
  if (existingCount >= SCHEDULE_MAX) return { ok: false, error: 'Max 5 task programmati.' };
  return { ok: true, task: clean };
}

/** "tra 25m", "tra 3h 10m", "tra 2g". */
export function formatNextRun(lastFireMs: number | null, intervalMin: number, now: number): string {
  const nextIn = Math.max(0, (lastFireMs ?? now) + intervalMin * 60_000 - now);
  const mins = Math.ceil(nextIn / 60_000);
  if (mins < 60) return `tra ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `tra ${hours}h ${String(mins % 60).padStart(2, '0')}m`;
  return `tra ${Math.floor(hours / 24)}g`;
}
