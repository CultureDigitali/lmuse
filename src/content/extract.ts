// Estrazione dati dalla pagina: tabelle → markdown, find con highlight.
// Solo DOM API (mai innerHTML): niente iniezione di markup.

export const FIND_MAX = 100;
const TABLE_MAX_ROWS = 20;
const TABLE_MAX_CELLS = 8;

function escapeCell(text: string): string {
  return text.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|').slice(0, 200);
}

/** Tabella HTML → markdown troncata (max righe/celle). */
export function tableToMarkdown(table: HTMLTableElement): string {
  const rows = [...table.rows].slice(0, TABLE_MAX_ROWS);
  const lines = rows.map(
    (row) =>
      `| ${[...row.cells]
        .slice(0, TABLE_MAX_CELLS)
        .map((c) => escapeCell(c.innerText ?? c.textContent ?? ''))
        .join(' | ')} |`,
  );
  if (table.rows.length > TABLE_MAX_ROWS)
    lines.push(`| …[${table.rows.length - TABLE_MAX_ROWS} righe omesse] |`);
  return lines.join('\n') || '(tabella vuota)';
}

/** Rimuove gli highlight di una find precedente. */
export function clearMarks(): void {
  for (const mark of document.querySelectorAll('mark[data-lmuse]')) {
    const parent = mark.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
    parent.normalize();
  }
}

/**
 * Evidenzia le occorrenze (case-insensitive) e scrolla alla n-esima.
 * Ritorna il conteggio (cappato a FIND_MAX evidenziazioni).
 */
export function findInPage(needle: string, index = 0): number {
  clearMarks();
  const wanted = needle.toLowerCase();
  if (!wanted) return 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null = walker.nextNode();
  while (node) {
    if (node.parentElement?.closest('script, style, mark')) {
      node = walker.nextNode();
      continue;
    }
    if ((node.textContent ?? '').toLowerCase().includes(wanted)) nodes.push(node as Text);
    node = walker.nextNode();
  }
  let count = 0;
  let target: HTMLElement | null = null;
  for (const textNode of nodes) {
    const text = textNode.textContent ?? '';
    const lower = text.toLowerCase();
    const parent = textNode.parentNode;
    if (!parent) continue;
    const frag = document.createDocumentFragment();
    let pos = lower.indexOf(wanted);
    if (pos === -1) continue;
    let cursor = 0;
    while (pos !== -1 && count < FIND_MAX) {
      frag.append(document.createTextNode(text.slice(cursor, pos)));
      const mark = document.createElement('mark');
      mark.setAttribute('data-lmuse', '');
      mark.textContent = text.slice(pos, pos + wanted.length);
      frag.append(mark);
      if (count === index) target = mark;
      count += 1;
      cursor = pos + wanted.length;
      pos = lower.indexOf(wanted, cursor);
    }
    frag.append(document.createTextNode(text.slice(cursor)));
    parent.replaceChild(frag, textNode);
  }
  const scroller = target ?? document.querySelector('mark[data-lmuse]');
  scroller?.scrollIntoView?.({ block: 'center' });
  return count;
}
