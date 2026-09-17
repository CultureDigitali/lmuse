import { describe, expect, it } from 'vitest';
import { createModel } from './providers';
import { PROVIDERS, DEFAULT_SETTINGS, sanitizeSettings } from '../shared/settings';

function settingsFor(providerId: string, extra: Record<string, unknown> = {}) {
  return sanitizeSettings({ providerId, model: 'test-model', ...extra } as never);
}

describe('createModel', () => {
  it('crea un modello per OGNI provider del catalogo (cloud/gateway)', () => {
    for (const p of PROVIDERS) {
      if (p.id === 'azure' || p.id === 'custom') continue; // richiedono baseUrl
      const model = createModel(settingsFor(p.id, { model: p.defaultModel || 'test-model' }), 'dummy-key');
      expect(model).toBeDefined();
      expect(typeof (model as { provider?: string }).provider).toBe('string');
    }
  });

  it('azure senza baseUrl → errore in italiano', () => {
    expect(() => createModel(settingsFor('azure'), 'k')).toThrow(/base URL/);
  });

  it('custom senza baseUrl → errore in italiano', () => {
    expect(() => createModel(settingsFor('custom'), 'k')).toThrow(/base URL/);
  });

  it('custom con baseUrl → ok', () => {
    const m = createModel(settingsFor('custom', { baseUrl: 'https://api.esempio.it/v1' }), 'k');
    expect(String((m as { provider?: string }).provider)).toContain('custom');
  });

  it('ollama senza chiave usa placeholder', () => {
    const m = createModel(settingsFor('ollama'), '');
    expect(m).toBeDefined();
  });

  it('modello vuoto → errore', () => {
    expect(() => createModel(settingsFor('openai', { model: '' }), 'k')).toThrow(/modello/);
  });

  it('provider con baseURL override rispetta il baseUrl utente', () => {
    const m = createModel(settingsFor('nvidia', { baseUrl: 'https://nim.lan/v1' }), 'k');
    expect(m).toBeDefined();
  });

  it('sanitizer accetta tutti i nuovi providerId', () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(ids).toHaveLength(25);
    for (const id of ids) {
      expect(sanitizeSettings({ providerId: id }).providerId).toBe(id);
    }
  });

  it('DEFAULT_SETTINGS resta valido', () => {
    expect(DEFAULT_SETTINGS.providerId).toBe('openai');
  });
});

describe('catalogo provider', () => {
  it('ogni provider cloud/gateway con needsKey ha keyUrl', () => {
    for (const p of PROVIDERS) {
      if (p.needsKey && p.id !== 'azure') {
        expect(p.keyUrl, p.id).toMatch(/^https:\/\//);
      }
    }
  });

  it('gruppi validi e coerenti', () => {
    const local = PROVIDERS.filter((p) => p.group === 'local').map((p) => p.id);
    expect(local).toEqual(['ollama', 'lmstudio', 'custom']);
    const gateway = PROVIDERS.filter((p) => p.group === 'gateway').map((p) => p.id);
    expect(gateway).toContain('openrouter');
    expect(gateway).toContain('opencode');
    expect(gateway).toContain('github');
    expect(gateway).toContain('gateway');
  });

  it('opencodeId presente sui provider mappabili', () => {
    const withOc = PROVIDERS.filter((p) => p.opencodeId).map((p) => p.id);
    expect(withOc).toContain('nvidia');
    expect(withOc).toContain('opencode');
    expect(withOc).toContain('openai');
    expect(withOc.length).toBeGreaterThanOrEqual(10);
  });
});
