import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, PanelToSwSchema, sanitizeSettings } from './settings';

describe('sanitizeSettings', () => {
  it('clampa i numerici nei range', () => {
    const s = sanitizeSettings({ maxSteps: 999, maxRetries: -5, runTimeoutMin: 500 });
    expect(s.maxSteps).toBe(100);
    expect(s.maxRetries).toBe(0);
    expect(s.runTimeoutMin).toBe(120);
  });
  it('fallback su valori non numerici', () => {
    const s = sanitizeSettings({ maxSteps: NaN });
    expect(s.maxSteps).toBe(DEFAULT_SETTINGS.maxSteps);
  });
  it('provider sconosciuto → openai', () => {
    const s = sanitizeSettings({ providerId: 'fantasma' as never });
    expect(s.providerId).toBe('openai');
  });
  it('trim e limiti sulle stringhe', () => {
    const s = sanitizeSettings({ model: '  gpt-x  ', baseUrl: 'https://a.test/' });
    expect(s.model).toBe('gpt-x');
  });
  it('booleani normalizzati', () => {
    const s = sanitizeSettings({ privacyMaskPii: 0 as unknown as boolean });
    expect(s.privacyMaskPii).toBe(false);
  });
});

describe('PanelToSwSchema', () => {
  it('accetta RUN valido', () => {
    expect(PanelToSwSchema.safeParse({ type: 'RUN', task: 'ciao' }).success).toBe(true);
  });
  it('rifiuta task vuoto o troppo lungo', () => {
    expect(PanelToSwSchema.safeParse({ type: 'RUN', task: '' }).success).toBe(false);
    expect(PanelToSwSchema.safeParse({ type: 'RUN', task: 'x'.repeat(4001) }).success).toBe(false);
  });
  it('accetta STOP, rifiuta tipi ignoti', () => {
    expect(PanelToSwSchema.safeParse({ type: 'STOP' }).success).toBe(true);
    expect(PanelToSwSchema.safeParse({ type: 'NUKE' }).success).toBe(false);
  });
});
