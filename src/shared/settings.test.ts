import { describe, expect, it } from 'vitest';
import {
  buildHistoryList,
  buildLastRuns,
  buildPromptList,
  DEFAULT_SETTINGS,
  mergeUsage,
  normalizeDomainsCsv,
  PanelToSwSchema,
  PRESETS,
  sanitizeDomainList,
  sanitizeSettings,
  sanitizeUsage,
  sanitizeTemplates,
  buildTemplateList,
  removeTemplate,
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
  it('privacy protetta di default e enum normalizzati', () => {
    expect(sanitizeSettings({}).approval).toBe('all');
    expect(sanitizeSettings({ approval: 'all' }).approval).toBe('all');
    expect(sanitizeSettings({ approval: 'x' as never }).approval).toBe('all');
    expect(sanitizeSettings({}).privacyMode).toBe('strict');
    expect(sanitizeSettings({ privacyMode: 'pseudonymize' }).privacyMode).toBe('pseudonymize');
    expect(sanitizeSettings({ privacyMode: 'off' }).privacyMode).toBe('off');
    expect(sanitizeSettings({ privacyMode: 'bad' as never }).privacyMode).toBe('strict');
    expect(sanitizeSettings({}).privacyHostOnly).toBe(true);
    expect(sanitizeSettings({}).keepHistory).toBe(false);
    expect(sanitizeSettings({}).rememberKey).toBe(false);
    expect(sanitizeSettings({}).sendScreenshots).toBe(false);
    expect(sanitizeSettings({ keepHistory: false }).keepHistory).toBe(false);
  });
  it('allowedDomains normalizzato', () => {
    expect(sanitizeSettings({ allowedDomains: ' B.IT ,a.com ' }).allowedDomains).toBe('b.it, a.com');
    expect(normalizeDomainsCsv('')).toBe('');
  });
  it('nuovi campi loop-3 con default e clamp', () => {
    const s = sanitizeSettings({});
    expect(s.trustedDomains).toEqual([]);
    expect(s.templates).toEqual([]);
    expect(s.theme).toBe('auto');
    expect(s.locale).toBe('auto');
    expect(s.approvalTimeoutSec).toBe(120);
    expect(s.snapshotMaxChars).toBe(DEFAULT_SETTINGS.snapshotMaxChars);
    expect(sanitizeSettings({ approvalTimeoutSec: 9 }).approvalTimeoutSec).toBe(30);
    expect(sanitizeSettings({ snapshotMaxChars: 99999 }).snapshotMaxChars).toBe(20000);
    expect(sanitizeSettings({ theme: 'neon' as never }).theme).toBe('auto');
    expect(sanitizeSettings({ trustedDomains: [' B.it ', 'b.it', ''] }).trustedDomains).toEqual(['b.it']);
    expect(sanitizeDomainList('nope')).toEqual([]);
  });
  it('preset con id unici', () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('fast');
    expect(ids).toContain('free');
  });
  it('freeOnly: default true, disattivabile esplicitamente', () => {
    expect(sanitizeSettings({}).freeOnly).toBe(true);
    expect(sanitizeSettings({ freeOnly: false }).freeOnly).toBe(false);
  });
  it('preset free: openrouter/free con freeOnly', () => {
    const free = PRESETS.find((p) => p.id === 'free');
    expect(free?.patch.providerId).toBe('openrouter');
    expect(free?.patch.model).toBe('openrouter/free');
    expect(free?.patch.freeOnly).toBe(true);
  });
});

describe('buildPromptList', () => {
  it('trim, truncate, dedup, cap', () => {
    expect(buildPromptList([], '  ciao  ')).toEqual(['ciao']);
    expect(buildPromptList(['a'], '')).toEqual(['a']);
    const long = Array.from({ length: 25 }, (_, i) => `p${i}`);
    const out = buildPromptList(long, 'new');
    expect(out).toHaveLength(20);
    expect(out[0]).toBe('new');
    expect(buildPromptList([], 'x'.repeat(400))[0]).toHaveLength(300);
  });
});

