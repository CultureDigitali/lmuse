// Export log come markdown: funzione pura (testata). Mai la chiave nel file.

export interface LogEntryLike {
  kind: string;
  text: string;
  at: number;
}

export interface LogMeta {
  provider: string;
  model: string;
}

const MAX_ENTRY = 500;
const MAX_ENTRIES = 500;

function fmtTime(at: number): string {
  if (!at) return '';
  try {
    return new Date(at).toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return '';
  }
}

/** Markdown del log: header con data/provider/modello (mai chiave), voci troncate. */
export function buildLogMarkdown(entries: LogEntryLike[], meta: LogMeta): string {
  const lines: string[] = [
    `# lmuse — log`,
    '',
    `- Data: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
    `- Provider: ${meta.provider}`,
    `- Modello: ${meta.model || '—'}`,
    '',
    '---',
    '',
  ];
  for (const e of entries.slice(0, MAX_ENTRIES)) {
    const time = fmtTime(e.at);
    const text = String(e.text ?? '')
      .slice(0, MAX_ENTRY)
      .trim();
    if (!text) continue;
    lines.push(`**[${e.kind}]**${time ? ` _${time}_` : ''}: ${text}`, '');
  }
  return lines.join('\n').trimEnd() + '\n';
}
