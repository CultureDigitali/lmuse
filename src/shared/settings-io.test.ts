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
  loadModelsCache,
  addToQueue,
  loadQueue,
  popQueue,
  clearQueue,
  saveApiKey,
  saveModelsCache,
  buildModelsCache,
  loadKeySavedAt,
  keyAgeDays,
  keyRotationDue,
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

describe('cache modelli (v1)', () => {
  it('save/load roundtrip per provider', async () => {
    await saveModelsCache('ollama', ['qwen3:8b', 'llama3:8b', 'qwen3:8b']);
    expect(await loadModelsCache('ollama')).toEqual(['qwen3:8b', 'llama3:8b']);
    expect(await loadModelsCache('nvidia')).toEqual([]);
  });
  it('dedup + cap 500 + id troncati', async () => {
    const many = Array.from({ length: 600 }, (_, i) => `m${i}`);
    await saveModelsCache('openai', many);
    const list = await loadModelsCache('openai');
    expect(list).toHaveLength(500);
    await saveModelsCache('openai', ['x'.repeat(500)]);
    expect((await loadModelsCache('openai'))[0].length).toBe(200);
  });
  it('fetch vuota mantiene la cache precedente', async () => {
    await saveModelsCache('opencode', ['a', 'b']);
    await saveModelsCache('opencode', []);
    expect(await loadModelsCache('opencode')).toEqual(['a', 'b']);
  });
  it('mappa corrotta → vuota', async () => {
    local.data['lmuse.models.v1'] = 'spazzatura';
    expect(await loadModelsCache('openai')).toEqual([]);
  });
  it('buildModelsCache pura', () => {
    expect(buildModelsCache([], ['b', 'b', 'a'])).toEqual(['b', 'a']);
    expect(buildModelsCache(['vecchia'], [])).toEqual(['vecchia']);
  });
});

describe('coda task (session)', () => {
  it('addToQueue/popQueue FIFO, cap 5', async () => {
    expect(await loadQueue()).toEqual([]);
    for (let i = 1; i <= 7; i++) await addToQueue(`task ${i}`);
    expect(await loadQueue()).toHaveLength(5);
    const first = await popQueue();
    expect(first?.task).toBe('task 1');
    expect(await loadQueue()).toHaveLength(4);
  });
  it('clearQueue svuota', async () => {
    await addToQueue('x');
    await clearQueue();
    expect(await loadQueue()).toEqual([]);
  });
  it('task malformati filtrati in load', async () => {
    await addToQueue('valido');
    const q = await loadQueue();
    expect(q).toHaveLength(1);
  });
  it('clearAllData cancella anche la coda', async () => {
    await addToQueue('x');
    await clearAllData();
    expect(await loadQueue()).toEqual([]);
  });
});

describe('età chiave (rotazione)', () => {
  it('saveApiKey registra il timestamp', async () => {
    expect(await loadKeySavedAt('openai')).toBe(0);
    await saveApiKey('openai', 'k-12345678', true);
    expect(await loadKeySavedAt('openai')).toBeGreaterThan(0);
  });
  it('keyAgeDays: 0 se mai salvata, calcolo giorni', () => {
    expect(keyAgeDays(0)).toBe(0);
    const now = Date.now();
    expect(keyAgeDays(now - 86_400_000 * 100, now)).toBe(100);
    expect(keyAgeDays(now + 10_000, now)).toBe(0); // futuro → 0
  });
  it('keyRotationDue: true solo oltre 90 giorni', () => {
    const now = Date.now();
    expect(keyRotationDue(now - 86_400_000 * 89, now)).toBe(false);
    expect(keyRotationDue(now - 86_400_000 * 91, now)).toBe(true);
  });
  it('l hint non contiene la chiave', async () => {
    await saveApiKey('openai', 'sk-SUPER-SEGRETO-123', true);
    const age = keyAgeDays(await loadKeySavedAt('openai'));
    expect(String(age)).not.toContain('sk-');
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
