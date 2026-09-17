// Tipi condivisi, catalogo provider, storage (settings/chiave/inbox/cronologia)
// e protocollo panel↔worker con validazione zod.
//
// Nota privacy: la chiave API NON vive nelle impostazioni. È in un record
// separato, in chrome.storage.local ("ricorda") o chrome.storage.session
// (svuotato alla chiusura di Chrome).

import { z } from 'zod';
import type { ApprovalPolicy } from './approval';
import type { Schedule } from './schedules';

export type { ApprovalPolicy };

export interface RunSummary {
  task: string;
  at: number;
  steps: number;
  tokens: number;
}

const LAST_RUNS_MAX = 10;

/** Lista pura (testata): voce troncata + cap 10. */
export function buildLastRuns(list: RunSummary[], entry: RunSummary): RunSummary[] {
  const clean: RunSummary = {
    task: entry.task.slice(0, 200),
    at: entry.at,
    steps: entry.steps,
    tokens: entry.tokens,
  };
  return [clean, ...list].slice(0, LAST_RUNS_MAX);
}

export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'xai'
  | 'azure'
  | 'groq'
  | 'deepseek'
  | 'cerebras'
  | 'mistral'
  | 'openrouter'
  | 'nvidia'
  | 'opencode'
  | 'cohere'
  | 'deepinfra'
  | 'fireworks'
  | 'perplexity'
  | 'togetherai'
  | 'huggingface'
  | 'github'
  | 'gateway'
  | 'baseten'
  | 'sambanova'
  | 'ollama'
  | 'lmstudio'
  | 'custom';

/** Gruppo UI nella select: cloud diretto, gateway/aggregatore, locale. */
export type ProviderGroup = 'cloud' | 'gateway' | 'local';

