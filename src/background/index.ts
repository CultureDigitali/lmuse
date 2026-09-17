import { runTask } from './agent';
import { createModel } from './providers';
import { generateText } from 'ai';
import {
  PanelToSwSchema,
  addHistoryTask,
  clearAllData,
  clearRunState,
  getProvider,
  loadApiKey,
  loadInbox,
  loadSettings,
  loadUsage,
  mergeUsage,
  saveInbox,
  saveRunState,
  saveSettings,
  saveUsage,
  type SwToPanelMessage,
} from '../shared/settings';
import { canStartRun, approvalTimeoutFor, isPlausibleKey } from '../shared/approval';
import { mapProviderError } from '../shared/errors';
import { maskPii } from '../shared/pii';
import { sanitizeTaskText } from '../shared/task';
import { buildLastRuns } from '../shared/settings';
import { BridgePayloadSchema } from '../shared/opencode';

/** Nome del native host registrato da `pnpm setup:opencode`. */
export const OPENCODE_HOST = 'it.lmuse.opencode_bridge';

// Service worker MV3: una sola esecuzione alla volta, eventi live al side
// panel via Port. Sicurezza: verifica sender, validazione zod dei messaggi,
// chiave mai loggata, STOP via comando tastiera, approval umana per le
// azioni sensibili. (S03, S04, S15, S16, S17, S106-S108)

let currentAbort: AbortController | null = null;
let running = false;
let lastRunAt: number | null = null;
let lastTestAt: number | null = null;
const ports = new Set<chrome.runtime.Port>();

interface PendingApproval {
  resolve: (approved: boolean) => void;
  reject: (error: Error) => void;
  timer: number;
}
const pendingApprovals = new Map<string, PendingApproval>();
let approvalSeq = 0;
let approvalTimeoutSec = 120;
let maskCurrent: (value: unknown) => unknown = (v) => v;

function broadcast(message: SwToPanelMessage): void {
  for (const port of ports) {
    try {
      port.postMessage(message);
    } catch {
      ports.delete(port);
    }
  }
}

const APP_VERSION = chrome.runtime.getManifest().version;

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
  void chrome.action.setBadgeText({ text: '' });
  // Titolo toolbar con versione: "lmuse v0.6.0 — Apri" (S215).
  void chrome.action.setTitle({ title: `lmuse v${APP_VERSION}` });
});

chrome.runtime.onStartup.addListener(() => {
  // Restart browser: nessun run vivo, badge stale pulito (R256).
  void chrome.action.setBadgeText({ text: '' });
  void chrome.action.setTitle({ title: `lmuse v${APP_VERSION}` });
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.windowId) {
    await chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => undefined);
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'stop-task') currentAbort?.abort();
});

chrome.runtime.onConnect.addListener((port) => {
  // Solo il nostro side panel può parlare con noi: scarta ogni altra origine. (S03)
  if (port.name !== 'lmuse' || port.sender?.id !== chrome.runtime.id) {
    port.disconnect();
    return;
  }
  ports.add(port);
  void chrome.action.setBadgeText({ text: running ? 'RUN' : '' });
  port.postMessage({ type: 'STATUS', running } satisfies SwToPanelMessage);
  port.onDisconnect.addListener(() => ports.delete(port));

  port.onMessage.addListener((raw: unknown) => {
    const parsed = PanelToSwSchema.safeParse(raw);
    if (!parsed.success) return;
    const message = parsed.data;
    if (message.type === 'RUN') {
      void startRun(message.task);
    } else if (message.type === 'STOP') {
      currentAbort?.abort();
    } else if (message.type === 'APPROVE') {
      settleApproval(message.id, true);
    } else if (message.type === 'DENY') {
      settleApproval(message.id, false);
    }
  });
});

