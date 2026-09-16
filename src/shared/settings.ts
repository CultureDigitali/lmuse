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
  await chrome.storage.local.remove([SETTINGS_KEY, HISTORY_KEY, USAGE_KEY, ONBOARDED_KEY]);
  await chrome.storage.session.remove([INBOX_KEY, RUN_STATE_KEY]);
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

// --- Protocollo sulla Port 'lmuse' (validato con zod) ---

const ApprovalId = z.string().min(1).max(64);

export const PanelToSwSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('RUN'), task: z.string().min(1).max(MAX_TASK_CHARS) }),
  z.object({ type: z.literal('STOP') }),
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
  | { type: 'APPROVAL'; id: string; tool: string; description: string; timeoutSec: number; domain?: string };
