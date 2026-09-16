import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings } from './settings';
import { exportProfile, validateProfile } from './profile';

describe('exportProfile', () => {
  it('roundtrip senza chiave', () => {
    const exported = exportProfile({ ...DEFAULT_SETTINGS, model: 'x' });
    expect(exported.app).toBe('lmuse');
    expect(exported.settings.model).toBe('x');
    expect('apiKey' in exported.settings).toBe(false);
    const back = validateProfile(JSON.parse(JSON.stringify(exported)));
    expect(back.model).toBe('x');
  });
  it('scarta campo chiave contrabbandato', () => {
    const evil = { app: 'lmuse', settings: { ...DEFAULT_SETTINGS, apiKey: 'sk-live-123' } };
    const back = validateProfile(evil);
    expect('apiKey' in back).toBe(false);
  });
  it('anti __proto__ e shape invalide', () => {
    expect(() => validateProfile(JSON.parse('{"app":"lmuse","settings":{"__proto__":{}}}'))).not.toThrow();
    expect(validateProfile({ app: 'lmuse', settings: {} }).providerId).toBe('openai');
    expect(() => validateProfile(null)).toThrow(/Formato/);
    expect(() => validateProfile({ app: 'altro', settings: {} })).toThrow(/Formato/);
    expect(() => validateProfile('stringa')).toThrow(/Formato/);
    expect(sanitizeSettings(JSON.parse('{"__proto__":{"x":1}}') as never).providerId).toBe('openai');
  });
  it('rifiuta file giganti', () => {
    expect(() => validateProfile({ app: 'lmuse', settings: { model: 'x'.repeat(200_000) } })).toThrow(
      /grande/,
    );
  });
});
