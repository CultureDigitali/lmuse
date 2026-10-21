import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertTabSettledForRead, withStableTabRead } from './tabReadGuard';

type Updated = (id: number, change: { status?: string; url?: string }) => void;
type Removed = (id: number) => void;
const updated = new Set<Updated>();
const removed = new Set<Removed>();

vi.stubGlobal('chrome', {
  tabs: {
    onUpdated: {
      addListener: (listener: Updated) => updated.add(listener),
      removeListener: (listener: Updated) => updated.delete(listener),
    },
    onRemoved: {
      addListener: (listener: Removed) => removed.add(listener),
      removeListener: (listener: Removed) => removed.delete(listener),
    },
  },
});

beforeEach(() => {
  updated.clear();
  removed.clear();
});

describe('LM-009: tab navigation guard', () => {
  it('rifiuta una scheda ancora in loading', () => {
    expect(() =>
      assertTabSettledForRead({ status: 'loading', url: 'https://esempio.it/' } as chrome.tabs.Tab),
    ).toThrow(/navigazione/);
  });

  it('rifiuta pendingUrl anche se url attuale risulta autorizzato', () => {
    expect(() =>
      assertTabSettledForRead({
        status: 'complete',
        url: 'https://esempio.it/',
        pendingUrl: 'https://esterno.test/',
      } as chrome.tabs.Tab),
    ).toThrow(/navigazione/);
  });

  it('ignora modifiche di altri tab e scarta il cambio stato loading sul tab osservato', async () => {
    await expect(
      withStableTabRead(17, async () => {
        for (const cb of updated) cb(18, { status: 'loading' });
        return 'synthetic safe';
      }),
    ).resolves.toBe('synthetic safe');

    await expect(
      withStableTabRead(17, async () => {
        for (const cb of updated) cb(17, { status: 'loading' });
        return 'synthetic private';
      }),
    ).rejects.toThrow(/risultato scartato/);

    expect(updated.size).toBe(0);
    expect(removed.size).toBe(0);
  });

  it('scarta reload allo stesso URL ed eliminazione tab in lettura', async () => {
    await expect(
      withStableTabRead(17, async () => {
        for (const cb of updated) cb(17, { url: 'https://esempio.it/' });
        return 'old page';
      }),
    ).rejects.toThrow(/risultato scartato/);
    await expect(
      withStableTabRead(17, async () => {
        for (const cb of removed) cb(17);
        return 'old page';
      }),
    ).rejects.toThrow(/risultato scartato/);
    expect(updated.size).toBe(0);
    expect(removed.size).toBe(0);
  });

  it('rimuove listener anche quando il content script lancia un errore', async () => {
    await expect(
      withStableTabRead(17, async () => {
        throw new Error('content script unavailable');
      }),
    ).rejects.toThrow(/content script unavailable/);
    expect(updated.size).toBe(0);
    expect(removed.size).toBe(0);
  });
});
