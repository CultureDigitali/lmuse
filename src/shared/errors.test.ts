import { describe, expect, it } from 'vitest';
import { mapProviderError } from './errors';

describe('mapProviderError', () => {
  it('abort e timeout dedicati', () => {
    const abort = new DOMException('aborted', 'AbortError');
    expect(mapProviderError(abort)).toBe('Task fermato.');
    const timeout = new DOMException('x', 'TimeoutError');
    expect(mapProviderError(timeout)).toMatch(/timeout/i);
  });
  it('401/403 → chiave non valida', () => {
    expect(mapProviderError(new Error('Request failed 401'))).toMatch(/Chiave API/);
    expect(mapProviderError(new Error('invalid api key'))).toMatch(/Chiave API/);
  });
  it('429 → rate limit', () => {
    expect(mapProviderError(new Error('429 rate limit exceeded'))).toMatch(/Rate limit/);
  });
  it('5xx → errore server', () => {
    expect(mapProviderError(new Error('500 internal server error'))).toMatch(/server/);
  });
  it('modello inesistente', () => {
    expect(mapProviderError(new Error('model_not_found: foo'))).toMatch(/Modello non trovato/);
  });
  it('errori ignoti passano invariati', () => {
    expect(mapProviderError(new Error('strano e specifico xyz'))).toBe('strano e specifico xyz');
  });
  it('non-Error convertiti in stringa', () => {
    expect(mapProviderError('boom')).toBe('boom');
  });
});
