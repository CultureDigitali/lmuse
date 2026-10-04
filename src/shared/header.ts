// Intestazione snapshot (URL + titolo) con redazione privacy.
// Pura e testata: il worker la compone col tree del content script.

import { maskPii, maskUrlTokens } from './pii';

export interface HeaderOptions {
  maskPiiEnabled: boolean;
  /** Se true, solo origin+path: niente query né hash. */
  hostOnly: boolean;
}

/**
 * URL mostrato all'agente secondo le impostazioni di privacy.
 * Esportata perché `hostOnly` (via "solo dominio") deve valere su OGNI
 * percorso che mostra un URL, non solo sull'intestazione dello snapshot:
 * un href completo in browser_links o in tabs_list lo renderebbe inutile.
 */
export function displayUrl(rawUrl: string | undefined, opts: HeaderOptions): string {
  if (!rawUrl) return '(sconosciuto)';
  try {
    const parsed = new URL(rawUrl);
    // I token nei query param sono segreti: redatti SEMPRE, anche con mask off.
    const base = opts.hostOnly ? `${parsed.origin}${parsed.pathname}` : maskUrlTokens(rawUrl);
    return opts.maskPiiEnabled ? maskPii(base) : base;
  } catch {
    return opts.maskPiiEnabled ? maskPii(rawUrl) : rawUrl;
  }
}

/** "URL: …\nTitolo: …\n<tree>" pronto da passare al modello. */
export function formatSnapshotHeader(
  url: string | undefined,
  title: string | undefined,
  tree: string,
  opts: HeaderOptions,
): string {
  const shownTitle = title ?? '(senza titolo)';
  return `URL: ${displayUrl(url, opts)}\nTitolo: ${opts.maskPiiEnabled ? maskPii(shownTitle) : shownTitle}\n${tree}`;
}