export interface ProviderDef {
  id: ProviderId;
  name: string;
  group: ProviderGroup;
  /** Se false, la chiave è opzionale (es. Ollama in locale). */
  needsKey: boolean;
  defaultModel: string;
  models: string[];
  defaultBaseUrl?: string;
  keyUrl?: string;
  /** L'agente invia screenshot al modello: serve un modello con input immagini. */
  supportsVision: boolean;
  /** Id della credenziale nell'auth.json di opencode (per l'import via bridge). */
  opencodeId?: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    group: 'cloud',
    opencodeId: 'openai',
    needsKey: true,
    defaultModel: 'gpt-5.6',
    models: ['gpt-5.6', 'gpt-5.5', 'gpt-5-mini', 'gpt-4.1-mini'],
    keyUrl: 'https://platform.openai.com/api-keys',
    supportsVision: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    group: 'cloud',
    opencodeId: 'anthropic',
    needsKey: true,
    defaultModel: 'claude-sonnet-5',
    models: ['claude-sonnet-5', 'claude-haiku-4-5', 'claude-opus-4-6'],
    keyUrl: 'https://console.anthropic.com/',
    supportsVision: true,
  },
  {
    id: 'google',
    name: 'Google Gemini',
    group: 'cloud',
    opencodeId: 'google',
    needsKey: true,
    defaultModel: 'gemini-3.8-flash',
    models: ['gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-2.5-flash'],
    keyUrl: 'https://aistudio.google.com/apikey',
    supportsVision: true,
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    group: 'cloud',
    opencodeId: 'xai',
    needsKey: true,
    defaultModel: 'grok-4.6',
    models: ['grok-4.6', 'grok-4-fast-reasoning'],
    keyUrl: 'https://console.x.ai/',
    supportsVision: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    group: 'cloud',
    opencodeId: 'deepseek',
    needsKey: true,
    defaultModel: 'deepseek-v4-flash',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    keyUrl: 'https://platform.deepseek.com/api_keys',
    supportsVision: false,
  },
  {
    id: 'groq',
    name: 'Groq',
    group: 'cloud',
    opencodeId: 'groq',
    needsKey: true,
    defaultModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
    models: ['meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b'],
    keyUrl: 'https://console.groq.com/keys',
    supportsVision: true,
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    group: 'cloud',
    opencodeId: 'cerebras',
    needsKey: true,
    defaultModel: 'gemma-4-31b',
    models: ['gemma-4-31b', 'gpt-oss-120b'],
    keyUrl: 'https://cloud.cerebras.ai/',
    supportsVision: true,
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    group: 'cloud',
    opencodeId: 'mistral',
    needsKey: true,
    defaultModel: 'pixtral-large-latest',
    models: ['pixtral-large-latest', 'mistral-large-latest'],
    keyUrl: 'https://console.mistral.ai/api-keys',
    supportsVision: true,
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    group: 'cloud',
    needsKey: true,
    defaultModel: '',
    models: [],
    defaultBaseUrl: 'https://<risorsa>.openai.azure.com',
    keyUrl: 'https://portal.azure.com/',
    supportsVision: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    group: 'gateway',
    needsKey: true,
    defaultModel: 'anthropic/claude-sonnet-5',
    models: ['anthropic/claude-sonnet-5', 'openai/gpt-5.6', 'google/gemini-3.8-flash'],
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    keyUrl: 'https://openrouter.ai/keys',
    supportsVision: true,
  },
  {
    id: 'ollama',
    name: 'Ollama (locale)',
    group: 'local',
    needsKey: false,
    defaultModel: 'qwen3:8b',
    models: ['qwen3:8b', 'mistral-small:24b', 'qwen2.5-coder:14b'],
    defaultBaseUrl: 'http://localhost:11434/v1',
    supportsVision: true,
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (locale)',
    group: 'local',
    needsKey: false,
    defaultModel: '',
    models: [],
    defaultBaseUrl: 'http://localhost:1234/v1',
    supportsVision: true,
  },
  {
    id: 'custom',
    name: 'OpenAI-compatibile',
    group: 'local',
    needsKey: false,
    defaultModel: '',
    models: [],
    supportsVision: true,
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    group: 'cloud',
    opencodeId: 'nvidia',
    needsKey: true,
    defaultModel: 'meta/llama-3.3-70b-instruct',
    models: ['meta/llama-3.3-70b-instruct', 'deepseek-ai/deepseek-r1', 'nvidia/llama-3.1-nemotron-70b-instruct'],
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    keyUrl: 'https://build.nvidia.com/',
    supportsVision: false,
  },
  {
    id: 'opencode',
    name: 'OpenCode Zen',
    group: 'gateway',
    opencodeId: 'opencode',
    needsKey: true,
    defaultModel: 'claude-sonnet-5',
    models: ['claude-sonnet-5', 'claude-haiku-4-5', 'gemini-3.8-flash', 'gpt-5.5'],
    defaultBaseUrl: 'https://opencode.ai/zen/v1',
    keyUrl: 'https://opencode.ai/auth',
    supportsVision: true,
  },
  {
    id: 'cohere',
    name: 'Cohere',
    group: 'cloud',
    opencodeId: 'cohere',
    needsKey: true,
    defaultModel: 'command-a-03-2025',
    models: ['command-a-03-2025', 'command-r-plus-08-2024'],
    keyUrl: 'https://dashboard.cohere.com/api-keys',
    supportsVision: false,
  },
  {
    id: 'deepinfra',
    name: 'DeepInfra',
    group: 'cloud',
    opencodeId: 'deepinfra',
    needsKey: true,
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct',
    models: ['meta-llama/Llama-3.3-70B-Instruct', 'Qwen/Qwen2.5-72B-Instruct'],
    keyUrl: 'https://deepinfra.com/dash/api_keys',
    supportsVision: false,
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    group: 'cloud',
    opencodeId: 'fireworks-ai',
    needsKey: true,
    defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    models: ['accounts/fireworks/models/llama-v3p3-70b-instruct', 'accounts/fireworks/models/qwen3-235b-a22b'],
    keyUrl: 'https://fireworks.ai/account/api-keys',
    supportsVision: false,
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    group: 'cloud',
    needsKey: true,
    defaultModel: 'sonar-pro',
    models: ['sonar-pro', 'sonar'],
    keyUrl: 'https://www.perplexity.ai/account/api/group',
    supportsVision: false,
  },
  {
    id: 'togetherai',
    name: 'Together AI',
    group: 'cloud',
    opencodeId: 'togetherai',
    needsKey: true,
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'deepseek-ai/DeepSeek-V3'],
    keyUrl: 'https://api.together.ai/settings/api-keys',
    supportsVision: false,
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    group: 'cloud',
    opencodeId: 'huggingface',
    needsKey: true,
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct',
    models: ['meta-llama/Llama-3.3-70B-Instruct', 'Qwen/Qwen2.5-72B-Instruct'],
    keyUrl: 'https://huggingface.co/settings/tokens',
    supportsVision: false,
  },
  {
    id: 'github',
    name: 'GitHub Models',
    group: 'gateway',
    needsKey: true,
    defaultModel: 'openai/gpt-4.1',
    models: ['openai/gpt-4.1', 'openai/gpt-4o', 'meta/Llama-3.3-70B-Instruct'],
    defaultBaseUrl: 'https://models.github.ai/inference',
    keyUrl: 'https://github.com/settings/tokens',
    supportsVision: true,
  },
  {
    id: 'gateway',
    name: 'Vercel AI Gateway',
    group: 'gateway',
    needsKey: true,
    defaultModel: 'anthropic/claude-sonnet-4.5',
    models: ['anthropic/claude-sonnet-4.5', 'openai/gpt-4.1', 'google/gemini-2.5-flash'],
    keyUrl: 'https://vercel.com/ai-gateway',
    supportsVision: true,
  },
  {
    id: 'baseten',
    name: 'Baseten',
    group: 'cloud',
    needsKey: true,
    defaultModel: '',
    models: [],
    defaultBaseUrl: 'https://inference.baseten.co/v1',
    keyUrl: 'https://app.baseten.co/settings/api_keys',
    supportsVision: false,
  },
  {
    id: 'sambanova',
    name: 'SambaNova',
    group: 'cloud',
    needsKey: true,
    defaultModel: 'Meta-Llama-3.3-70B-Instruct',
    models: ['Meta-Llama-3.3-70B-Instruct', 'DeepSeek-R1'],
    defaultBaseUrl: 'https://api.sambanova.ai/v1',
    keyUrl: 'https://cloud.sambanova.ai/apis',
    supportsVision: false,
  },
];

