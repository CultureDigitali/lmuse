import { describe, expect, it } from 'vitest';
import { LOCK_MIN_MINUTES, decideSessionLock, lockAlarmDelay } from './lock';

const NOW = 1_700_000_000_000;

describe('decideSessionLock', () => {
  it('auto-lock disattivato (0) → mai blocca', () => {
    const ancient = NOW - 10 * 60_000;
    expect(decideSessionLock(ancient, 0, NOW)).toEqual({ lock: false, retryInMin: 0 });
  });

  it('sotto la soglia minima → mai blocca (alarms non affidabili)', () => {
    const ancient = NOW - 60 * 60_000;
    expect(decideSessionLock(ancient, LOCK_MIN_MINUTES - 1, NOW).lock).toBe(false);
  });

  it('nessuna attività registrata → non blocca', () => {
    expect(decideSessionLock(null, 30, NOW)).toEqual({ lock: false, retryInMin: 0 });
  });

  it('inattività oltre la soglia → blocca', () => {
    expect(decideSessionLock(NOW - 31 * 60_000, 30, NOW).lock).toBe(true);
  });

  it('esattamente alla soglia → blocca', () => {
    expect(decideSessionLock(NOW - 30 * 60_000, 30, NOW).lock).toBe(true);
  });

  it('ancora attivo → non blocca e riprova più avanti', () => {
    const d = decideSessionLock(NOW - 10 * 60_000, 30, NOW);
    expect(d.lock).toBe(false);
    expect(d.retryInMin).toBe(20);
  });

  it('retryInMin mai sotto 1', () => {
    expect(decideSessionLock(NOW - 29.5 * 60_000, 30, NOW).retryInMin).toBe(1);
  });

  it('attività futura (orologio indietro) → non blocca', () => {
    expect(decideSessionLock(NOW + 60_000, 5, NOW).lock).toBe(false);
  });
});

describe('lockAlarmDelay', () => {
  it('null se disattivato o sotto la soglia minima', () => {
    expect(lockAlarmDelay(0)).toBeNull();
    expect(lockAlarmDelay(0.4)).toBeNull();
  });

  it('periodo = lockMin se attivo', () => {
    expect(lockAlarmDelay(15)).toEqual({ periodInMinutes: 15 });
    expect(lockAlarmDelay(1)).toEqual({ periodInMinutes: 1 });
  });
});
