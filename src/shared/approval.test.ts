import { describe, expect, it } from 'vitest';
import {
  canStartRun,
  extractDomain,
  formatElapsed,
  isPlausibleKey,
  isTrustedDomain,
  shouldApprove,
  type ApprovalContext,
} from './approval';

const EMPTY: ApprovalContext = { seenDomains: [], trustedDomains: [] };
const SEEN: ApprovalContext = { seenDomains: ['example.com'], trustedDomains: [] };
const TRUSTED: ApprovalContext = { seenDomains: [], trustedDomains: ['fidato.test'] };

describe('shouldApprove', () => {
  it('policy off: niente approval tranne safety floor', () => {
    expect(shouldApprove('browser_navigate', { url: 'https://nuovo.test/' }, 'off', EMPTY).needed).toBe(
      false,
    );
    expect(shouldApprove('browser_snapshot', {}, 'off', EMPTY).needed).toBe(false);
  });
  it('safety floor: type+submit sempre approvato anche con off', () => {
    const d = shouldApprove('browser_type', { ref: 1, text: 'x', submit: true }, 'off', EMPTY);
    expect(d.needed).toBe(true);
    expect(d.reason).toMatch(/form/i);
  });
  it('sensitive: navigate verso dominio nuovo sì, già visto no', () => {
    expect(
      shouldApprove('browser_navigate', { url: 'https://nuovo.test/a' }, 'sensitive', EMPTY).needed,
    ).toBe(true);
    expect(
      shouldApprove('browser_navigate', { url: 'https://example.com/a' }, 'sensitive', SEEN).needed,
    ).toBe(false);
    expect(
      shouldApprove('browser_navigate', { url: 'https://sub.example.com/a' }, 'sensitive', SEEN).needed,
    ).toBe(true);
  });
  it('sensitive: tab_focus sì, click/scroll/snapshot no', () => {
    expect(shouldApprove('browser_tab_focus', { tabId: 3 }, 'sensitive', EMPTY).needed).toBe(true);
    expect(shouldApprove('browser_click', { ref: 2 }, 'sensitive', EMPTY).needed).toBe(false);
    expect(shouldApprove('browser_snapshot', {}, 'sensitive', EMPTY).needed).toBe(false);
  });
  it('sensitive: select e reload sì, wait/press/read no', () => {
    expect(shouldApprove('browser_select', { ref: 1, value: 'a' }, 'sensitive', EMPTY).needed).toBe(true);
    expect(shouldApprove('browser_reload', {}, 'sensitive', EMPTY).needed).toBe(true);
    expect(shouldApprove('browser_wait', {}, 'sensitive', EMPTY).needed).toBe(false);
    expect(shouldApprove('browser_press', { key: 'Escape' }, 'sensitive', EMPTY).needed).toBe(false);
    expect(shouldApprove('browser_read_text', {}, 'sensitive', EMPTY).needed).toBe(false);
  });
  it('all: tutto tranne snapshot, tabs_list e wait', () => {
    expect(shouldApprove('browser_click', { ref: 1 }, 'all', EMPTY).needed).toBe(true);
    expect(shouldApprove('browser_snapshot', {}, 'all', EMPTY).needed).toBe(false);
    expect(shouldApprove('browser_tabs_list', {}, 'all', EMPTY).needed).toBe(false);
    expect(shouldApprove('browser_wait', {}, 'all', EMPTY).needed).toBe(false);
  });
  it('input malformato non crasha', () => {
    expect(shouldApprove('browser_navigate', null, 'sensitive', EMPTY).needed).toBe(false);
    expect(shouldApprove('sconosciuto', {}, 'sensitive', EMPTY).needed).toBe(false);
  });
  it('dominio fidato: niente domanda', () => {
    expect(
      shouldApprove('browser_navigate', { url: 'https://fidato.test/a' }, 'sensitive', TRUSTED).needed,
    ).toBe(false);
    expect(
      shouldApprove('browser_navigate', { url: 'https://sub.fidato.test/a' }, 'sensitive', TRUSTED).needed,
    ).toBe(false);
    expect(
      shouldApprove('browser_navigate', { url: 'https://altro.test/a' }, 'sensitive', TRUSTED).needed,
    ).toBe(true);
  });
});

describe('isTrustedDomain', () => {
  it('esatto, sottodominio, case-insensitive; no suffix-trick', () => {
    expect(isTrustedDomain('a.test', ['a.test'])).toBe(true);
    expect(isTrustedDomain('sub.A.test', ['a.test'])).toBe(true);
    expect(isTrustedDomain('a.test.evil.com', ['a.test'])).toBe(false);
    expect(isTrustedDomain('', ['a.test'])).toBe(false);
    expect(isTrustedDomain('a.test', [])).toBe(false);
  });
});

describe('extractDomain', () => {
  it('hostname minuscolo o null', () => {
    expect(extractDomain('https://Sub.Example.COM/a')).toBe('sub.example.com');
    expect(extractDomain('non url')).toBeNull();
  });
});

describe('canStartRun', () => {
  it('cooldown 5s', () => {
    expect(canStartRun(null, 10000)).toBe(true);
    expect(canStartRun(6000, 10000)).toBe(false);
    expect(canStartRun(5000, 10000)).toBe(true);
  });
});

describe('isPlausibleKey', () => {
  it('rifiuta placeholder corti', () => {
    expect(isPlausibleKey('')).toBe(false);
    expect(isPlausibleKey('test')).toBe(false);
    expect(isPlausibleKey('sk-abc123xyz')).toBe(true);
  });
});

describe('formatElapsed', () => {
  it('s, m, h', () => {
    expect(formatElapsed(5000)).toBe('5s');
    expect(formatElapsed(185000)).toBe('3m 05s');
    expect(formatElapsed(3720000)).toBe('1h 02m');
  });
});
