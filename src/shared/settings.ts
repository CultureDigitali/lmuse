// Tipi condivisi, catalogo provider, storage (settings/chiave/inbox/cronologia)
// e protocollo panel↔worker con validazione zod.
//
// Nota privacy: la chiave API NON vive nelle impostazioni. È in un record
// separato, in chrome.storage.local ("ricorda") o chrome.storage.session
// (svuotato alla chiusura di Chrome).

import { z } from 'zod';

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
  | 'ollama'
  | 'lmstudio'
  | 'custom';

export interface ProviderDef {
  id: ProviderId;
  name: string;
  /** Se false, la chiave è opzionale (es. Ollama in locale). */
  needsKey: boolean;
  defaultModel: string;
  models: string[];
  defaultBaseUrl?: string;
  keyUrl?: string;
  /** L'agente invia screenshot al modello: serve un modello con input immagini. */
  supportsVision: boolean;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    needsKey: true,
    defaultModel: 'gpt-5.6',
    models: ['gpt-5.6', 'gpt-5.5', 'gpt-5-mini', 'gpt-4.1-mini'],
    keyUrl: 'https://platform.openai.com/api-keys',
    supportsVision: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    needsKey: true,
    defaultModel: 'claude-sonnet-5',
    models: ['claude-sonnet-5', 'claude-haiku-4-5', 'claude-opus-4-6'],
    keyUrl: 'https://console.anthropic.com/',
    supportsVision: true,
  },
  {
    id: 'google',
    name: 'Google Gemini',
    needsKey: true,
    defaultModel: 'gemini-3.8-flash',
    models: ['gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-2.5-flash'],
    keyUrl: 'https://aistudio.google.com/apikey',
    supportsVision: true,
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    needsKey: true,
    defaultModel: 'grok-4.6',
    models: ['grok-4.6', 'grok-4-fast-reasoning'],
    keyUrl: 'https://console.x.ai/',
    supportsVision: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    needsKey: true,
    defaultModel: 'deepseek-v4-flash',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    keyUrl: 'https://platform.deepseek.com/api_keys',
    supportsVision: false,
  },
  {
    id: 'groq',
    name: 'Groq',
    needsKey: true,
    defaultModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
    models: ['meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b'],
    keyUrl: 'https://console.groq.com/keys',
    supportsVision: true,
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    needsKey: true,
    defaultModel: 'gemma-4-31b',
    models: ['gemma-4-31b', 'gpt-oss-120b'],
    keyUrl: 'https://cloud.cerebras.ai/',
    supportsVision: true,
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    needsKey: true,
    defaultModel: 'pixtral-large-latest',
    models: ['pixtral-large-latest', 'mistral-large-latest'],
    keyUrl: 'https://console.mistral.ai/api-keys',
    supportsVision: true,
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
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
    needsKey: false,
    defaultModel: 'qwen3:8b',
    models: ['qwen3:8b', 'mistral-small:24b', 'qwen2.5-coder:14b'],
    defaultBaseUrl: 'http://localhost:11434/v1',
    supportsVision: true,
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (locale)',
    needsKey: false,
    defaultModel: '',
    models: [],
    defaultBaseUrl: 'http://localhost:1234/v1',
    supportsVision: true,
  },
  {
    id: 'custom',
    name: 'OpenAI-compatibile',
    needsKey: false,
    defaultModel: '',
    models: [],
    supportsVision: true,
  },
];

export function getProvider(id: ProviderId): ProviderDef {
  const found = PROVIDERS.find((p) => p.id === id);
  if (!found) throw new Error(`Provider sconosciuto: ${id}`);
  return found;
}

export const MAX_TASK_CHARS = 4000;
export const MAX_SNAPSHOT_CHARS = 12_000;

export interface Settings {
  providerId: ProviderId;
  model: string;
  baseUrl: string;
  maxSteps: number;
  maxRetries: number;
  runTimeoutMin: number;
  rememberKey: boolean;
  privacyMaskPii: boolean;
  privacyHidePasswords: boolean;
  sendScreenshots: boolean;
  allowedDomains: string;
}

export const SETTINGS_KEY = 'lmuse.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  providerId: 'openai',
  model: 'gpt-5.6',
  baseUrl: '',
  maxSteps: 25,
  maxRetries: 2,
  runTimeoutMin: 15,
  rememberKey: true,
  privacyMaskPii: true,
  privacyHidePasswords: true,
  sendScreenshots: true,
  allowedDomains: '',
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
    rememberKey: Boolean(base.rememberKey),
    privacyMaskPii: Boolean(base.privacyMaskPii),
    privacyHidePasswords: Boolean(base.privacyHidePasswords),
    sendScreenshots: Boolean(base.sendScreenshots),
    allowedDomains: String(base.allowedDomains ?? '').slice(0, 500),
  };
}

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return sanitizeSettings(stored[SETTINGS_KEY] as Partial<Settings> | undefined);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: sanitizeSettings(settings) });
}

// --- Chiave API (record separato, local o session) ---

export const KEY_STORE_KEY = 'lmuse.key.v1';

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

/** Cancella TUTTO: chiave, impostazioni, cronologia, inbox. */
export async function clearAllData(): Promise<void> {
  await clearStoredKey();
  await chrome.storage.local.remove([SETTINGS_KEY, HISTORY_KEY]);
  await chrome.storage.session.remove([INBOX_KEY]);
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

// --- Cronologia task (local, max 20, dedup) ---

export const HISTORY_KEY = 'lmuse.history.v1';
const HISTORY_MAX = 20;

export async function loadHistory(): Promise<string[]> {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  const list = stored[HISTORY_KEY];
  return Array.isArray(list) ? list.map(String).slice(0, HISTORY_MAX) : [];
}

export async function addHistoryTask(task: string): Promise<void> {
  const list = await loadHistory();
  const next = [task, ...list.filter((t) => t !== task)].slice(0, HISTORY_MAX);
  await chrome.storage.local.set({ [HISTORY_KEY]: next });
}

export async function removeHistoryTask(task: string): Promise<void> {
  const list = await loadHistory();
  await chrome.storage.local.set({ [HISTORY_KEY]: list.filter((t) => t !== task) });
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.remove(HISTORY_KEY);
}

// --- Protocollo sulla Port 'lmuse' (validato con zod) ---

export const PanelToSwSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('RUN'), task: z.string().min(1).max(MAX_TASK_CHARS) }),
  z.object({ type: z.literal('STOP') }),
]);

export type PanelToSwMessage = z.infer<typeof PanelToSwSchema>;

export type SwToPanelMessage =
  | { type: 'STATUS'; running: boolean }
  | { type: 'STEP'; index: number; tool: string; input: unknown; result?: string }
  | { type: 'DONE'; text: string; steps: number }
  | { type: 'ERROR'; message: string };
