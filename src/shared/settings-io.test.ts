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
