import { runTask } from './agent';
import {
  PanelToSwSchema,
  addHistoryTask,
  clearAllData,
  loadInbox,
  loadSettings,
  loadStoredKey,
  saveInbox,
  type SwToPanelMessage,
} from '../shared/settings';
import { mapProviderError } from '../shared/errors';
import { maskPii } from '../shared/pii';

// Service worker MV3: una sola esecuzione alla volta, eventi live al side
// panel via Port. Sicurezza: verifica sender, validazione zod dei messaggi,
// chiave mai loggata, STOP via comando tastiera. (S03, S04, S15, S16, S17)

let currentAbort: AbortController | null = null;
let running = false;
const ports = new Set<chrome.runtime.Port>();

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
  const trimmed = task.trim();
  if (!trimmed) {
    broadcast({ type: 'ERROR', message: 'Scrivi un task da svolgere.' });
    return;
  }

  running = true;
  currentAbort = new AbortController();
  const signal = currentAbort.signal;
  broadcast({ type: 'STATUS', running: true });
  void chrome.action.setBadgeText({ text: 'RUN' });
  void chrome.action.setBadgeBackgroundColor({ color: '#7c8cf8' });

  try {
    const settings = await loadSettings();
    const apiKey = await loadStoredKey(settings.rememberKey);
    const mask = (value: unknown): unknown => maskForPanel(settings, value);
    const { text, steps } = await runTask(
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
      },
      signal,
    );
    await saveInbox({ text, steps, at: Date.now() });
    await addHistoryTask(trimmed);
    broadcast({ type: 'DONE', text, steps });
  } catch (error) {
    broadcast({ type: 'ERROR', message: mapProviderError(error) });
  } finally {
    running = false;
    currentAbort = null;
    void chrome.action.setBadgeText({ text: '' });
    broadcast({ type: 'STATUS', running: false });
  }
}

export {};
