import { isBlockedUrl } from './urlGuard';
import type { Settings } from './settings';

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

/** Never ask for a Chrome permission here: request() requires a *user gesture* in the panel. */
export async function requireHostAccess(url: string): Promise<void> {
  const pattern = hostPattern(url);
  if (!pattern) throw new Error('Autorizzazione Chrome: URL non valido o riservato.');
  const allowed = await chrome.permissions.contains({ origins: [pattern] });
  if (!allowed) {
    const host = new URL(url).hostname;
    throw new Error(
      `Accesso Chrome negato a ${host}. Apri le impostazioni LMuse e concedi esplicitamente il permesso per questo sito.`,
    );
  }
}
