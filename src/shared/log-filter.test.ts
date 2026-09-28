import { describe, expect, it } from 'vitest';
import { filterLogEntries } from './log-filter';

const entries = [
  { id: 1, kind: 'user', text: 'Trova i contatti' },
  { id: 2, kind: 'tool', text: 'browser_click ✓' },
  { id: 3, kind: 'info', text: '— passo 1/3 —' },
  { id: 4, kind: 'error', text: 'Timeout della pagina' },
  { id: 5, kind: 'result', text: 'Fatto: trovatO il link' },
];

describe('filterLogEntries', () => {
  it('nessun filtro: tutto tranne hideTools', () => {
    expect(filterLogEntries(entries, {})).toHaveLength(5);
  });
  it('hideTools nasconde tool e info', () => {
    expect(filterLogEntries(entries, { hideTools: true }).map((e) => e.id)).toEqual([1, 4, 5]);
  });
  it('filtro tools: solo tool e info', () => {
    expect(filterLogEntries(entries, { kind: 'tools' }).map((e) => e.id)).toEqual([2, 3]);
  });
  it('filtro errors: solo errori', () => {
    expect(filterLogEntries(entries, { kind: 'errors' }).map((e) => e.id)).toEqual([4]);
  });
  it('ricerca testo case-insensitive', () => {
    expect(filterLogEntries(entries, { query: 'TROVATO' }).map((e) => e.id)).toEqual([5]);
  });
  it('ricerca + filtro kind combinati', () => {
    expect(filterLogEntries(entries, { kind: 'tools', query: 'passo' }).map((e) => e.id)).toEqual([3]);
    expect(filterLogEntries(entries, { kind: 'errors', query: 'passo' })).toEqual([]);
  });
  it('ricerca solo spazi = nessun filtro testo', () => {
    expect(filterLogEntries(entries, { query: '   ' })).toHaveLength(5);
  });
  it('non muta input e non filtra hideTools su ricerca', () => {
    const copy = [...entries];
    filterLogEntries(copy, { query: 'trova', hideTools: true });
    expect(copy).toEqual(entries);
  });
});