export function getProvider(id: ProviderId): ProviderDef {
  const found = PROVIDERS.find((p) => p.id === id);
  if (!found) throw new Error(`Provider sconosciuto: ${id}`);
  return found;
}

export const MAX_TASK_CHARS = 4000;
export const MAX_SNAPSHOT_CHARS = 12_000;

export type Theme = 'auto' | 'dark' | 'light';
export type Locale = 'auto' | 'it' | 'en';

export interface Settings {
  providerId: ProviderId;
  model: string;
  baseUrl: string;
  maxSteps: number;
  maxRetries: number;
  runTimeoutMin: number;
  approvalTimeoutSec: number;
  snapshotMaxChars: number;
  rememberKey: boolean;
  privacyMaskPii: boolean;
  privacyHidePasswords: boolean;
  privacyHostOnly: boolean;
  keepHistory: boolean;
  approval: ApprovalPolicy;
  sendScreenshots: boolean;
  allowedDomains: string;
  trustedDomains: string[];
  savedPrompts: string[];
  theme: Theme;
  locale: Locale;
  maxTokensPerRun: number;
  stopText: string;
  soundOnDone: boolean;
  compactLog: boolean;
  lastRuns: RunSummary[];
  schedules: Schedule[];
}

export const SETTINGS_KEY = 'lmuse.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  providerId: 'openai',
  model: 'gpt-5.6',
  baseUrl: '',
  maxSteps: 25,
  maxRetries: 2,
  runTimeoutMin: 15,
  approvalTimeoutSec: 120,
  snapshotMaxChars: MAX_SNAPSHOT_CHARS,
  rememberKey: true,
  privacyMaskPii: true,
  privacyHidePasswords: true,
  privacyHostOnly: false,
  keepHistory: true,
  approval: 'sensitive',
  sendScreenshots: true,
  allowedDomains: '',
  trustedDomains: [],
  savedPrompts: [],
  theme: 'auto',
  locale: 'auto',
  maxTokensPerRun: 60000,
  stopText: '',
  soundOnDone: false,
  compactLog: false,
  lastRuns: [],
  schedules: [],
};

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Normalizza le impostazioni: clamp numerici, trim stringhe, enum validi. */
export function sanitizeSettings(raw: Partial<Settings> | undefined): Settings {
  const base = { ...DEFAULT_SETTINGS, ...(raw ?? {}) } as Settings;
  const providerId = (
    PROVIDERS.some((p) => p.id === base.providerId) ? base.providerId : 'openai'
  ) as ProviderId;
  const approval: ApprovalPolicy = ['off', 'sensitive', 'all'].includes(base.approval)
    ? base.approval
    : DEFAULT_SETTINGS.approval;
  return {
    providerId,
    model: String(base.model ?? '')
      .trim()
      .slice(0, 200),
    baseUrl: String(base.baseUrl ?? '')
      .trim()
      .slice(0, 500),
    maxSteps: clamp(Number(base.maxSteps), 3, 100, DEFAULT_SETTINGS.maxSteps),
    maxRetries: clamp(Number(base.maxRetries), 0, 6, DEFAULT_SETTINGS.maxRetries),
    runTimeoutMin: clamp(Number(base.runTimeoutMin), 1, 120, DEFAULT_SETTINGS.runTimeoutMin),
    approvalTimeoutSec: clamp(Number(base.approvalTimeoutSec), 30, 300, DEFAULT_SETTINGS.approvalTimeoutSec),
    snapshotMaxChars: clamp(Number(base.snapshotMaxChars), 4000, 20000, DEFAULT_SETTINGS.snapshotMaxChars),
    rememberKey: Boolean(base.rememberKey),
    privacyMaskPii: Boolean(base.privacyMaskPii),
    privacyHidePasswords: Boolean(base.privacyHidePasswords),
    privacyHostOnly: Boolean(base.privacyHostOnly),
    keepHistory: base.keepHistory !== false,
    approval,
    sendScreenshots: Boolean(base.sendScreenshots),
    allowedDomains: normalizeDomainsCsv(String(base.allowedDomains ?? '')),
    trustedDomains: sanitizeDomainList(base.trustedDomains).slice(0, 50),
    savedPrompts: sanitizePromptList(base.savedPrompts).slice(0, 20),
    theme: ['auto', 'dark', 'light'].includes(base.theme) ? base.theme : 'auto',
    locale: ['auto', 'it', 'en'].includes(base.locale) ? base.locale : 'auto',
    maxTokensPerRun: clamp(Number(base.maxTokensPerRun), 1000, 200000, DEFAULT_SETTINGS.maxTokensPerRun),
    stopText: String(base.stopText ?? '')
      .trim()
      .slice(0, 200),
    soundOnDone: Boolean(base.soundOnDone),
    compactLog: Boolean(base.compactLog),
    lastRuns: sanitizeLastRuns(base.lastRuns),
    schedules: sanitizeSchedules(base.schedules),
  };
}

