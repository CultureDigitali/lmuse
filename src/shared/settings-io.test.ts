import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addHistoryTask,
  clearAllData,
  clearHistory,
  clearInbox,
  clearRunState,
  clearStoredKey,
  isOnboarded,
  loadHistory,
  loadInbox,
  loadRunState,
  loadSettings,
  loadStoredKey,
  loadUsage,
  mergeUsage,
  removeHistoryTask,
  saveInbox,
  saveRunState,
  saveSettings,
  saveStoredKey,
  saveUsage,
  setOnboarded,
  clearApiKey,
  countApiKeys,
  loadApiKey,
  saveApiKey,
} from './settings';

function makeArea() {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: vi.fn(async (keys: string | string[]) => {
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((k) => k in data).map((k) => [k, data[k]]));
    }),
    set: vi.fn(async (obj: Record<string, unknown>) => {
      Object.assign(data, obj);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete data[k];
    }),
  };
}

const local = makeArea();
const session = makeArea();

vi.stubGlobal('chrome', {
  storage: { local, session },
  alarms: { clearAll: vi.fn(async () => true) },
});

beforeEach(() => {
  for (const area of [local, session]) for (const k of Object.keys(area.data)) delete area.data[k];
});

describe('settings io', () => {
  it('save→load roundtrip con sanitize', async () => {
    const s = await loadSettings();
    await saveSettings({ ...s, maxSteps: 999, allowedDomains: ' B.it' });
    const re = await loadSettings();
    expect(re.maxSteps).toBe(100);
    expect(re.allowedDomains).toBe('b.it');
  });
});

describe('chiave', () => {
  it('remember=true → local, false → session', async () => {
    await saveStoredKey('k-12345678', true);
    expect(await loadStoredKey(true)).toBe('k-12345678');
    expect(await loadStoredKey(false)).toBe('');
    await saveStoredKey('k-abcdefgh', false);
    expect(await loadStoredKey(false)).toBe('k-abcdefgh');
    expect(local.data['lmuse.key.v1']).toBeUndefined();
  });
  it('clearStoredKey svuota entrambi', async () => {
    await saveStoredKey('k-12345678', true);
    await saveStoredKey('k-abcdefgh', false);
    await clearStoredKey();
    expect(await loadStoredKey(true)).toBe('');
    expect(await loadStoredKey(false)).toBe('');
  });
});

describe('inbox', () => {
  it('null → save → load → clear', async () => {
    expect(await loadInbox()).toBeNull();
    await saveInbox({ text: 'fatto', steps: 3, at: 1 });
    expect(await loadInbox()).toEqual({ text: 'fatto', steps: 3, at: 1 });
    await clearInbox();
    expect(await loadInbox()).toBeNull();
  });
});

describe('history io', () => {
  it('add/dedup/remove/clear + keep=false', async () => {
    await addHistoryTask('task uno, abbastanza lungo da testare il troncamento'.repeat(10), true);
    const list = await loadHistory();
    expect(list).toHaveLength(1);
    expect(list[0].length).toBeLessThanOrEqual(200);
    await addHistoryTask('task uno, abbastanza lungo da testare il troncamento'.repeat(10), true);
    await addHistoryTask('secondo', true);
    expect(await loadHistory()).toHaveLength(2);
    await addHistoryTask('terzo', false);
    expect(await loadHistory()).toHaveLength(2);
    await removeHistoryTask('secondo');
    expect(await loadHistory()).toHaveLength(1);
    await clearHistory();
    expect(await loadHistory()).toEqual([]);
  });
  it('mergeUsage via save/load', async () => {
    await saveUsage(mergeUsage(await loadUsage(), { inputTokens: 5, outputTokens: 7 }));
    expect(await loadUsage()).toEqual({ runs: 1, inputTokens: 5, outputTokens: 7 });
  });
});

describe('onboarding e runstate', () => {
  it('flag e state', async () => {
    expect(await isOnboarded()).toBe(false);
    await setOnboarded();
    expect(await isOnboarded()).toBe(true);
    expect(await loadRunState()).toBeNull();
    await saveRunState({ task: 't', at: 9 });
    expect(await loadRunState()).toEqual({ task: 't', at: 9 });
    await clearRunState();
    expect(await loadRunState()).toBeNull();
  });
});

describe('chiavi per-provider (v2)', () => {
  it('save/load roundtrip per due provider indipendenti', async () => {
    await saveApiKey('openai', 'sk-openai-xxx', true);
    await saveApiKey('nvidia', 'nvapi-yyy', true);
    expect(await loadApiKey('openai', true)).toBe('sk-openai-xxx');
    expect(await loadApiKey('nvidia', true)).toBe('nvapi-yyy');
    expect(await loadApiKey('anthropic', true)).toBe('');
    expect(await countApiKeys(true)).toBe(2);
  });
  it('session separata da local', async () => {
    await saveApiKey('openai', 'loc-key', true);
    await saveApiKey('openai', 'ses-key', false);
    expect(await loadApiKey('openai', true)).toBe('loc-key');
    expect(await loadApiKey('openai', false)).toBe('ses-key');
  });
  it('clearApiKey rimuove solo quel provider', async () => {
    await saveApiKey('openai', 'a', true);
    await saveApiKey('nvidia', 'b', true);
    await clearApiKey('openai');
    expect(await loadApiKey('openai', true)).toBe('');
    expect(await loadApiKey('nvidia', true)).toBe('b');
  });
  it('saveApiKey con stringa vuota rimuove la voce', async () => {
    await saveApiKey('openai', 'x', true);
    await saveApiKey('openai', '', true);
    expect(await loadApiKey('openai', true)).toBe('');
    expect(await countApiKeys(true)).toBe(0);
  });
  it('migrazione lazy da v1 → v2 sul provider corrente', async () => {
    await saveStoredKey('legacy-key-123', true);
    expect(await loadApiKey('deepseek', true)).toBe('legacy-key-123');
    // v1 consumata, v2 popolata:
    expect(await loadStoredKey(true)).toBe('');
    expect(local.data['lmuse.keys.v2']).toEqual({ deepseek: 'legacy-key-123' });
  });
  it('mappa v2 corrotta (array) → vuota', async () => {
    local.data['lmuse.keys.v2'] = ['spazzatura'];
    expect(await loadApiKey('openai', true)).toBe('');
  });
  it('clearAllData cancella anche la mappa v2', async () => {
    await saveApiKey('openai', 'z', true);
    await clearAllData();
    expect(await countApiKeys(true)).toBe(0);
    expect(local.data['lmuse.keys.v2']).toBeUndefined();
  });
});

describe('clearAllData', () => {
  it('svuota tutto', async () => {
    await saveStoredKey('k-12345678', true);
    await addHistoryTask('x', true);
    await saveInbox({ text: 'y', steps: 1, at: 1 });
    await saveRunState({ task: 'z', at: 2 });
    await setOnboarded();
    await clearAllData();
    expect(await loadStoredKey(true)).toBe('');
    expect(await loadHistory()).toEqual([]);
    expect(await loadInbox()).toBeNull();
    expect(await loadRunState()).toBeNull();
    expect(await isOnboarded()).toBe(false);
  });
});
