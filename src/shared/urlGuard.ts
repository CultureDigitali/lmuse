// Guardie di navigazione: protocolli/domini bloccati e allowlist utente.

const BLOCKED_PROTOCOLS = [
  'javascript:',
  'data:',
  'file:',
  'blob:',
  'about:',
  'chrome:',
  'chrome-extension:',
  'devtools:',
  'edge:',
  'view-source:',
];

const BLOCKED_HOST_SUFFIXES = [
  'chromewebstore.google.com',
  'chrome.google.com',
  'microsoftedge.microsoft.com',
];

/** True se l'URL usa un protocollo o un host che l'agente non deve aprire. */
export function isBlockedUrl(url: string): boolean {
  const lower = url.trim().toLowerCase();
  if (BLOCKED_PROTOCOLS.some((p) => lower.startsWith(p))) return true;
  try {
    const host = new URL(lower).hostname;
    return BLOCKED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return true;
  }
}

/**
 * True se l'host è consentito dall'allowlist utente (CSV di domini, vuota = tutti).
 * Un dominio in lista copre anche i suoi sottodomini.
 */
export function isAllowedHost(url: string, allowedDomainsCsv: string): boolean {
  const csv = allowedDomainsCsv.trim();
  if (!csv) return true;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  const domains = csv
    .split(',')
    .map((d) =>
      d
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, ''),
    )
    .filter(Boolean);
  if (domains.length === 0) return true;
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Normalizza l'input di navigazione; null se non valido. */
export function normalizeNavigationTarget(input: string): string | null {
  let target = input.trim();
  if (!target) return null;
  if (BLOCKED_PROTOCOLS.some((p) => target.toLowerCase().startsWith(p))) return null;
  if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
  try {
    const url = new URL(target);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}