/** Lowercase + spazi uniformati nella CSV domini. */
export function normalizeDomainsCsv(csv: string): string {
  return csv
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
    .join(', ')
    .slice(0, 500);
}

/** Lista domini fidati normalizzata (lowercase, dedup). */
export function sanitizeDomainList(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  for (const item of list) {
    const d = String(item ?? '')
      .trim()
      .toLowerCase();
    if (d && !seen.has(d)) seen.add(d);
  }
  return [...seen];
}

const PROMPT_MAX = 20;
const PROMPT_ENTRY_MAX = 300;

/** Lista pura (testata): trim + truncate + dedup + cap. */
export function buildPromptList(list: string[], entry: string): string[] {
  const clean = entry.trim().slice(0, PROMPT_ENTRY_MAX);
  if (!clean) return list;
  return [clean, ...list.filter((t) => t !== clean)].slice(0, PROMPT_MAX);
}

function sanitizePromptList(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const item of list) {
    const clean = String(item ?? '')
      .trim()
      .slice(0, PROMPT_ENTRY_MAX);
    if (clean && !out.includes(clean)) out.push(clean);
    if (out.length >= PROMPT_MAX) break;
  }
  return out;
}

function sanitizeLastRuns(list: unknown): RunSummary[] {
  if (!Array.isArray(list)) return [];
  const out: RunSummary[] = [];
  for (const item of list.slice(0, LAST_RUNS_MAX)) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r['task'] !== 'string') continue;
    out.push({
      task: r['task'].slice(0, 200),
      at: typeof r['at'] === 'number' ? r['at'] : 0,
      steps: typeof r['steps'] === 'number' ? r['steps'] : 0,
      tokens: typeof r['tokens'] === 'number' ? r['tokens'] : 0,
    });
  }
  return out;
}

