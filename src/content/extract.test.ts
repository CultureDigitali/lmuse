// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FIND_MAX, clearMarks, findInPage, tableToMarkdown } from './extract';

describe('tableToMarkdown', () => {
  it('righe e celle con escape pipe', () => {
    document.body.innerHTML =
      '<table><tr><th>Nome</th><th>Prezzo | iva</th></tr><tr><td>Mele</td><td>2€</td></tr></table>';
    const md = tableToMarkdown(document.querySelector('table') as HTMLTableElement);
    expect(md).toContain('| Nome | Prezzo \\| iva |');
    expect(md).toContain('| Mele | 2€ |');
  });
  it('cap righe con nota omesse', () => {
    const rows = Array.from({ length: 30 }, (_, i) => `<tr><td>r${i}</td></tr>`).join('');
    document.body.innerHTML = `<table>${rows}</table>`;
    const md = tableToMarkdown(document.querySelector('table') as HTMLTableElement);
    expect(md).toContain('omesse');
    expect(md.split('\n').length).toBeLessThan(25);
  });
  it('tabella vuota', () => {
    document.body.innerHTML = '<table></table>';
    expect(tableToMarkdown(document.querySelector('table') as HTMLTableElement)).toContain('vuota');
  });
});

describe('findInPage', () => {
  it('conta, evidenzia con mark e pulisce', () => {
    document.body.innerHTML = '<p>Ciao mondo, ciao a tutti</p>';
    expect(findInPage('ciao')).toBe(2);
    expect(document.querySelectorAll('mark[data-lmuse]')).toHaveLength(2);
    clearMarks();
    expect(document.querySelectorAll('mark[data-lmuse]')).toHaveLength(0);
    expect(document.body.textContent).toContain('Ciao mondo');
  });
  it('case-insensitive, vuoto → 0', () => {
    document.body.innerHTML = '<p>ABC abc</p>';
    expect(findInPage('abc')).toBe(2);
    expect(findInPage('   ')).toBe(0);
  });
  it('cap FIND_MAX', () => {
    document.body.innerHTML = `<p>${'x '.repeat(300)}</p>`;
    expect(findInPage('x')).toBeLessThanOrEqual(FIND_MAX);
  });
  it('ignora script/style', () => {
    document.body.innerHTML = '<script>var ciao = 1;</script><p>ciao</p>';
    expect(findInPage('ciao')).toBe(1);
  });
});
