import { describe, expect, it } from 'vitest';
import {
  bridgeErrorKey,
  BridgePayloadSchema,
  mapBridgeCredentials,
  matchBridgeProviders,
} from './opencode';

describe('BridgePayloadSchema', () => {
  it('accetta ping/list/export validi', () => {
    expect(BridgePayloadSchema.safeParse({ ok: true, version: 1 }).success).toBe(true);
    expect(
      BridgePayloadSchema.safeParse({ ok: true, providers: [{ id: 'nvidia', type: 'api' }] }).success,
    ).toBe(true);
    expect(
      BridgePayloadSchema.safeParse({ ok: true, credentials: [{ id: 'x', key: 'k'.repeat(5) }] }).success,
    ).toBe(true);
  });
  it('accetta errori strutturati', () => {
    expect(BridgePayloadSchema.safeParse({ ok: false, error: 'auth-json-missing' }).success).toBe(true);
  });
  it('rifiuta schifezze', () => {
    expect(BridgePayloadSchema.safeParse('nope').success).toBe(false);
    expect(BridgePayloadSchema.safeParse({ ok: true, credentials: [{ id: '', key: '' }] }).success).toBe(
      false,
    );
    expect(
      BridgePayloadSchema.safeParse({ ok: true, credentials: [{ id: 'x', key: 'k'.repeat(5000) }] })
        .success,
    ).toBe(false);
  });
});

describe('mapBridgeCredentials', () => {
  it('mappa id opencode noti, ignora gli altri', () => {
    const out = mapBridgeCredentials([
      { id: 'nvidia', key: 'nv-key-xxxxx' },
      { id: 'sconosciuto', key: 'no' },
      { id: 'opencode', key: 'oc-key-yyyyy' },
    ]);
    expect(out.nvidia).toBe('nv-key-xxxxx');
    expect(out.opencode).toBe('oc-key-yyyyy');
    expect(Object.keys(out)).not.toContain('sconosciuto');
  });
  it('non sovrascrive con duplicati successivi', () => {
    const out = mapBridgeCredentials([
      { id: 'nvidia', key: 'primo' },
      { id: 'nvidia', key: 'secondo' },
    ]);
    expect(out.nvidia).toBe('primo');
  });
  it('array vuoto → oggetto vuoto', () => {
    expect(mapBridgeCredentials([])).toEqual({});
  });
});

describe('matchBridgeProviders', () => {
  it('trova i provider lmuse da lista id opencode', () => {
    const found = matchBridgeProviders(['nvidia', 'openai', 'ignoto']);
    expect(found).toContain('nvidia');
    expect(found).toContain('openai');
    expect(found).not.toContain('ignoto');
  });
});

describe('bridgeErrorKey', () => {
  it('mappa codici noti, fallback generico', () => {
    expect(bridgeErrorKey('auth-json-missing')).toBe('opencode_err_no_auth');
    expect(bridgeErrorKey('bad-json')).toBe('opencode_err_protocol');
    expect(bridgeErrorKey('qualcosa-di-nuovo')).toBe('opencode_err_generic');
  });
});
