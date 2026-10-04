// Test dei tool browser: stub chrome (tabs/sendMessage/scripting) e verifica
// delle osservazioni restituite, incluse le regressioni sui tool nuovi.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserToolConfig } from './tools';

const sendMessage = vi.fn();
// URL del tab attivo, variabile per testare l'allowlist.
let activeTabUrl = 'https://esempio.it/pagina';
const setActiveTabUrl = (u: string) => {
  activeTabUrl = u;
};
const executeScript = vi.fn(async () => []);
const getTab = vi.fn(async () => ({
  id: 1,
  url: activeTabUrl,
  title: 'Pagina',
  status: 'complete',
  windowId: 1,
}));

vi.stubGlobal('chrome', {
  runtime: { id: 'lmuse-test', getManifest: () => ({ version: '0.0.0-test' }) },
  tabs: {
    // vi.fn perché i test di regressione devono poter cambiare scheda/URL.
    query: vi.fn(async (q?: { url?: string }) =>
      q?.url
        ? [{ id: 1, url: q.url, title: 'Pagina', status: 'complete', windowId: 1 }]
        : [
            {
              id: 1,
              url: activeTabUrl,
              title: 'Pagina',
              status: 'complete',
              windowId: 1,
            },
          ],
    ),
    get: getTab,
    sendMessage,
    update: vi.fn(async () => {}),
    captureVisibleTab: vi.fn(async () => 'data:image/png;base64,AAAA'),
  },
  windows: { getLastFocused: vi.fn(async () => ({ id: 1 })) },
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
  activeTabUrl = 'https://esempio.it/pagina';
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

// Esegue un tool senza propagare l'errore: l'AI SDK restituisce un union che
// non è sempre un Promise, quindi non si può chiamare .catch direttamente.
async function runTool(outcome: unknown): Promise<void> {
  try {
    await outcome;
  } catch {
    /* errore atteso: la navigazione non arriva davvero a fine */
  }
}

describe('browser_navigate — conferma di dominio (regressione)', () => {
  // Un URL senza schema faceva saltare la conferma "dominio nuovo": shouldApprove
  // ricalcolava il dominio da new URL(), che su una stringa senza schema fallisce.
  // Con il fix si passa l'URL normalizzato.
  it.each([
    ['evil.example.com', true],
    ['//evil.example.com', true],
    ['evil.example.com:8443/x', true],
    ['https://evil.example.com/', true],
  ])('%s chiede conferma', async (url, atteso) => {
    const requestApproval = vi.fn(async () => true);
    sendMessage.mockResolvedValue({ ok: true, tree: 'x' });
    const { tools } = createBrowserTools(baseConfig({ policy: 'sensitive', requestApproval }));
    await runTool(tools.browser_navigate.execute({ url }, {} as never));
    expect(requestApproval.mock.calls.length > 0).toBe(atteso);
  });

  it('dominio già visitato: nessuna conferma', async () => {
    const requestApproval = vi.fn(async () => true);
    sendMessage.mockResolvedValue({ ok: true, tree: 'x' });
    const { tools } = createBrowserTools(
      baseConfig({ policy: 'sensitive', requestApproval, trustedDomains: ['evil.example.com'] }),
    );
    await runTool(tools.browser_navigate.execute({ url: 'https://evil.example.com/' }, {} as never));
    expect(requestApproval).not.toHaveBeenCalled();
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

describe('confine allowlist su tutti i percorsi (regressione)', () => {
  // Prima il controllo esisteva solo in browser_navigate: click, digitazione e
  // le altre azioni operavano su qualunque pagina, quindi l'allowlist scritta
  // dall'utente non era un confine.
  const TAB_FUORI = 'https://intranet-banca.example.org/approvazioni';

  it('click su tab fuori allowlist → bloccato', async () => {
    sendMessage.mockResolvedValue({ ok: true });
    setActiveTabUrl(TAB_FUORI);
    const { tools } = createBrowserTools(baseConfig({ allowedDomains: 'esempio.it' }));
    await expect(
      tools.browser_click.execute({ ref: 1 }, {} as never) as unknown as Promise<unknown>,
    ).rejects.toThrow(/allowlist/);
  });

  it('click su tab in allowlist → consentito', async () => {
    sendMessage.mockResolvedValue({ ok: true });
    const { tools } = createBrowserTools(baseConfig({ allowedDomains: 'esempio.it' }));
    const out = await tools.browser_click.execute({ ref: 1 }, {} as never);
    expect((out as { observation: string }).observation).toContain('Click');
  });

  it('allowlist vuota → nessun vincolo (default invariato)', async () => {
    sendMessage.mockResolvedValue({ ok: true });
    const { tools } = createBrowserTools(baseConfig({ allowedDomains: '' }));
    await expect(
      tools.browser_click.execute({ ref: 1 }, {} as never) as unknown as Promise<unknown>,
    ).resolves.toBeDefined();
  });
});

describe('browser_wait: il timeout del worker segue quello richiesto (regressione)', () => {
  // Il worker aveva un timeout fisso di 10s mentre lo schema ammette 30s: metà
  // dei valori ammessi fallivano sempre, e l'errore finiva accusato al provider.
  // Il timeout passato dal tool deve essere quello dichiarato + margine.
  it('passa al content script un timeout coerente con la richiesta', async () => {
    sendMessage.mockResolvedValue({ ok: true, waitedMs: 12_000 });
    const { tools } = createBrowserTools(baseConfig());
    await tools.browser_wait.execute({ waitKind: 'text', value: 'x', timeoutMs: 25_000 }, {} as never);
    const wait = sendMessage.mock.calls
      .map((c) => c[1] as { kind: string; timeoutMs?: number })
      .find((m) => m.kind === 'LMUSE_WAIT');
    expect(wait).toBeDefined();
    expect(wait?.timeoutMs).toBe(25_000);
  });

  it('clampa a 30s e non accetta valori assurdi', async () => {
    sendMessage.mockResolvedValue({ ok: true, waitedMs: 30_000 });
    const { tools } = createBrowserTools(baseConfig());
    await tools.browser_wait.execute({ waitKind: 'text', value: 'x', timeoutMs: 99_999 }, {} as never);
    const wait = sendMessage.mock.calls
      .map((c) => c[1] as { kind: string; timeoutMs?: number })
      .find((m) => m.kind === 'LMUSE_WAIT');
    expect(wait?.timeoutMs).toBe(30_000);
  });
});

describe('stopText non viene rimappato come errore provider (regressione)', () => {
  // checkStop lancia "STOP_TEXT:..." dentro guarded(), che lo passava a
  // mapProviderError: con una stop-text come "403" o "timeout" il prefisso
  // veniva perso e il worker leggeva "Chiave API non valida".
  it('propaga il prefisso STOP_TEXT intatto', async () => {
    sendMessage.mockResolvedValue({ ok: true, tree: 'Totale 403 EUR' });
    const { tools } = createBrowserTools(baseConfig({ stopText: '403' }));
    await expect(
      tools.browser_snapshot.execute({}, {} as never) as unknown as Promise<unknown>,
    ).rejects.toThrow(/STOP_TEXT/);
  });
});

describe('allowlist riapplicata dopo la navigazione (regressione)', () => {
  // Difetto: l'allowlist veniva controllata solo PRIMA di back/forward. Dopo la
  // navigazione l'URL poteva cambiare e lo snapshot successivo leggeva la nuova
  // pagina senza più ricontrollare: contenuto fuori dai domini consentiti.
  const tabs = (chrome.tabs as unknown as { query: ReturnType<typeof vi.fn> }).query;

  beforeEach(() => {
    sendMessage.mockResolvedValue({ ok: true, tree: 'Albero' });
    setActiveTabUrl('https://esempio.it/area');
    tabs.mockImplementation(async (q?: { url?: string }) => [
      {
        id: 1,
        url: activeTabUrl,
        title: 'Pagina',
        status: 'complete',
        windowId: 1,
        ...(q?.url ? {} : {}),
      },
    ]);
  });

  it('back verso una pagina fuori allowlist → il contenuto non viene letto', async () => {
    const goBack = vi.fn(async () => {
      // La navigazione porta fuori dai domini consentiti.
      setActiveTabUrl('https://intranet-banca.example.org/approvazioni');
      return null;
    });
    (chrome.tabs as unknown as { goBack: unknown }).goBack = goBack;
    const { tools } = createBrowserTools(baseConfig({ allowedDomains: 'esempio.it' }));
    await expect(tools.browser_back.execute({}, {} as never) as unknown as Promise<unknown>).rejects.toThrow(
      /allowlist/,
    );
  });

  it('forward verso una pagina fuori allowlist → il contenuto non viene letto', async () => {
    const goForward = vi.fn(async () => {
      setActiveTabUrl('https://intranet-banca.example.org/approvazioni');
      return null;
    });
    (chrome.tabs as unknown as { goForward: unknown }).goForward = goForward;
    const { tools } = createBrowserTools(baseConfig({ allowedDomains: 'esempio.it' }));
    await expect(
      tools.browser_forward.execute({}, {} as never) as unknown as Promise<unknown>,
    ).rejects.toThrow(/allowlist/);
  });

  it('back dentro l’allowlist → consentito', async () => {
    const goBack = vi.fn(async () => {
      setActiveTabUrl('https://esempio.it/altra');
      return null;
    });
    (chrome.tabs as unknown as { goBack: unknown }).goBack = goBack;
    const { tools } = createBrowserTools(baseConfig({ allowedDomains: 'esempio.it' }));
    const out = await tools.browser_back.execute({}, {} as never);
    expect((out as { observation: string }).observation).toContain('Tornato indietro');
  });
});

describe('TOCTOU: cambio di scheda durante la conferma (regressione)', () => {
  // Difetto: tra la richiesta di conferma e l'esecuzione l'utente poteva
  // cambiare scheda, e l'azione finiva sulla pagina nuova, non su quella
  // approvata. Ora la scheda è vincolata all'approvazione.
  const tabs = (chrome.tabs as unknown as { query: ReturnType<typeof vi.fn> }).query;
  let activeId = 1;

  beforeEach(() => {
    activeId = 1;
    sendMessage.mockResolvedValue({ ok: true, tree: 'Albero' });
    setActiveTabUrl('https://esempio.it/pagina');
    tabs.mockImplementation(async () => [
      { id: activeId, url: activeTabUrl, title: 'Pagina', status: 'complete', windowId: 1 },
    ]);
    (chrome.tabs as unknown as { get: unknown }).get = vi.fn(async () => ({
      id: activeId,
      url: activeTabUrl,
      title: 'Pagina',
      status: 'complete',
      windowId: 1,
    }));
  });

  it('cambio scheda durante la conferma → azione bloccata', async () => {
    // L'utente approva, poi cambia scheda prima che l'azione parta.
    const requestApproval = vi.fn(async () => {
      activeId = 7;
      setActiveTabUrl('https://altro.example.net/riservato');
      return true;
    });
    const { tools } = createBrowserTools(baseConfig({ policy: 'all', requestApproval, allowedDomains: '' }));
    await expect(
      tools.browser_click.execute({ ref: 1 }, {} as never) as unknown as Promise<unknown>,
    ).rejects.toThrow(/cambiato scheda|cambiato scheda|scheda/);
  });

  it('nessun cambio scheda → azione eseguita normalmente', async () => {
    const requestApproval = vi.fn(async () => true);
    const { tools } = createBrowserTools(baseConfig({ policy: 'all', requestApproval, allowedDomains: '' }));
    const out = await tools.browser_click.execute({ ref: 1 }, {} as never);
    expect((out as { observation: string }).observation).toContain('Click');
  });
});

describe('hostOnly vale su ogni percorso che mostra un URL (regressione)', () => {
  // Difetto: "solo dominio" (privacyHostOnly) era applicato solo all'header
  // dello snapshot. Un href completo in browser_links o l'URL di un tab in
  // tabs_list portavano al modello la query string, cioè identificatori di
  // sessione, rendendo l'impostazione privata solo parziale.
  const SEGRETO = 'https://esempio.it/pagina?sessione=SEGRETO&token=ABC123';

  it('browser_links riduce l’href a origin+path con hostOnly', async () => {
    sendMessage.mockResolvedValue({
      ok: true,
      links: [{ text: 'Vai', href: SEGRETO }],
    });
    setActiveTabUrl('https://esempio.it/');
    const { tools } = createBrowserTools(baseConfig({ hostOnly: true, maskPii: false }));
    const out = await tools.browser_links.execute({}, {} as never);
    const obs = (out as { observation: string }).observation;
    expect(obs).toContain('https://esempio.it/pagina');
    expect(obs).not.toContain('SEGRETO');
    expect(obs).not.toContain('ABC123');
  });

  it('browser_tabs_list riduce l’URL del tab con hostOnly', async () => {
    const tabs = (chrome.tabs as unknown as { query: ReturnType<typeof vi.fn> }).query;
    tabs.mockImplementation(async () => [
      { id: 3, url: SEGRETO, title: 'Riservata', status: 'complete', windowId: 1 },
    ]);
    const { tools } = createBrowserTools(baseConfig({ hostOnly: true, maskPii: false }));
    const out = await tools.browser_tabs_list.execute({}, {} as never);
    const obs = (out as { observation: string }).observation;
    expect(obs).toContain('https://esempio.it/pagina');
    expect(obs).not.toContain('SEGRETO');
  });

  it('senza hostOnly la redazione dei token resta comunque applicata', async () => {
    sendMessage.mockResolvedValue({ ok: true, links: [{ text: 'Vai', href: SEGRETO }] });
    setActiveTabUrl('https://esempio.it/');
    const { tools } = createBrowserTools(baseConfig({ hostOnly: false, maskPii: false }));
    const out = await tools.browser_links.execute({}, {} as never);
    const obs = (out as { observation: string }).observation;
    // I token restano redatti anche senza hostOnly (comportamento preesistente).
    expect(obs).not.toContain('ABC123');
  });
});

describe('il testo copiato negli appunti non finisce nel log (regressione)', () => {
  // Difetto: il contenuto passato a browser_clipboard_write compariva negli
  // argomenti della richiesta di conferma, che il pannello registra come passo
  // del log esportabile. Poteva essere una password o un segreto.
  it('la conferma riporta la lunghezza, non il testo', async () => {
    const SEGRETO = 'password-ultrasegreta-123';
    sendMessage.mockResolvedValue({ ok: true, tree: 'Albero' });
    setActiveTabUrl('https://esempio.it/');
    const requestApproval = vi.fn(async () => true);
    const { tools } = createBrowserTools(baseConfig({ policy: 'all', requestApproval }));
    await tools.browser_clipboard_write.execute({ text: SEGRETO }, {} as never);
    const descritto = requestApproval.mock.calls.map((c) => JSON.stringify(c)).join(' ');
    expect(descritto).not.toContain(SEGRETO);
    expect(descritto).toContain('caratteri');
  });
});