chrome.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
  // Canale dati minimo per il panel quando il service worker dorme: solo interno.
  if (sender.id !== chrome.runtime.id) return false;
  if (raw && typeof raw === 'object' && (raw as { type?: string }).type === 'GET_INBOX') {
    void loadInbox().then((entry) => sendResponse({ entry }));
    return true;
  }
  if (raw && typeof raw === 'object' && (raw as { type?: string }).type === 'CLEAR_ALL') {
    void clearAllData().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (raw && typeof raw === 'object' && (raw as { type?: string }).type === 'TEST_CONNECTION') {
    if (!canStartRun(lastTestAt, Date.now())) {
      sendResponse({ ok: false, error: 'Aspetta qualche secondo prima di riprovare.' });
      return true;
    }
    lastTestAt = Date.now();
    void testConnection().then(
      () => sendResponse({ ok: true }),
      (error: unknown) => sendResponse({ ok: false, error: mapProviderError(error) }),
    );
    return true;
  }
  if (raw && typeof raw === 'object' && (raw as { type?: string }).type === 'SYNC_ALARMS') {
    void syncAlarms().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (raw && typeof raw === 'object' && (raw as { type?: string }).type === 'OPENCODE_BRIDGE') {
    const cmd = (raw as { cmd?: string }).cmd === 'export' ? 'export' : ((raw as { cmd?: string }).cmd ?? 'ping');
    if (cmd !== 'ping' && cmd !== 'list' && cmd !== 'export') {
      sendResponse({ ok: false, error: 'Comando non valido.' });
      return true;
    }
    void sendNative(OPENCODE_HOST, { cmd }).then(
      (payload) => sendResponse({ ok: true, payload }),
      (error: unknown) =>
        sendResponse({ ok: false, error: mapOpencodeError(error) }),
    );
    return true;
  }
  return false;
});

/** Invia un comando al native host opencode; valida la risposta (mai fidarsi). */
async function sendNative(host: string, message: { cmd: string }): Promise<unknown> {
  const raw = await chrome.runtime.sendNativeMessage(host, message);
  const parsed = BridgePayloadSchema.safeParse(raw);
  if (!parsed.success) throw new OpencodeBridgeError('invalid-response');
  if (!parsed.data.ok) throw new OpencodeBridgeError(parsed.data.error);
  return parsed.data;
}

export class OpencodeBridgeError extends Error {
  code: string;
  constructor(code: string) {
    super(`opencode bridge: ${code}`);
    this.code = code;
  }
}

/** Errore bridge → messaggio italiano (mai stack o chiavi). */
function mapOpencodeError(error: unknown): string {
  if (error instanceof OpencodeBridgeError) {
    if (error.code === 'auth-json-missing')
      return 'File auth.json di opencode non trovato: fai prima `opencode auth login`.';
    if (error.code === 'auth-json-invalid' || error.code === 'invalid-auth-json')
      return 'File auth.json di opencode non leggibile: riesegui `opencode auth login`.';
    if (error.code === 'invalid-response')
      return 'Risposta non valida dal bridge opencode. Reinstalla con `pnpm setup:opencode`.';
    return 'Errore del bridge opencode. Riprova o reinstalla con `pnpm setup:opencode`.';
  }
  const msg = String((error as Error)?.message ?? '');
  if (/not found|Specified native messaging host/i.test(msg))
    return "Bridge opencode non installato: esegui `pnpm setup:opencode` poi ricarica l'estensione.";
  if (/Access/i.test(msg))
    return "Il bridge opencode non è autorizzato per questo ID estensione: reinstalla con `pnpm setup:opencode --extension-id=<id>`.";
  return 'Bridge opencode non raggiungibile. Riprova più tardi.';
}

/** Allinea chrome.alarms agli schedule abilitati (chiamato dal panel a ogni modifica). */
async function syncAlarms(): Promise<void> {
  await chrome.alarms.clearAll();
  const settings = await loadSettings();
  for (const s of settings.schedules.filter((x) => x.enabled).slice(0, 5)) {
    await chrome.alarms.create(`lmuse-${s.id}`, { periodInMinutes: s.intervalMin });
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith('lmuse-')) return;
  void (async () => {
    const settings = await loadSettings();
    const schedule = settings.schedules.find((s) => `lmuse-${s.id}` === alarm.name && s.enabled);
    if (!schedule) return;
    await saveSettings({
      ...settings,
      schedules: settings.schedules.map((s) => (s.id === schedule.id ? { ...s, lastFire: Date.now() } : s)),
    });
    if (running) {
      broadcast({
        type: 'STEP',
        index: -1,
        tool: 'schedule',
        input: null,
        result: 'Run già attivo: schedule saltato.',
      });
      return;
    }
    await startRun(schedule.task);
  })();
});

