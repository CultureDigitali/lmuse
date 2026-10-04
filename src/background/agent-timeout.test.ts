import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { summarizeOutput, withTimeout } from './agent';

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

describe('riepilogo esito tool (regressione)', () => {
  // summarizeOutput non distingueva il fallimento: JSON.stringify(new Error())
  // vale "{}", quindi ogni errore di tool finiva nel log come "tool ✓" con corpo
  // vuoto e l'utente non vedeva mai che cosa era andato storto.
  it('un errore riporta il messaggio, non {}', () => {
    expect(summarizeOutput('browser_click', new Error('Ref scaduto'), true)).toBe('ERRORE: Ref scaduto');
  });
  it('un esito riuscito resta sintetizzato', () => {
    expect(summarizeOutput('browser_snapshot', { observation: 'x' })).toBe('snapshot aggiornato');
    expect(summarizeOutput('browser_screenshot', { captured: true })).toBe('screenshot acquisito');
  });
  it('errori non serializzabili non producono {}', () => {
    const circolare: Record<string, unknown> = {};
    circolare['self'] = circolare;
    expect(summarizeOutput('x', circolare, true)).toContain('ERRORE');
  });
});

describe('il contenuto degli appunti non finisce nel log', () => {
  // Difetto: summarizeOutput faceva JSON.stringify dell'output, quindi
  // l'osservazione di browser_clipboard_read (con il testo degli appunti)
  // compariva nel log dei passi, che l'utente può esportare come .md.
  it('browser_clipboard_read registra solo la lettura, non il testo', () => {
    const out = summarizeOutput('browser_clipboard_read', {
      observation: 'Appunti: "password segreta-123"',
    });
    expect(out).toBe('appunti letti');
    expect(out).not.toContain('segreta');
  });

  it('gli altri tool continuano a riassumere l’output', () => {
    expect(summarizeOutput('browser_click', { observation: 'Click eseguito' })).toContain('Click');
  });
});
