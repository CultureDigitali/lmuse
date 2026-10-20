import { isBlockedUrl } from './urlGuard';
import type { Settings } from './settings';

export type HostPurpose = 'site' | 'provider';
export interface HostGrant {
  origin: string;
  purpose: HostPurpose;
  grantedAt: number;
}
export const HOST_GRANTS_KEY = 'lmuse.hostGrants.v1';
const MAX_GRANTS = 200;

/** Chrome ignores ports on match patterns, so use a second exact-origin, purpose-bound gate. */
export function exactHostOrigin(url: string): string | null {
  if (!hostPattern(url)) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export class HostAccessDenied extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HostAccessDenied';
  }
}

function cleanGrants(raw: unknown): HostGrant[] {
  if (!Array.isArray(raw)) return [];
  const keys = new Set<string>();
  const result: HostGrant[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Partial<HostGrant>;
    if (candidate.purpose !== 'site' && candidate.purpose !== 'provider') continue;
    if (typeof candidate.origin !== 'string' || exactHostOrigin(candidate.origin) !== candidate.origin)
      continue;
    const key = candidate.purpose + '|' + candidate.origin;
    if (keys.has(key)) continue;
    keys.add(key);
    result.push({
      origin: candidate.origin,
      purpose: candidate.purpose,
      grantedAt: Number.isFinite(candidate.grantedAt) ? Number(candidate.grantedAt) : 0,
    });
    if (result.length === MAX_GRANTS) break;
  }
  return result;
}

export async function listHostGrants(): Promise<HostGrant[]> {
  const stored = await chrome.storage.local.get(HOST_GRANTS_KEY);
  return cleanGrants(stored[HOST_GRANTS_KEY]);
}

/** Call ONLY after a successfully approved chrome.permissions.request from a user click. */
export async function rememberHostGrant(url: string, purpose: HostPurpose): Promise<void> {
  const origin = exactHostOrigin(url);
  if (!origin) throw new HostAccessDenied('Autorizzazione host: URL non valido.');
  const prior = await listHostGrants();
  const updated = prior.filter((g) => !(g.origin === origin && g.purpose === purpose));
  updated.unshift({ origin, purpose, grantedAt: Date.now() });
  await chrome.storage.local.set({ [HOST_GRANTS_KEY]: updated.slice(0, MAX_GRANTS) });
}

/** Local role is revoked FIRST. Keep Chrome's broader hostname grant if another role/port needs it. */
export async function forgetHostGrant(url: string, purpose: HostPurpose): Promise<boolean> {
  const origin = exactHostOrigin(url);
  if (!origin) throw new HostAccessDenied('Revoca host: URL non valido.');
  const grants = await listHostGrants();
  const remainder = grants.filter((g) => !(g.origin === origin && g.purpose === purpose));
  if (remainder.length === grants.length) return false;
  await chrome.storage.local.set({ [HOST_GRANTS_KEY]: remainder });
  const pattern = hostPattern(origin)!;
  if (!remainder.some((g) => hostPattern(g.origin) === pattern)) {
    await chrome.permissions.remove({ origins: [pattern] });
  }
  return true;
}

/** Clear All means the application scopes AND the underlying optional Chrome grants. */
export async function revokeAllHostGrants(): Promise<void> {
  const grants = await listHostGrants();
  const patterns = [...new Set(grants.map((grant) => hostPattern(grant.origin)).filter(Boolean))] as string[];
  // Fail closed: remove app capabilities before trying to revoke browser permissions.
  await chrome.storage.local.remove(HOST_GRANTS_KEY);
  let error: unknown;
  for (const pattern of patterns) {
    try {
      await chrome.permissions.remove({ origins: [pattern] });
    } catch (cause) {
      error = cause;
    }
  }
  if (error)
    throw new HostAccessDenied(
      'I dati locali sono cancellati, ma Chrome potrebbe mantenere un permesso host. Controlla le autorizzazioni dell’estensione.',
    );
}

/**
 * MV3 origin match pattern. Permission patterns are intentionally scoped
 * to ONE scheme and ONE hostname, not to the entire web.
 * Chrome ignores URL paths and match patterns do not include port numbers.
 */
export function hostPattern(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    if (!parsed.hostname || parsed.hostname.includes('*') || isBlockedUrl(parsed.href)) return null;
    return `${parsed.protocol}//${parsed.hostname}/*`;
  } catch {
    return null;
  }
}

/** Cloud SDK base hosts; OpenAI-compatible and local endpoints use settings.baseUrl. */
const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com',
  xai: 'https://api.x.ai',
  groq: 'https://api.groq.com',
  deepseek: 'https://api.deepseek.com',
  cerebras: 'https://api.cerebras.ai',
  mistral: 'https://api.mistral.ai',
  cohere: 'https://api.cohere.com',
  deepinfra: 'https://api.deepinfra.com',
  fireworks: 'https://api.fireworks.ai',
  perplexity: 'https://api.perplexity.ai',
  togetherai: 'https://api.together.xyz',
  huggingface: 'https://router.huggingface.co',
  gateway: 'https://ai-gateway.vercel.sh',
  openrouter: 'https://openrouter.ai',
  nvidia: 'https://integrate.api.nvidia.com',
  opencode: 'https://opencode.ai',
  github: 'https://models.github.ai',
  baseten: 'https://inference.baseten.co',
  sambanova: 'https://api.sambanova.ai',
  ollama: 'http://localhost:11434',
  lmstudio: 'http://localhost:1234',
};

export function providerEndpoint(settings: Pick<Settings, 'providerId' | 'baseUrl'>): string | null {
  const base = settings.baseUrl.trim();
  if (['azure', 'custom'].includes(settings.providerId)) return base || null;
  // Only these SDK adapters honour baseUrl overrides.
  if (
    base &&
    ['openrouter', 'nvidia', 'opencode', 'github', 'baseten', 'sambanova', 'ollama', 'lmstudio'].includes(
      settings.providerId,
    )
  ) {
    return base;
  }
  return PROVIDER_ENDPOINTS[settings.providerId] ?? null;
}

/** Never request Chrome permissions here: request() requires a *user gesture* in the panel. */
export async function requireHostAccess(url: string, purpose: HostPurpose = 'site'): Promise<void> {
  const pattern = hostPattern(url);
  const origin = exactHostOrigin(url);
  if (!pattern || !origin) throw new HostAccessDenied('Autorizzazione Chrome: URL non valido o riservato.');
  const grants = await listHostGrants();
  if (!grants.some((entry) => entry.origin === origin && entry.purpose === purpose)) {
    throw new HostAccessDenied(
      `Accesso ${purpose === 'provider' ? 'al provider' : 'al sito'} ${origin} non autorizzato in LMuse. Apri le impostazioni e concedi il permesso specifico.`,
    );
  }
  const allowed = await chrome.permissions.contains({ origins: [pattern] });
  if (!allowed) {
    throw new HostAccessDenied(
      `Accesso Chrome negato a ${origin}. Apri le impostazioni LMuse e concedi esplicitamente il permesso per questo sito.`,
    );
  }
}