/** Health-check: una chiamata minima al provider (probe "OK", 20s max). */
async function testConnection(): Promise<void> {
  const settings = await loadSettings();
  const apiKey = await loadApiKey(settings.providerId, settings.rememberKey);
  if (getProvider(settings.providerId).needsKey && !isPlausibleKey(apiKey)) {
    throw new Error('Chiave API mancante o non valida: controllala nelle impostazioni ⚙.');
  }
  const model = createModel(settings, apiKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Timeout prova', 'TimeoutError')), 20_000);
  try {
    await generateText({
      model,
      prompt: 'Reply with exactly: OK',
      maxOutputTokens: 5,
      abortSignal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function settleApproval(id: string, approved: boolean): void {
  const pending = pendingApprovals.get(id);
  if (!pending) return;
  pendingApprovals.delete(id);
  clearTimeout(pending.timer);
  pending.resolve(approved);
}

/** STOP sblocca subito anche i tool in attesa di conferma (S124). */
function abortPendingApprovals(): void {
  for (const [id, pending] of pendingApprovals) {
    pendingApprovals.delete(id);
    clearTimeout(pending.timer);
    pending.reject(new DOMException('Task fermato durante la conferma.', 'AbortError'));
  }
}

/**
 * Chiede conferma al panel; timeout 120s → negata. Rifiuta su STOP.
 * La descrizione contiene già tool + motivo in chiaro (S122).
 */
function requestApproval(tool: string, description: string, domain?: string): Promise<boolean> {
  const id = `appr-${Date.now()}-${(approvalSeq += 1)}`;
  // La descrizione può contenere URL: mai token in chiaro al panel (S203).
  const safeDescription = String(maskCurrent(description));
  const unattended = ports.size === 0;
  const timeoutSec = approvalTimeoutFor(unattended ? 'unattended' : 'panel', approvalTimeoutSec);
  if (unattended) {
    broadcast({
      type: 'STEP',
      index: -1,
      tool: 'approvazione',
      input: null,
      result: 'Panel chiuso: conferma rapida (20s), default negata. Mai auto-approve.',
    });
  }
  broadcast({
    type: 'APPROVAL',
    id,
    tool,
    description: safeDescription,
    timeoutSec,
    domain,
  });
  return new Promise<boolean>((resolve, reject) => {
    const timer = self.setTimeout(() => {
      pendingApprovals.delete(id);
      resolve(false);
    }, timeoutSec * 1000);
    pendingApprovals.set(id, { resolve, reject, timer });
  });
}

function maskForPanel(settings: { privacyMaskPii: boolean }, value: unknown): unknown {
  if (!settings.privacyMaskPii) return value;
  if (typeof value === 'string') return maskPii(value);
  if (value != null && typeof value === 'object') {
    try {
      return JSON.parse(maskPii(JSON.stringify(value)));
    } catch {
      return '[dati]';
    }
  }
  return value;
}

async function startRun(task: string): Promise<void> {
  if (running) {
    broadcast({ type: 'ERROR', message: 'Un task è già in esecuzione. Fermalo prima di avviarne un altro.' });
    return;
  }
  if (!canStartRun(lastRunAt, Date.now())) {
    broadcast({ type: 'ERROR', message: 'Aspetta qualche secondo prima di avviare un altro task.' });
    return;
  }
  const trimmed = sanitizeTaskText(task.trim());
  if (!trimmed) {
    broadcast({ type: 'ERROR', message: 'Scrivi un task da svolgere.' });
    return;
  }

  running = true;
  lastRunAt = Date.now();
  currentAbort = new AbortController();
  const signal = currentAbort.signal;
  const startedAt = Date.now();
  broadcast({ type: 'STATUS', running: true });
  void chrome.action.setBadgeText({ text: 'RUN' });
  void chrome.action.setBadgeBackgroundColor({ color: '#7c8cf8' });

  try {
    const settings = await loadSettings();
    const apiKey = await loadApiKey(settings.providerId, settings.rememberKey);
    if (getProvider(settings.providerId).needsKey && !isPlausibleKey(apiKey)) {
      throw new Error('Chiave API mancante o non valida: controllala nelle impostazioni ⚙.');
    }
    await saveRunState({ task: trimmed, at: startedAt });
    const mask = (value: unknown): unknown => maskForPanel(settings, value);
    maskCurrent = mask;
    approvalTimeoutSec = settings.approvalTimeoutSec;
    const maxSteps = settings.maxSteps;
    const { text, steps, inputTokens, outputTokens } = await runTask(
      settings,
      apiKey,
      trimmed,
      {
        onStep: (index) => {
          broadcast({ type: 'STEP', index, tool: 'step', input: null });
          void chrome.action.setBadgeText({ text: `${Math.min(index, maxSteps)}` });
        },
        onToolStart: (toolName, input) =>
          broadcast({ type: 'STEP', index: -1, tool: toolName, input: mask(input) }),
        onToolEnd: (toolName, summary) =>
          broadcast({
            type: 'STEP',
            index: -1,
            tool: `${toolName} ✓`,
            input: null,
            result: String(mask(summary)),
          }),
        onApprovalDecision: (toolName, approved, reason) =>
          broadcast({
            type: 'STEP',
            index: -1,
            tool: approved ? 'approvazione ✓' : 'approvazione ✕',
            input: null,
            result: String(
              mask(`${toolName}: ${approved ? 'approvato' : 'negato'}${reason ? ` — ${reason}` : ''}`),
            ),
          }),
        onStream: (delta) => broadcast({ type: 'STREAM', text: delta }),
      },
      signal,
      requestApproval,
    );
    const elapsedMs = Date.now() - startedAt;
    const tokens = inputTokens + outputTokens;
    try {
      await saveInbox({ text, steps, at: Date.now() });
      await saveUsage(mergeUsage(await loadUsage(), { inputTokens, outputTokens }));
      await saveSettings({
        ...settings,
        lastRuns: buildLastRuns(settings.lastRuns, { task: trimmed, at: startedAt, steps, tokens }),
      });
    } catch (error) {
      throw new Error('Spazio di archiviazione esaurito: impossibile salvare il risultato.', {
        cause: error,
      });
    }
    await addHistoryTask(trimmed, settings.keepHistory);
    broadcast({ type: 'DONE', text, steps, inputTokens, outputTokens, elapsedMs });
    if (ports.size === 0) void chrome.action.setBadgeText({ text: '✓' });
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    if (raw.startsWith('STOP_TEXT:')) {
      const doneText = `✅ ${raw.slice('STOP_TEXT:'.length).trim()} Task interrotto su tua condizione.`;
      try {
        await saveInbox({ text: doneText, at: Date.now(), steps: -1 });
      } catch {
        /* inbox best-effort */
      }
      broadcast({ type: 'DONE', text: doneText, steps: -1, inputTokens: 0, outputTokens: 0, elapsedMs: 0 });
      return;
    }
    const settings = await loadSettings().catch(() => null);
    const message = mapProviderError(error);
    broadcast({
      type: 'ERROR',
      message: settings ? String(maskForPanel(settings, message)) : message,
    });
    if (ports.size === 0) void chrome.action.setBadgeText({ text: '✓' });
  } finally {
    abortPendingApprovals();
    await clearRunState().catch(() => undefined);
    running = false;
    currentAbort = null;
    void chrome.action.setBadgeText({ text: '' });
    broadcast({ type: 'STATUS', running: false });
  }
}

export {};