function sanitizeSchedules(list: unknown): Schedule[] {
  if (!Array.isArray(list)) return [];
  const out: Schedule[] = [];
  for (const item of list.slice(0, 5)) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r['id'] !== 'string' || typeof r['task'] !== 'string') continue;
    const interval = Number(r['intervalMin']);
    if (!Number.isInteger(interval) || interval < 60 || interval > 10080) continue;
    out.push({
      id: r['id'].slice(0, 64),
      task: r['task'].slice(0, 4000),
      intervalMin: interval,
      enabled: r['enabled'] !== false,
      createdAt: typeof r['createdAt'] === 'number' ? r['createdAt'] : 0,
      ...(typeof r['lastFire'] === 'number' ? { lastFire: r['lastFire'] } : {}),
    });
  }
  return out;
}

export interface RunPreset {
  id: string;
  patch: Partial<Settings>;
}

/** Preset veloci: combinazioni sensate, mai la chiave. */
export const PRESETS: RunPreset[] = [
  { id: 'fast', patch: { maxSteps: 12, sendScreenshots: false } },
  { id: 'precise', patch: { maxSteps: 40, maxRetries: 4, sendScreenshots: true } },
  {
    id: 'local',
    patch: { providerId: 'ollama', model: 'qwen3:8b', baseUrl: 'http://localhost:11434/v1' },
  },
];

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return sanitizeSettings(stored[SETTINGS_KEY] as Partial<Settings> | undefined);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: sanitizeSettings(settings) });
}

// --- Chiave API (record separato, local o session) ---

export const KEY_STORE_KEY = 'lmuse.key.v1';
export const KEY_STORE_V2 = 'lmuse.keys.v2';

type KeyMap = Record<string, string>;

async function loadKeyMap(rememberKey: boolean): Promise<KeyMap> {
  const store = rememberKey ? chrome.storage.local : chrome.storage.session;
  const raw = await store.get(KEY_STORE_V2);
  const map = raw[KEY_STORE_V2];
  return map && typeof map === 'object' && !Array.isArray(map) ? (map as KeyMap) : {};
}

/** Chiave del provider: prima la mappa v2, poi migrazione lazy da v1. */
export async function loadApiKey(providerId: ProviderId, rememberKey: boolean): Promise<string> {
  const map = await loadKeyMap(rememberKey);
  const own = map[providerId];
  if (typeof own === 'string' && own) return own;
  // Migrazione lazy dalla chiave singola v1: vale per il provider corrente.
  const legacy = await loadStoredKey(rememberKey);
  if (legacy) {
    await saveApiKey(providerId, legacy, rememberKey);
    await clearStoredKey();
    return legacy;
  }
  return '';
}

export async function saveApiKey(providerId: ProviderId, key: string, rememberKey: boolean): Promise<void> {
  const map = await loadKeyMap(rememberKey);
  if (key.trim()) map[providerId] = key.trim();
  else delete map[providerId];
  const store = rememberKey ? chrome.storage.local : chrome.storage.session;
  await store.set({ [KEY_STORE_V2]: map });
  // Meta: quando la chiave è stata salvata (per l'hint rotazione, solo locale).
  if (key.trim()) {
    const metaRaw = await chrome.storage.local.get(KEYS_META_KEY);
    const meta = metaRaw[KEYS_META_KEY] && typeof metaRaw[KEYS_META_KEY] === 'object' ? (metaRaw[KEYS_META_KEY] as Record<string, unknown>) : {};
    meta[providerId] = Date.now();
    await chrome.storage.local.set({ [KEYS_META_KEY]: meta });
  }
}

export const KEYS_META_KEY = 'lmuse.keysmeta.v1';
export const KEY_AGE_WARN_DAYS = 90;

