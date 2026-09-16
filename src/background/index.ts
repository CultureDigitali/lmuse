import { runTask } from './agent';
import {
  PanelToSwSchema,
  addHistoryTask,
  clearAllData,
  clearRunState,
  getProvider,
  loadInbox,
  loadSettings,
  loadStoredKey,
  loadUsage,
  mergeUsage,
  saveInbox,
  saveRunState,
  saveUsage,
  type SwToPanelMessage,
} from '../shared/settings';
import { canStartRun, isPlausibleKey } from '../shared/approval';
import { mapProviderError } from '../shared/errors';
import { maskPii } from '../shared/pii';

// Service worker MV3: una sola esecuzione alla volta, eventi live al side
// panel via Port. Sicurezza: verifica sender, validazione zod dei messaggi,
// chiave mai loggata, STOP via comando tastiera, approval umana per le
// azioni sensibili. (S03, S04, S15, S16, S17, S106-S108)

let currentAbort: AbortController | null = null;
let running = false;
let lastRunAt: number | null = null;
const ports = new Set<chrome.runtime.Port>();

interface PendingApproval {
  resolve: (approved: boolean) => void;
  reject: (error: Error) => void;
  timer: number;
}
const pendingApprovals = new Map<string, PendingApproval>();
let approvalSeq = 0;

const APPROVAL_TIMEOUT_SEC = 120;

function broadcast(message: SwToPanelMessage): void {
  for (const port of ports) {
    try {
      port.postMessage(message);
    } catch {
      ports.delete(port);
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
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
  return false;
});

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
function requestApproval(tool: string, description: string): Promise<boolean> {
  const id = `appr-${Date.now()}-${(approvalSeq += 1)}`;
  broadcast({ type: 'APPROVAL', id, tool, description, timeoutSec: APPROVAL_TIMEOUT_SEC });
  return new Promise<boolean>((resolve, reject) => {
    const timer = self.setTimeout(() => {
      pendingApprovals.delete(id);
      resolve(false);
    }, APPROVAL_TIMEOUT_SEC * 1000);
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
  const trimmed = task.trim();
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
    const apiKey = await loadStoredKey(settings.rememberKey);
    if (getProvider(settings.providerId).needsKey && !isPlausibleKey(apiKey)) {
      throw new Error('Chiave API mancante o non valida: controllala nelle impostazioni ⚙.');
    }
    await saveRunState({ task: trimmed, at: startedAt });
    const mask = (value: unknown): unknown => maskForPanel(settings, value);
    const { text, steps, inputTokens, outputTokens } = await runTask(
      settings,
      apiKey,
      trimmed,
      {
        onStep: (index) => broadcast({ type: 'STEP', index, tool: 'step', input: null }),
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
      },
      signal,
      requestApproval,
    );
    const elapsedMs = Date.now() - startedAt;
    try {
      await saveInbox({ text, steps, at: Date.now() });
      await saveUsage(mergeUsage(await loadUsage(), { inputTokens, outputTokens }));
    } catch (error) {
      throw new Error('Spazio di archiviazione esaurito: impossibile salvare il risultato.', {
        cause: error,
      });
    }
    await addHistoryTask(trimmed, settings.keepHistory);
    broadcast({ type: 'DONE', text, steps, inputTokens, outputTokens, elapsedMs });
  } catch (error) {
    broadcast({ type: 'ERROR', message: mapProviderError(error) });
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
