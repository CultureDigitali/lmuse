import { describe, expect, it } from 'vitest';
import {
  isAllowedHost,
  isBlockedUrl,
  isPrivateNetworkUrl,
  normalizeNavigationTarget,
  stripTrackingParams,
} from './urlGuard';

describe('isBlockedUrl', () => {
  it.each([
    'javascript:alert(1)',
    'data:text/html,<h1>x</h1>',
    'file:///etc/passwd',
    'chrome://settings',
    'chrome-extension://abc/popup.html',
    'about:blank',
    'edge://settings',
    'view-source:https://example.com',
    'https://chromewebstore.google.com/detail/x',
    'https://sub.chrome.google.com/y',
  ])('blocca %s', (url) => {
    expect(isBlockedUrl(url)).toBe(true);
  });

  it.each(['https://example.com', 'http://localhost:3000/', 'https://it.wikipedia.org/wiki/X'])(
    'consente %s',
    (url) => {
      expect(isBlockedUrl(url)).toBe(false);
    },
  );

  it('blocca input non URL', () => {
    expect(isBlockedUrl('non un url')).toBe(true);
  });
});

describe('isAllowedHost', () => {
  it('allowlist vuota = tutti consentiti', () => {
    expect(isAllowedHost('https://qualsiasi.test/a', '')).toBe(true);
    expect(isAllowedHost('https://qualsiasi.test/a', '   ')).toBe(true);
  });
  it('consente dominio in lista e sottodomini', () => {
    expect(isAllowedHost('https://example.com/a', 'example.com')).toBe(true);
    expect(isAllowedHost('https://sub.example.com/a', 'example.com')).toBe(true);
  });
  it('nega domini fuori lista', () => {
    expect(isAllowedHost('https://evil.com/a', 'example.com')).toBe(false);
    expect(isAllowedHost('https://example.com.evil.com/a', 'example.com')).toBe(false);
  });
  it('gestisce CSV multipli e case', () => {
    expect(isAllowedHost('https://B.it/x', 'a.com, B.it')).toBe(true);
  });
});

describe('normalizeNavigationTarget', () => {
  it('aggiunge https:// se manca il protocollo', () => {
    expect(normalizeNavigationTarget('example.com')).toBe('https://example.com/');
    expect(normalizeNavigationTarget('evil.example.com:8443/x')).toBe('https://evil.example.com:8443/x');
    expect(normalizeNavigationTarget('localhost:11434/v1')).toBe('https://localhost:11434/v1');
  });
  it('rifiuta protocolli pericolosi', () => {
    expect(normalizeNavigationTarget('javascript:alert(1)')).toBeNull();
    expect(normalizeNavigationTarget('data:text/html,x')).toBeNull();
    expect(normalizeNavigationTarget('file:///x')).toBeNull();
  });
  it('rifiuta input vuoto o invalido', () => {
    expect(normalizeNavigationTarget('   ')).toBeNull();
  });
  it('rifiuta URL con credenziali user:pass@', () => {
    expect(normalizeNavigationTarget('https://user:pass@example.com/')).toBeNull();
  });
  it('normalizza rimuovendo tracking params', () => {
    expect(normalizeNavigationTarget('https://example.com/a?utm_source=x&q=1')).toBe(
      'https://example.com/a?q=1',
    );
  });
});

describe('stripTrackingParams', () => {
  it('toglie utm/gclid/fbclid e tiene il resto', () => {
    expect(stripTrackingParams('https://e.test/?gclid=1&fbclid=2&q=ciao')).toBe('https://e.test/?q=ciao');
  });
  it('lascia intatti URL senza tracking', () => {
    expect(stripTrackingParams('https://e.test/?q=1')).toBe('https://e.test/?q=1');
  });
});

describe('LM-007: pagine riservate, metadata cloud e rete privata', () => {
  it.each([
    'chrome://extensions',
    'chrome://settings/passwords',
    'chrome-extension://abcdefghijklmnopabcdefghijklmnop/options.html',
    'edge://settings',
    'about:blank',
    'file:///C:/Users/user/private.txt',
    'filesystem:https://example.com/temporary/a',
    'blob:https://example.com/id',
    'ftp://example.com/file',
    'https://u:p@example.com/path',
    'https://169.254.169.254/latest/meta-data/',
    'http://169.254.170.2/v2/credentials',
    'http://metadata.google.internal/computeMetadata/v1/',
    'http://metadata.google.internal./computeMetadata/v1/',
    'http://100.100.100.200/latest/meta-data',
    'http://168.63.129.16/metadata',
    'http://0.0.0.0:9000/',
    'http://255.255.255.255/',
    'http://[::]/',
    'http://[fd00:ec2::254]/latest/meta-data',
    'http://169.254.1.1/',
    'http://[fe80::1]/',
    'http://0xa9fea9fe/latest/meta-data',
    'http://[::ffff:169.254.169.254]/latest/meta-data',
    'http://[::ffff:169.254.170.2]/v2/credentials',
    'http://[::ffff:0.0.0.0]:9999/',
    'http://[::ffff:255.255.255.255]/',
    'http://[::ffff:100.100.100.200]/latest/meta-data',
  ])('nega sempre endpoint protetto anche con URL completo: %s', (url) => {
    expect(isBlockedUrl(url)).toBe(true);
  });

  it.each([
    'http://localhost:11434/v1',
    'http://127.0.0.1:1234/v1',
    'http://127.1:1234',
    'http://[::1]:11434/v1',
    'http://[::ffff:127.0.0.1]:11434/v1',
    'http://192.168.1.1',
    'http://10.0.0.10',
    'http://172.16.1.10',
    'http://service.internal:3000',
    'http://mydevice.local',
    'http://foo.localhost:8000',
  ])('rete privata richiede grant distinto, non blocco totale: %s', (url) => {
    expect(isPrivateNetworkUrl(url)).toBe(true);
    expect(isBlockedUrl(url)).toBe(false);
  });

  it('non classifica endpoint pubblici o input non valido come locale', () => {
    expect(isPrivateNetworkUrl('https://api.openai.com/v1/models')).toBe(false);
    expect(isPrivateNetworkUrl('not a URL')).toBe(false);
  });

  it('normalizzazione non trasforma URL di sistema o metadata in URL navigabili', () => {
    expect(normalizeNavigationTarget('169.254.169.254/latest/meta-data')).toBeNull();
    expect(normalizeNavigationTarget('metadata.google.internal/computeMetadata/v1')).toBeNull();
    expect(normalizeNavigationTarget('https://u:p@example.com/')).toBeNull();
    expect(normalizeNavigationTarget('file:///etc/passwd')).toBeNull();
    expect(normalizeNavigationTarget('ftp://example.org/secret')).toBeNull();
    expect(normalizeNavigationTarget('mailto:person@example.org')).toBeNull();
    expect(normalizeNavigationTarget('https://www.example.org/a')).toBe('https://www.example.org/a');
  });
});
