export type LogFilterKind = 'all' | 'tools' | 'errors';

export interface LogFilterOptions {
  kind?: LogFilterKind;
  query?: string;
  hideTools?: boolean;
}

export function filterLogEntries<T extends { kind: string; text: string }>(
  entries: readonly T[],
  options: LogFilterOptions,
): T[] {
  const { kind = 'all', query = '', hideTools = false } = options;
  const needle = query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (hideTools && (entry.kind === 'tool' || entry.kind === 'info')) return false;
    if (kind === 'tools') {
      if (entry.kind !== 'tool' && entry.kind !== 'info') return false;
    } else if (kind === 'errors') {
      if (entry.kind !== 'error') return false;
    }
    if (needle && !entry.text.toLowerCase().includes(needle)) return false;
    return true;
  });
}