/** Quando la chiave del provider è stata salvata (0 = mai/ignoto). */
export async function loadKeySavedAt(providerId: ProviderId): Promise<number> {
  const metaRaw = await chrome.storage.local.get(KEYS_META_KEY);
  const meta = metaRaw[KEYS_META_KEY];
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return 0;
  const at = (meta as Record<string, unknown>)[providerId];
  return typeof at === 'number' && Number.isFinite(at) && at > 0 ? at : 0;
}

/** Età chiave in giorni (0 = mai salvata). */
export function keyAgeDays(savedAt: number, now = Date.now()): number {
  if (!savedAt) return 0;
  return Math.max(0, Math.floor((now - savedAt) / 86_400_000));
}

/** Hint rotazione: true se la chiave è vecchia (> 90gg). Pura, testata. */
export function keyRotationDue(savedAt: number, now = Date.now()): boolean {
  return keyAgeDays(savedAt, now) > KEY_AGE_WARN_DAYS;
}

/** Rimuove la chiave di un provider da entrambi gli storage. */
export async function clearApiKey(providerId: ProviderId): Promise<void> {
  for (const rememberKey of [true, false]) {
    const map = await loadKeyMap(rememberKey);
    if (providerId in map) {
      delete map[providerId];
      const store = rememberKey ? chrome.storage.local : chrome.storage.session;
      await store.set({ [KEY_STORE_V2]: map });
    }
  }
}

/** Quante chiavi salvate (per la card opencode / diagnostica, senza valori). */
export async function countApiKeys(rememberKey: boolean): Promise<number> {
  return Object.values(await loadKeyMap(rememberKey)).filter(Boolean).length;
}

export async function loadStoredKey(rememberKey: boolean): Promise<string> {
  if (rememberKey) {
    const local = await chrome.storage.local.get(KEY_STORE_KEY);
    return String(local[KEY_STORE_KEY] ?? '');
  }
  const session = await chrome.storage.session.get(KEY_STORE_KEY);
  return String(session[KEY_STORE_KEY] ?? '');
}

export async function saveStoredKey(key: string, rememberKey: boolean): Promise<void> {
  const trimmed = key.trim();
  const other = rememberKey ? chrome.storage.session : chrome.storage.local;
  await other.remove(KEY_STORE_KEY);
  if (!trimmed) return;
  const target = rememberKey ? chrome.storage.local : chrome.storage.session;
  await target.set({ [KEY_STORE_KEY]: trimmed });
}

export async function clearStoredKey(): Promise<void> {
  await chrome.storage.local.remove(KEY_STORE_KEY);
  await chrome.storage.session.remove(KEY_STORE_KEY);
}

/** Cancella TUTTO: chiave, impostazioni, cronologia, inbox, usage, onboarding, alarms. */
export async function clearAllData(): Promise<void> {
  await clearStoredKey();
  await chrome.storage.local.remove(KEY_STORE_V2);
  await chrome.storage.session.remove(KEY_STORE_V2);
  await chrome.storage.local.remove([SETTINGS_KEY, HISTORY_KEY, USAGE_KEY, ONBOARDED_KEY, MODELS_CACHE_KEY]);
  await chrome.storage.session.remove([INBOX_KEY, RUN_STATE_KEY, QUEUE_KEY]);
  await chrome.alarms.clearAll().catch(() => undefined);
}

// --- Inbox: risultato dell'ultimo run (session, sopravvive alla chiusura del panel) ---

export const INBOX_KEY = 'lmuse.inbox.v1';

export interface InboxEntry {
  text: string;
  steps: number;
  at: number;
}

export async function saveInbox(entry: InboxEntry): Promise<void> {
  await chrome.storage.session.set({ [INBOX_KEY]: entry });
}

export async function loadInbox(): Promise<InboxEntry | null> {
  const stored = await chrome.storage.session.get(INBOX_KEY);
  return (stored[INBOX_KEY] as InboxEntry | undefined) ?? null;
}

export async function clearInbox(): Promise<void> {
  await chrome.storage.session.remove(INBOX_KEY);
}

// --- Cronologia task (local, max 20, dedup, voci troncate) ---

export const HISTORY_KEY = 'lmuse.history.v1';
const HISTORY_MAX = 20;
const HISTORY_ENTRY_MAX = 200;

export async function loadHistory(): Promise<string[]> {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  const list = stored[HISTORY_KEY];
  return Array.isArray(list) ? list.map(String).slice(0, HISTORY_MAX) : [];
}