describe('modelli di task', () => {
  it('sanitize: oggetti validi, cap 20, testo obbligatorio', () => {
    const out = sanitizeTemplates([
      { id: 'a', name: 'Riassunto', text: 'Riassumi la pagina' },
      { id: 'b', name: '', text: 'Senza nome' },
      { id: 'c', name: 'Vuoto', text: '   ' },
      'spazzatura',
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe('Riassunto');
    expect(out[1].name).toBe('Senza nome');
    expect(
      sanitizeTemplates(Array.from({ length: 25 }, (_, i) => ({ id: `i${i}`, text: `t${i}` }))),
    ).toHaveLength(20);
  });
  it('migrazione da savedPrompts (stringhe) → templates', () => {
    const s = sanitizeSettings({ savedPrompts: ['Riassumi questa pagina', 'Confronta i prezzi'] } as never);
    expect(s.templates).toHaveLength(2);
    expect(s.templates[0].text).toBe('Riassumi questa pagina');
    expect(s.templates[0].name).toBe('Riassumi questa pagina');
  });
  it('buildTemplateList: nome fallback, cap FIFO, testo vuoto ignorato', () => {
    let list = buildTemplateList([], { name: '', text: '  Fai qualcosa  ' });
    expect(list[0].name).toBe('Fai qualcosa');
    expect(list[0].text).toBe('Fai qualcosa');
    expect(buildTemplateList(list, { name: 'x', text: '   ' })).toHaveLength(1);
    for (let i = 0; i < 25; i++) list = buildTemplateList(list, { name: `n${i}`, text: `t${i}` });
    expect(list).toHaveLength(20);
    expect(list[list.length - 1].name).toBe('n24');
  });
  it('removeTemplate elimina solo per id', () => {
    const list = sanitizeTemplates([
      { id: 'a', name: 'A', text: 'uno' },
      { id: 'b', name: 'B', text: 'due' },
    ]);
    expect(removeTemplate(list, 'a').map((t) => t.id)).toEqual(['b']);
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

describe('buildLastRuns', () => {
  it('tronca task + cap 10', () => {
    const entry = { task: 'x'.repeat(500), at: 1, steps: 3, tokens: 99 };
    const out = buildLastRuns([], entry);
    expect(out[0].task).toHaveLength(200);
    expect(out[0].tokens).toBe(99);
    const long = Array.from({ length: 12 }, (_, i) => ({ task: `t${i}`, at: i, steps: 1, tokens: 1 }));
    expect(buildLastRuns(long, entry)).toHaveLength(10);
  });
});

describe('nuovi campi loop-4', () => {
  it('default e clamp', () => {
    const s = sanitizeSettings({});
    expect(s.maxTokensPerRun).toBe(60000);
    expect(s.stopText).toBe('');
    expect(s.soundOnDone).toBe(false);
    expect(s.compactLog).toBe(false);
    expect(s.lastRuns).toEqual([]);
    expect(s.schedules).toEqual([]);
    expect(sanitizeSettings({ maxTokensPerRun: 5 }).maxTokensPerRun).toBe(1000);
    expect(sanitizeSettings({ maxTokensPerRun: 9999999 }).maxTokensPerRun).toBe(200000);
    expect(sanitizeSettings({ stopText: '  X  ' }).stopText).toBe('X');
  });
  it('lastRuns/schedules malformati filtrati', () => {
    const s = sanitizeSettings({
      lastRuns: [{ task: 'ok', at: 1, steps: 2, tokens: 3 }, 'spazzatura', { no: 1 }] as never,
      schedules: [
        { id: 'a', task: 't', intervalMin: 60, enabled: true, createdAt: 0 },
        { id: 'b', task: 't', intervalMin: 5 },
        'spazzatura',
      ] as never,
    });
    expect(s.lastRuns).toHaveLength(1);
    expect(s.schedules).toHaveLength(1);
    expect(s.schedules[0].id).toBe('a');
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
