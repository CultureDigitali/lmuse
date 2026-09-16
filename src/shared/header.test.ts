import { describe, expect, it } from 'vitest';
import { formatSnapshotHeader } from './header';

const TREE = '[0] button "Vai"';

describe('formatSnapshotHeader', () => {
  it('redige token URL e PII nel titolo con mask on', () => {
    const out = formatSnapshotHeader(
      'https://x.test/cb?code=abc123&state=ok',
      'Conto mario@example.com',
      TREE,
      { maskPiiEnabled: true, hostOnly: false },
    );
    expect(out).toContain('code=[redatto]');
    expect(out).toContain('[email]');
    expect(out).toContain(TREE);
    expect(out).not.toContain('abc123');
  });
  it('hostOnly: solo origin+path', () => {
    const out = formatSnapshotHeader('https://x.test/a/b?q=1#frag', 'T', TREE, {
      maskPiiEnabled: false,
      hostOnly: true,
    });
    expect(out).toContain('URL: https://x.test/a/b');
    expect(out).not.toContain('q=1');
    expect(out).not.toContain('#frag');
  });
  it('mask off: PII intatta ma token URL sempre redatti', () => {
    const out = formatSnapshotHeader('https://x.test/?code=abc', 'mario@example.com', TREE, {
      maskPiiEnabled: false,
      hostOnly: false,
    });
    expect(out).toContain('code=[redatto]');
    expect(out).toContain('mario@example.com');
  });
  it('URL/titolo mancanti non crashano', () => {
    const out = formatSnapshotHeader(undefined, undefined, TREE, { maskPiiEnabled: true, hostOnly: true });
    expect(out).toContain('(sconosciuto)');
    expect(out).toContain(TREE);
  });
});
