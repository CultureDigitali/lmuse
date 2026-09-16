import { describe, expect, it } from 'vitest';
import {
  canStartRun,
  extractDomain,
  formatElapsed,
  isPlausibleKey,
  shouldApprove,
  type ApprovalContext,
} from './approval';

const EMPTY: ApprovalContext = { seenDomains: [] };
const SEEN: ApprovalContext = { seenDomains: ['example.com'] };

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
  it('all: tutto tranne snapshot e tabs_list', () => {
    expect(shouldApprove('browser_click', { ref: 1 }, 'all', EMPTY).needed).toBe(true);
    expect(shouldApprove('browser_snapshot', {}, 'all', EMPTY).needed).toBe(false);
    expect(shouldApprove('browser_tabs_list', {}, 'all', EMPTY).needed).toBe(false);
  });
  it('input malformato non crasha', () => {
    expect(shouldApprove('browser_navigate', null, 'sensitive', EMPTY).needed).toBe(false);
    expect(shouldApprove('sconosciuto', {}, 'sensitive', EMPTY).needed).toBe(false);
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
