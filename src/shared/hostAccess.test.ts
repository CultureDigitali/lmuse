import { describe, expect, it, vi } from 'vitest';
import { hostPattern, providerEndpoint, requireHostAccess } from './hostAccess';

describe('LM-001 Chrome least privilege', () => {
  it('derives a single exact scheme and host', () => {
    expect(hostPattern('https://example.com/secret?q=123')).toBe('https://example.com/*');
    expect(hostPattern('http://127.0.0.1:11434/v1')).toBe('http://127.0.0.1/*');
  });

  it('rejects unsafe protocols, credentials and store pages', () => {
    for (const url of [
      'file:///secret',
      'chrome://settings',
      'javascript:alert(1)',
      'https://u:p@host.it/',
      'https://chromewebstore.google.com/a',
    ]) {
      expect(hostPattern(url)).toBeNull();
    }
  });

  it('requires a real Chrome host grant: allowlist alone is insufficient', async () => {
    const contains = vi.fn().mockResolvedValue(false);
    vi.stubGlobal('chrome', { permissions: { contains } });
    await expect(requireHostAccess('https://example.com/private')).rejects.toThrow('Accesso Chrome negato');
    expect(contains).toHaveBeenCalledWith({ origins: ['https://example.com/*'] });
    contains.mockResolvedValue(true);
    await expect(requireHostAccess('https://example.com/private')).resolves.toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('guards provider endpoint and custom loopback separately', () => {
    expect(providerEndpoint({ providerId: 'openai', baseUrl: '' })).toBe('https://api.openai.com');
    expect(providerEndpoint({ providerId: 'custom', baseUrl: 'http://127.0.0.1:1820/v1' })).toBe(
      'http://127.0.0.1:1820/v1',
    );
    expect(providerEndpoint({ providerId: 'azure', baseUrl: '' })).toBeNull();
  });
});
