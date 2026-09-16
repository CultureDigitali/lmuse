import { describe, expect, it } from 'vitest';
import { formatNextRun, validateSchedule } from './schedules';

describe('validateSchedule', () => {
  it('ok con dati validi', () => {
    const r = validateSchedule('  controlla prezzo  ', 1440, 0);
    expect(r).toEqual({ ok: true, task: 'controlla prezzo' });
  });
  it('rifiuta task vuoto, intervallo fuori range, troppi', () => {
    expect(validateSchedule('   ', 60, 0).ok).toBe(false);
    expect(validateSchedule('x', 30, 0).ok).toBe(false);
    expect(validateSchedule('x', 60.5, 0).ok).toBe(false);
    expect(validateSchedule('x', 20000, 0).ok).toBe(false);
    expect(validateSchedule('x', 60, 5).ok).toBe(false);
    expect(validateSchedule('x', 60, 4).ok).toBe(true);
  });
  it('pulisce control chars e tronca a 4000', () => {
    const r = validateSchedule('a\u200Bb' + 'x'.repeat(5000), 60, 0);
    expect(r.task).toHaveLength(4000);
    expect(r.task).not.toContain('​');
  });
});

describe('formatNextRun', () => {
  it('minuti, ore, giorni', () => {
    expect(formatNextRun(null, 25, 0)).toBe('tra 25m');
    expect(formatNextRun(0, 190, 0)).toBe('tra 3h 10m');
    expect(formatNextRun(0, 3000, 0)).toBe('tra 2g');
    expect(formatNextRun(1000, 60, 5000)).toContain('tra');
  });
});
