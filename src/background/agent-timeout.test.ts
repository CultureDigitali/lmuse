import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withTimeout } from './agent';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('withTimeout', () => {
  it('propaga abort utente', () => {
    const user = new AbortController();
    const { signal, dispose } = withTimeout(user.signal, 60_000);
    expect(signal.aborted).toBe(false);
    user.abort(new Error('stop'));
    expect(signal.aborted).toBe(true);
    dispose();
  });
  it('scatta TimeoutError dopo il timeout', () => {
    const user = new AbortController();
    const { signal, dispose } = withTimeout(user.signal, 1000);
    vi.advanceTimersByTime(1001);
    expect(signal.aborted).toBe(true);
    expect((signal.reason as Error)?.name).toBe('TimeoutError');
    dispose();
  });
  it('dispose cancella il timer', () => {
    const user = new AbortController();
    const { signal, dispose } = withTimeout(user.signal, 1000);
    dispose();
    vi.advanceTimersByTime(5000);
    expect(signal.aborted).toBe(false);
  });
  it('segnale già abortito → subito abortito', () => {
    const user = new AbortController();
    user.abort();
    const { signal, dispose } = withTimeout(user.signal, 60_000);
    expect(signal.aborted).toBe(true);
    dispose();
  });
});
