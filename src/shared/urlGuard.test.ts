import { describe, expect, it } from 'vitest';
import { isAllowedHost, isBlockedUrl, normalizeNavigationTarget } from './urlGuard';

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
  });
  it('rifiuta protocolli pericolosi', () => {
    expect(normalizeNavigationTarget('javascript:alert(1)')).toBeNull();
    expect(normalizeNavigationTarget('data:text/html,x')).toBeNull();
    expect(normalizeNavigationTarget('file:///x')).toBeNull();
  });
  it('rifiuta input vuoto o invalido', () => {
    expect(normalizeNavigationTarget('   ')).toBeNull();
  });
});
