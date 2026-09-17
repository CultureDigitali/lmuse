// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildLogMarkdown } from './log-export';

describe('buildLogMarkdown', () => {
  it('header con provider/modello, mai la chiave', () => {
    const md = buildLogMarkdown(
      [{ kind: 'user', text: 'riassumi', at: 1758100000000 }],
      { provider: 'NVIDIA NIM', model: 'meta/llama-3.3-70b-instruct', },
    );
    expect(md).toContain('# lmuse — log');
    expect(md).toContain('Provider: NVIDIA NIM');
    expect(md).toContain('Modello: meta/llama-3.3-70b-instruct');
    expect(md).not.toContain('sk-');
    expect(md).toContain('**[user]**');
  });
  it('voci troncate a 500 char, max 500 voci', () => {
    const entries = Array.from({ length: 600 }, (_, i) => ({ kind: 'tool', text: `t${i} `.repeat(100), at: 1 }));
    const md = buildLogMarkdown(entries, { provider: 'x', model: '' });
    expect(md).toContain('t0 t0');
    expect(md).not.toContain('t599');
  });
  it('voci vuote saltate, modello mancante → —', () => {
    const md = buildLogMarkdown(
      [
        { kind: 'info', text: '', at: 0 },
        { kind: 'result', text: 'fatto', at: 0 },
      ],
      { provider: 'x', model: '' },
    );
    expect(md).toContain('Modello: —');
    expect(md).toContain('**[result]**');
    expect(md).not.toContain('[info]');
  });
});
