// Test dei tool browser: stub chrome (tabs/sendMessage/scripting) e verifica
// delle osservazioni restituite, incluse le regressioni sui tool nuovi.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserToolConfig } from './tools';

const sendMessage = vi.fn();
const executeScript = vi.fn(async () => []);
const getTab = vi.fn(async () => ({ id: 1, url: 'https://esempio.it/pagina', title: 'Pagina' }));

vi.stubGlobal('chrome', {
  runtime: { id: 'lmuse-test', getManifest: () => ({ version: '0.0.0-test' }) },
  tabs: {
    query: async () => [{ id: 1, url: 'https://esempio.it/pagina', title: 'Pagina' }],
    get: getTab,
    sendMessage,
  },
  scripting: { executeScript },
});

const { createBrowserTools } = await import('./tools');

function baseConfig(over: Partial<BrowserToolConfig> = {}): BrowserToolConfig {
  return {
    maskPii: true,
    hidePasswords: true,
    hostOnly: false,
    sendScreenshots: false,
    allowedDomains: '',
    trustedDomains: [],
    snapshotMaxChars: 12_000,
    stopText: '',
    budgetMax: 50,
    policy: 'off',
    signal: new AbortController().signal,
    requestApproval: async () => true,
    ...over,
  };
}

function kindsOf(calls: unknown[][]): string[] {
  return calls.map((c) => (c[1] as { kind?: string })?.kind ?? '');
}

beforeEach(() => {
  sendMessage.mockReset();
  executeScript.mockClear();
  getTab.mockClear();
});

describe('browser_iframe_snapshot', () => {
  it('restituisce il tree dell iframe senza snapshot della pagina principale', async () => {
    const iframeTree =
      'URL pagina corrente: https://esempio.it/pagina\nElementi interattivi (1):\n[0] button "Dentro"';
    sendMessage.mockResolvedValue({ ok: true, tree: iframeTree });

    const { tools } = createBrowserTools(baseConfig());
    const out = await tools.browser_iframe_snapshot.execute({}, {} as never);
    const observation = (out as { observation: string }).observation;

    expect(observation).toContain('Dentro');
    // La regressione: dopo lo snapshot iframe non deve arrivare un LMUSE_SNAPSHOT
    // della pagina principale, che azzererebbe i ref verso l iframe.
    expect(kindsOf(sendMessage.mock.calls)).toEqual(['LMUSE_IFRAME_SNAPSHOT']);
  });

  it('applica redazione PII al tree restituito', async () => {
    sendMessage.mockResolvedValue({
      ok: true,
      tree: 'Contatto: mario@example.com e +39 333 1234567',
    });
    const { tools } = createBrowserTools(baseConfig());
    const out = await tools.browser_iframe_snapshot.execute({}, {} as never);
    const observation = (out as { observation: string }).observation;
    expect(observation).not.toContain('mario@example.com');
    expect(observation).not.toContain('333 1234567');
  });

  it('rispetta lo stop-text anche nello snapshot iframe', async () => {
    sendMessage.mockResolvedValue({ ok: true, tree: 'Totale: 42 EUR' });
    const { tools } = createBrowserTools(baseConfig({ stopText: 'Totale' }));
    await expect(tools.browser_iframe_snapshot.execute({}, {} as never)).rejects.toThrow(/STOP_TEXT/);
  });

  it('errore cross-origin propagato in chiaro', async () => {
    sendMessage.mockResolvedValue({ ok: false, error: 'Iframe cross-origin (non accessibile dal browser)' });
    const { tools } = createBrowserTools(baseConfig());
    await expect(tools.browser_iframe_snapshot.execute({}, {} as never)).rejects.toThrow(/cross-origin/);
  });

  it('tree vuoto → errore, non snapshot silenzioso', async () => {
    sendMessage.mockResolvedValue({ ok: true, tree: '   ' });
    const { tools } = createBrowserTools(baseConfig());
    await expect(tools.browser_iframe_snapshot.execute({}, {} as never)).rejects.toThrow(
      /Snapshot iframe fallito/,
    );
  });
});

describe('browser_download', () => {
  it('tool presente nel set e con descrizione', () => {
    const { tools } = createBrowserTools(baseConfig());
    expect(Object.keys(tools)).toContain('browser_download');
    expect(tools.browser_download.description).toMatch(/download/i);
  });

  it('propaga il messaggio di avvio download', async () => {
    sendMessage.mockResolvedValue({
      ok: true,
      text: 'Download avviato: controlla il download shelf del browser.',
    });
    const { tools } = createBrowserTools(baseConfig());
    const out = await tools.browser_download.execute({ ref: 0 }, {} as never);
    expect((out as { observation: string }).observation).toContain('download shelf');
  });

  it('richiede approval quando la policy è sensitive', async () => {
    const requestApproval = vi.fn(async () => true);
    sendMessage.mockResolvedValue({ ok: true, text: 'ok' });
    const { tools } = createBrowserTools(baseConfig({ policy: 'sensitive', requestApproval }));
    await tools.browser_download.execute({ ref: 0 }, {} as never);
    expect(requestApproval).toHaveBeenCalled();
  });
});
