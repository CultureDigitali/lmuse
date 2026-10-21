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
  'filesystem:',
  'moz-extension:',
  'safari-extension:',
  'opera:',
  'brave:',
];

const BLOCKED_HOST_SUFFIXES = [
  'chromewebstore.google.com',
  'chrome.google.com',
  'microsoftedge.microsoft.com',
];

// Endpoints cloud metadata/credentials and unspecified IPs: never grant access.
const BLOCKED_INTERNAL_HOSTS = new Set([
  'metadata.google.internal',
  'metadata.google',
  '169.254.169.254',
  '169.254.170.2',
  '100.100.100.200',
  '168.63.129.16',
  '0.0.0.0',
  '255.255.255.255',
  '[::]',
  '[fd00:ec2::254]',
]);

function normalizedHostname(url: URL): string {
  return url.hostname.toLowerCase().replace(/\.$/, '');
}

function ipv4Parts(host: string): number[] | null {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  const parts = host.split('.').map(Number);
  return parts.every((p) => p >= 0 && p <= 255) ? parts : null;
}

/** Canonical URL IPv4-mapped IPv6 form: [::ffff:a9fe:a9fe]. */
function mappedIpv4Parts(host: string): number[] | null {
  const mapped = /^\[::ffff:([a-f\d]{1,4}):([a-f\d]{1,4})\]$/i.exec(host);
  if (!mapped) return null;
  const a = Number.parseInt(mapped[1], 16);
  const b = Number.parseInt(mapped[2], 16);
  return [a >>> 8, a & 255, b >>> 8, b & 255];
}

function isLinkLocalHost(host: string): boolean {
  const ip = ipv4Parts(host) ?? mappedIpv4Parts(host);
  if (ip && ip[0] === 169 && ip[1] === 254) return true;
  if (host.startsWith('[') && host.endsWith(']')) {
    const first = Number.parseInt(host.slice(1, -1).split(':')[0] ?? '', 16);
    return Number.isFinite(first) && first >= 0xfe80 && first <= 0xfebf;
  }
  return false;
}

/** Local sites are not automatically trusted; an explicit origin+port+role grant is required. */
export function isPrivateNetworkUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = normalizedHostname(parsed);
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.endsWith('.home.arpa')
    )
      return true;
    const ip = ipv4Parts(host) ?? mappedIpv4Parts(host);
    if (ip) {
      return (
        ip[0] === 10 ||
        ip[0] === 127 ||
        (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31) ||
        (ip[0] === 192 && ip[1] === 168) ||
        (ip[0] === 169 && ip[1] === 254)
      );
    }
    if (host.startsWith('[') && host.endsWith(']')) {
      const v6 = host.slice(1, -1);
      const first = Number.parseInt(v6.split(':')[0] ?? '', 16);
      return (
        v6 === '::1' ||
        (Number.isFinite(first) && first >= 0xfc00 && first <= 0xfdff) ||
        isLinkLocalHost(host)
      );
    }
    return false;
  } catch {
    return false;
  }
}

/** True se l'URL usa un protocollo o un host che l'agente non deve aprire. */
export function isBlockedUrl(url: string): boolean {
  const lower = url.trim().toLowerCase();
  if (BLOCKED_PROTOCOLS.some((p) => lower.startsWith(p))) return true;
  try {
    const parsed = new URL(lower);
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.username || parsed.password)
      return true;
    const host = normalizedHostname(parsed);
    const ipv4Mapped = mappedIpv4Parts(host)?.join('.');
    return (
      BLOCKED_INTERNAL_HOSTS.has(host) ||
      (ipv4Mapped != null && BLOCKED_INTERNAL_HOSTS.has(ipv4Mapped)) ||
      isLinkLocalHost(host) ||
      BLOCKED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
    );
  } catch {
    return true;
  }
}

/**
 * True se l'host è consentito dall'allowlist utente (CSV di domini, vuota = tutti).
 * Un dominio in lista copre anche i suoi sottodomini.
 */
export function isAllowedHost(url: string, allowedDomainsCsv: string): boolean {
  // LM-008: an empty allowlist means any safe site, never a privileged URL.
  if (isBlockedUrl(url)) return false;
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
  // Non trasformare schemi espliciti estranei in hostname HTTPS (ftp://foo
  // diventerebbe erroneamente https://ftp//foo).
  const explicitScheme = /^[a-z][a-z0-9+.-]*:/i.test(target);
  const bareHostPort = /^[a-z][a-z0-9.-]*:\d{1,5}(?:[/?#]|$)/i.test(target);
  if (explicitScheme && !/^https?:\/\//i.test(target) && !bareHostPort) return null;
  if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
  try {
    const url = new URL(target);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    // Niente credenziali nell'URL: vettore di phishing, mai necessario all'agente.
    if (url.username || url.password || isBlockedUrl(url.href)) return null;
    return stripTrackingParams(url.toString());
  } catch {
    return null;
  }
}

const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'msclkid',
  'ttclid',
  'dclid',
  'mc_cid',
  'mc_eid',
  '_ga',
];

/** Rimuove i parametri di tracking noti da un URL (privacy). */
export function stripTrackingParams(url: string): string {
  try {
    const parsed = new URL(url);
    let changed = false;
    for (const param of TRACKING_PARAMS) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.delete(param);
        changed = true;
      }
    }
    return changed ? parsed.toString() : url;
  } catch {
    return url;
  }
}
