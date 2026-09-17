// Test del canale OPENCODE_BRIDGE nel worker: sendNativeMessage mockato.
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (raw: unknown, sender: { id: string }, respond: (v: unknown) => void) => boolean;

const listeners: { onMessage: Listener[] } = { onMessage: [] };

const local = {
  data: {} as Record<string, unknown>,
  get: async (k: string) => ({ [k]: local.data[k] }),
  set: async (o: Record<string, unknown>) => Object.assign(local.data, o),
  remove: async (k: string | string[]) => {
    for (const key of Array.isArray(k) ? k : [k]) delete local.data[key];
  },
};

const sendNativeMessage = vi.fn();

vi.stubGlobal('chrome', {
  runtime: {
    id: 'lmuse-test',
    getManifest: () => ({ version: '0.0.0-test' }),
    onMessage: { addListener: (fn: Listener) => listeners.onMessage.push(fn) },
    onConnect: { addListener: () => undefined },
    onInstalled: { addListener: () => undefined },
    onStartup: { addListener: () => undefined },
    onConnectExternal: { addListener: () => undefined },
    sendNativeMessage,
  },
  storage: { local, session: local },
  action: { setBadgeText: () => undefined, setBadgeBackgroundColor: () => undefined, onClicked: { addListener: () => undefined } },
  commands: { onCommand: { addListener: () => undefined } },
  alarms: { onAlarm: { addListener: () => undefined }, clearAll: async () => true, create: async () => undefined },
  tabs: { query: async () => [] },
  sidePanel: { setPanelBehavior: async () => undefined, open: async () => undefined },
});

await import('./index');

function ask(raw: unknown): Promise<unknown> {
  return new Promise((resolve) => {
    for (const fn of listeners.onMessage) {
      const keepAlive = fn(raw, { id: 'lmuse-test' }, resolve);
      if (keepAlive) return;
    }
    resolve(null);
  });
}

describe('OPENCODE_BRIDGE', () => {
  beforeEach(() => {
    sendNativeMessage.mockReset();
  });

  it('ping ok → payload validato e inoltrato', async () => {
    sendNativeMessage.mockResolvedValue({ ok: true, version: 1 });
    const res = (await ask({ type: 'OPENCODE_BRIDGE', cmd: 'ping' })) as { ok: boolean; payload: unknown };
    expect(res.ok).toBe(true);
    expect(sendNativeMessage).toHaveBeenCalledWith('it.lmuse.opencode_bridge', { cmd: 'ping' });
    expect((res.payload as { version: number }).version).toBe(1);
  });

  it('comando ignoto → errore senza chiamare il bridge', async () => {
    const res = (await ask({ type: 'OPENCODE_BRIDGE', cmd: 'delete-everything' })) as { ok: boolean };
    expect(res.ok).toBe(false);
    expect(sendNativeMessage).not.toHaveBeenCalled();
  });

  it('risposta non conforme allo schema → errore italiano', async () => {
    sendNativeMessage.mockResolvedValue({ totalmente: 'inaspettato' });
    const res = (await ask({ type: 'OPENCODE_BRIDGE', cmd: 'list' })) as { ok: boolean; error: string };
    expect(res.ok).toBe(false);
    expect(res.error).toContain('bridge opencode');
  });

  it('bridge non installato → messaggio con istruzione setup', async () => {
    sendNativeMessage.mockRejectedValue(new Error('Specified native messaging host not found.'));
    const res = (await ask({ type: 'OPENCODE_BRIDGE', cmd: 'ping' })) as { ok: boolean; error: string };
    expect(res.ok).toBe(false);
    expect(res.error).toContain('pnpm setup:opencode');
  });

  it('auth.json mancante → messaggio con opencode auth login', async () => {
    sendNativeMessage.mockResolvedValue({ ok: false, error: 'auth-json-missing' });
    const res = (await ask({ type: 'OPENCODE_BRIDGE', cmd: 'list' })) as { ok: boolean; error: string };
    expect(res.ok).toBe(false);
    expect(res.error).toContain('opencode auth login');
  });

  it('sender esterno ignorato', () => {
    for (const fn of listeners.onMessage) {
      if (fn({ type: 'OPENCODE_BRIDGE', cmd: 'ping' }, { id: 'esterno' }, () => undefined)) {
        throw new Error('non doveva gestire');
      }
    }
  });
});