export async function addHistoryTask(task: string, keep = true): Promise<void> {
  if (!keep) return;
  const entry = task.slice(0, HISTORY_ENTRY_MAX);
  const list = await loadHistory();
  await chrome.storage.local.set({ [HISTORY_KEY]: buildHistoryList(list, entry) });
}

/** Lista pura (testata): dedup + cap 20. */
export function buildHistoryList(list: string[], entry: string): string[] {
  return [entry, ...list.filter((t) => t !== entry)].slice(0, HISTORY_MAX);
}

export async function removeHistoryTask(task: string): Promise<void> {
  const list = await loadHistory();
  await chrome.storage.local.set({ [HISTORY_KEY]: list.filter((t) => t !== task) });
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.remove(HISTORY_KEY);
}

// --- Statistiche uso locali (local, solo conteggi: nessun contenuto) ---

export const USAGE_KEY = 'lmuse.usage.v1';

export interface UsageStats {
  runs: number;
  inputTokens: number;
  outputTokens: number;
}

export const EMPTY_USAGE: UsageStats = { runs: 0, inputTokens: 0, outputTokens: 0 };

function nonNegInt(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** Normalizza stats lette dallo storage (mai crash su dati corrotti). */
export function sanitizeUsage(raw: Partial<UsageStats> | undefined): UsageStats {
  if (!raw) return { ...EMPTY_USAGE };
  return {
    runs: nonNegInt(raw.runs),
    inputTokens: nonNegInt(raw.inputTokens),
    outputTokens: nonNegInt(raw.outputTokens),
  };
}

/** Somma pura, testata: +1 run e token sommati. */
export function mergeUsage(prev: UsageStats, add: { inputTokens: number; outputTokens: number }): UsageStats {
  return {
    runs: prev.runs + 1,
    inputTokens: prev.inputTokens + nonNegInt(add.inputTokens),
    outputTokens: prev.outputTokens + nonNegInt(add.outputTokens),
  };
}

export async function loadUsage(): Promise<UsageStats> {
  const stored = await chrome.storage.local.get(USAGE_KEY);
  return sanitizeUsage(stored[USAGE_KEY] as Partial<UsageStats> | undefined);
}

export async function saveUsage(stats: UsageStats): Promise<void> {
  await chrome.storage.local.set({ [USAGE_KEY]: stats });
}

// --- Onboarding first-run (local, flag) ---

export const ONBOARDED_KEY = 'lmuse.onboarded.v1';

export async function isOnboarded(): Promise<boolean> {
  const stored = await chrome.storage.local.get(ONBOARDED_KEY);
  return stored[ONBOARDED_KEY] === true;
}

export async function setOnboarded(): Promise<void> {
  await chrome.storage.local.set({ [ONBOARDED_KEY]: true });
}

// --- Run state (session): per rilevare SW riavviato mid-run ---

export const RUN_STATE_KEY = 'lmuse.runstate.v1';

export interface RunState {
  task: string;
  at: number;
}

export async function saveRunState(state: RunState): Promise<void> {
  await chrome.storage.session.set({ [RUN_STATE_KEY]: state });
}

export async function loadRunState(): Promise<RunState | null> {
  const stored = await chrome.storage.session.get(RUN_STATE_KEY);
  return (stored[RUN_STATE_KEY] as RunState | undefined) ?? null;
}

export async function clearRunState(): Promise<void> {
  await chrome.storage.session.remove(RUN_STATE_KEY);
}

// --- Cache modelli live (local): lista id letta dal provider ---

export const MODELS_CACHE_KEY = 'lmuse.models.v1';
const MODELS_CACHE_MAX = 500;

function sanitizeModelList(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  for (const item of list.slice(0, MODELS_CACHE_MAX)) {
    const id = String(item ?? '')
      .trim()
      .slice(0, 200);
    if (id && !seen.has(id)) seen.add(id);
  }
  return [...seen].slice(0, MODELS_CACHE_MAX);
}

/** Lista id modelli cache pure (testata): dedup + cap 500. */
export function buildModelsCache(prev: string[], fetched: string[]): string[] {
  const clean = sanitizeModelList(fetched);
  if (!clean.length) return sanitizeModelList(prev);
  return clean;
}

export async function loadModelsCache(providerId: ProviderId): Promise<string[]> {
  const raw = await chrome.storage.local.get(MODELS_CACHE_KEY);
  const map = raw[MODELS_CACHE_KEY];
  if (!map || typeof map !== 'object' || Array.isArray(map)) return [];
  const list = (map as Record<string, unknown>)[providerId];
  return sanitizeModelList(list);
}

export async function saveModelsCache(providerId: ProviderId, models: string[]): Promise<void> {
  const raw = await chrome.storage.local.get(MODELS_CACHE_KEY);
  const map =
    raw[MODELS_CACHE_KEY] && typeof raw[MODELS_CACHE_KEY] === 'object'
      ? (raw[MODELS_CACHE_KEY] as Record<string, unknown>)
      : {};
  map[providerId] = buildModelsCache(loadList(map[providerId]), models);
  await chrome.storage.local.set({ [MODELS_CACHE_KEY]: map });
}

function loadList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

// --- Coda task (session): max 5, avvio sequenziale a fine run ---

export const QUEUE_KEY = 'lmuse.queue.v1';
const QUEUE_MAX = 5;

export interface QueueEntry {
  id: string;
  task: string;
  addedAt: number;
}

/** Coda pura (testata): trim + truncate + cap 5. */
export function buildQueue(list: QueueEntry[], task: string): QueueEntry[] {
  const clean: QueueEntry = {
    id: `q-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    task: task.trim().slice(0, MAX_TASK_CHARS),
    addedAt: Date.now(),
  };
  return [...list, clean].slice(0, QUEUE_MAX);
}

export async function addToQueue(task: string): Promise<QueueEntry[]> {
  const list = await loadQueue();
  const next = buildQueue(list, task);
  await chrome.storage.session.set({ [QUEUE_KEY]: next });
  return next;
}

export async function popQueue(): Promise<QueueEntry | null> {
  const list = await loadQueue();
  const [first, ...rest] = list;
  if (!first) return null;
  await chrome.storage.session.set({ [QUEUE_KEY]: rest });
  return first;
}

export async function loadQueue(): Promise<QueueEntry[]> {
  const stored = await chrome.storage.session.get(QUEUE_KEY);
  const list = stored[QUEUE_KEY];
  if (!Array.isArray(list)) return [];
  const out: QueueEntry[] = [];
  for (const item of list.slice(0, QUEUE_MAX)) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r['task'] !== 'string' || !r['task'].trim()) continue;
    out.push({
      id: typeof r['id'] === 'string' ? r['id'].slice(0, 64) : 'q-x',
      task: r['task'].trim().slice(0, MAX_TASK_CHARS),
      addedAt: typeof r['addedAt'] === 'number' ? r['addedAt'] : 0,
    });
  }
  return out;
}

export async function clearQueue(): Promise<void> {
  await chrome.storage.session.remove(QUEUE_KEY);
}

// --- Protocollo sulla Port 'lmuse' (validato con zod) ---

const ApprovalId = z.string().min(1).max(64);

export const PanelToSwSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('RUN'), task: z.string().min(1).max(MAX_TASK_CHARS) }),
  z.object({ type: z.literal('STOP') }),
  z.object({ type: z.literal('QUEUE'), task: z.string().min(1).max(MAX_TASK_CHARS) }),
  z.object({ type: z.literal('APPROVE'), id: ApprovalId }),
  z.object({ type: z.literal('DENY'), id: ApprovalId }),
]);

export type PanelToSwMessage = z.infer<typeof PanelToSwSchema>;

export type SwToPanelMessage =
  | { type: 'STATUS'; running: boolean }
  | { type: 'STEP'; index: number; tool: string; input: unknown; result?: string }
  | { type: 'STREAM'; text: string }
  | {
      type: 'DONE';
      text: string;
      steps: number;
      inputTokens: number;
      outputTokens: number;
      elapsedMs: number;
    }
  | { type: 'ERROR'; message: string }
  | { type: 'QUEUE_ADDED'; position: number; size: number }
  | { type: 'APPROVAL'; id: string; tool: string; description: string; timeoutSec: number; domain?: string };
