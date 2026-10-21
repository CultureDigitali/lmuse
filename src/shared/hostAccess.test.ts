import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exactHostOrigin,
  forgetHostGrant,
  hasRevokedHostGrant,
  hostPattern,
  HOST_GRANTS_KEY,
  listHostGrants,
  providerEndpoint,
  rememberHostGrant,
  revokeAllHostGrants,
  requireHostAccess,
  type HostGrant,
} from './hostAccess';

let saved: HostGrant[] = [];
const contains = vi.fn(async () => true);
const remove = vi.fn(async () => true);

beforeEach(() => {
  saved = [];
  contains.mockReset().mockResolvedValue(true);
  remove.mockReset().mockResolvedValue(true);
  vi.stubGlobal('chrome', {
    permissions: { contains, remove },
    storage: {
      local: {
        get: vi.fn(async () => ({ [HOST_GRANTS_KEY]: saved })),
        set: vi.fn(async (v: Record<string, HostGrant[]>) => {
          saved = v[HOST_GRANTS_KEY];
        }),
        remove: vi.fn(async () => {
          saved = [];
        }),
      },
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('LM-001 Chrome least privilege', () => {
  it('derives a single exact scheme and host', () => {
    expect(hostPattern('https://example.com/secret?q=123')).toBe('https://example.com/*');
    expect(hostPattern('http://127.0.0.1:11434/v1')).toBe('http://127.0.0.1/*');
    expect(exactHostOrigin('http://localhost:11434/v1?api_key=TOPSECRET')).toBe('http://localhost:11434');
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
    await expect(requireHostAccess('https://example.com/private')).rejects.toThrow(
      /non autorizzato in LMuse/,
    );
    expect(contains).not.toHaveBeenCalled();
    await rememberHostGrant('https://example.com/ok', 'site');
    contains.mockResolvedValue(false);
    await expect(requireHostAccess('https://example.com/private')).rejects.toThrow('Accesso Chrome negato');
    expect(contains).toHaveBeenCalledWith({ origins: ['https://example.com/*'] });
    contains.mockResolvedValue(true);
    await expect(requireHostAccess('https://example.com/private')).resolves.toBeUndefined();
  });

  it('provider localhost non sblocca siti su altra porta o con altro scopo', async () => {
    await rememberHostGrant('http://localhost:11434/v1', 'provider');
    expect(await listHostGrants()).toMatchObject([{ origin: 'http://localhost:11434', purpose: 'provider' }]);
    await expect(requireHostAccess('http://localhost:11434/v1', 'provider')).resolves.toBeUndefined();
    await expect(requireHostAccess('http://localhost:11434/admin', 'site')).rejects.toThrow(
      /non autorizzato in LMuse/,
    );
    await expect(requireHostAccess('http://localhost:3000/admin', 'site')).rejects.toThrow(
      /non autorizzato in LMuse/,
    );
    await expect(requireHostAccess('http://localhost:3000/v1', 'provider')).rejects.toThrow(
      /non autorizzato in LMuse/,
    );
  });

  it('revocare il sito non revoca il provider sulla stessa hostname, ma l ultimo grant sì', async () => {
    await rememberHostGrant('http://localhost:3000/', 'site');
    await rememberHostGrant('http://localhost:11434/v1', 'provider');
    expect(await forgetHostGrant('http://localhost:3000/', 'site')).toBe(true);
    expect(remove).not.toHaveBeenCalled();
    await expect(requireHostAccess('http://localhost:3000/', 'site')).rejects.toThrow(/non autorizzato/);
    await expect(requireHostAccess('http://localhost:11434/v1', 'provider')).resolves.toBeUndefined();
    expect(await forgetHostGrant('http://localhost:11434/v1', 'provider')).toBe(true);
    expect(remove).toHaveBeenCalledWith({ origins: ['http://localhost/*'] });
    expect(await listHostGrants()).toEqual([]);
  });

  it('non amplia o registra URL invalidi e non ripristina grant rimossi', async () => {
    await expect(rememberHostGrant('file:///segreto', 'site')).rejects.toThrow(/URL non valido/);
    expect(await forgetHostGrant('https://example.org/', 'site')).toBe(false);
    expect(await listHostGrants()).toEqual([]);
  });

  it('cancellazione completa elimina registry e revoca i pattern Chrome senza duplicati', async () => {
    await rememberHostGrant('http://localhost:3000/', 'site');
    await rememberHostGrant('http://localhost:11434/v1', 'provider');
    await rememberHostGrant('https://example.com/', 'site');
    await revokeAllHostGrants();
    expect(await listHostGrants()).toEqual([]);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledWith({ origins: ['http://localhost/*'] });
    expect(remove).toHaveBeenCalledWith({ origins: ['https://example.com/*'] });
  });

  it('guards provider endpoint and custom loopback separately', () => {
    expect(providerEndpoint({ providerId: 'openai', baseUrl: '' })).toBe('https://api.openai.com');
    expect(providerEndpoint({ providerId: 'custom', baseUrl: 'http://127.0.0.1:1820/v1' })).toBe(
      'http://127.0.0.1:1820/v1',
    );
    expect(providerEndpoint({ providerId: 'azure', baseUrl: '' })).toBeNull();
  });
});

describe('LM-005 revoca immediata', () => {
  const site = { origin: 'https://example.com', purpose: 'site' as const, grantedAt: 1 };
  const provider = { origin: 'https://example.com', purpose: 'provider' as const, grantedAt: 2 };
  const other = { origin: 'http://localhost:11434', purpose: 'provider' as const, grantedAt: 3 };

  it('rileva revoca site anche quando il provider conserva il permesso Chrome', () => {
    expect(hasRevokedHostGrant([site, provider], [provider])).toBe(true);
  });

  it('rileva revoca di un origin anche se Chrome continua a permettere lo stesso hostname', () => {
    const second = { origin: 'http://localhost:3000', purpose: 'site' as const, grantedAt: 1 };
    expect(hasRevokedHostGrant([other, second], [other])).toBe(true);
  });

  it('ignora nuove autorizzazioni, riordino e rinnovo dei timestamp', () => {
    expect(hasRevokedHostGrant(undefined, [site])).toBe(false);
    expect(hasRevokedHostGrant([site], [site, provider])).toBe(false);
    expect(hasRevokedHostGrant([site, provider], [{ ...provider, grantedAt: 99 }, site])).toBe(false);
  });

  it('Clear All e revoca multipla interrompono il run', () => {
    expect(hasRevokedHostGrant([site, provider, other], undefined)).toBe(true);
    expect(hasRevokedHostGrant([site, other], [])).toBe(true);
    expect(hasRevokedHostGrant([{ origin: 'file:///unsafe', purpose: 'site', grantedAt: 0 }], [])).toBe(
      false,
    );
  });
});
