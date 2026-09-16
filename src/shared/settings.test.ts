import { describe, expect, it } from 'vitest';
import {
  buildHistoryList,
  DEFAULT_SETTINGS,
  mergeUsage,
  normalizeDomainsCsv,
  PanelToSwSchema,
  sanitizeSettings,
  sanitizeUsage,
} from './settings';

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
  it('nuovi campi: approval enum, default sensitive', () => {
    expect(sanitizeSettings({}).approval).toBe('sensitive');
    expect(sanitizeSettings({ approval: 'all' }).approval).toBe('all');
    expect(sanitizeSettings({ approval: 'x' as never }).approval).toBe('sensitive');
    expect(sanitizeSettings({}).privacyHostOnly).toBe(false);
    expect(sanitizeSettings({}).keepHistory).toBe(true);
    expect(sanitizeSettings({ keepHistory: false }).keepHistory).toBe(false);
  });
  it('allowedDomains normalizzato', () => {
    expect(sanitizeSettings({ allowedDomains: ' B.IT ,a.com ' }).allowedDomains).toBe('b.it, a.com');
    expect(normalizeDomainsCsv('')).toBe('');
  });
});

describe('buildHistoryList', () => {
  it('dedup + cap 20, nuovo in testa', () => {
    expect(buildHistoryList(['b', 'a'], 'a')).toEqual(['a', 'b']);
    const long = Array.from({ length: 25 }, (_, i) => `t${i}`);
    expect(buildHistoryList(long, 'new')).toHaveLength(20);
    expect(buildHistoryList(long, 'new')[0]).toBe('new');
  });
});

describe('mergeUsage/sanitizeUsage', () => {
  it('somma run e token, ignora negativi/NaN', () => {
    const m = mergeUsage(
      { runs: 2, inputTokens: 100, outputTokens: 50 },
      { inputTokens: 10, outputTokens: -5 },
    );
    expect(m).toEqual({ runs: 3, inputTokens: 110, outputTokens: 50 });
  });
  it('sanitize su dati corrotti', () => {
    expect(sanitizeUsage(undefined)).toEqual({ runs: 0, inputTokens: 0, outputTokens: 0 });
    expect(sanitizeUsage({ runs: -2 } as never)).toEqual({ runs: 0, inputTokens: 0, outputTokens: 0 });
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
  it('accetta APPROVE/DENY con id, rifiuta senza id', () => {
    expect(PanelToSwSchema.safeParse({ type: 'APPROVE', id: 'a1' }).success).toBe(true);
    expect(PanelToSwSchema.safeParse({ type: 'DENY', id: 'a1' }).success).toBe(true);
    expect(PanelToSwSchema.safeParse({ type: 'APPROVE', id: '' }).success).toBe(false);
    expect(PanelToSwSchema.safeParse({ type: 'APPROVE' }).success).toBe(false);
  });
});
