import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  MAX_TASK_CHARS,
  PRESETS,
  PROVIDERS,
  addHistoryTask,
  buildPromptList,
  clearHistory,
  clearInbox,
  clearRunState,
  getProvider,
  isOnboarded,
  loadApiKey,
  loadHistory,
  loadInbox,
  loadRunState,
  loadSettings,
  loadUsage,
  removeHistoryTask,
  sanitizeDomainList,
  saveApiKey,
  saveSettings,
  setOnboarded,
  type ApprovalPolicy,
  type InboxEntry,
  type ProviderId,
  type RunState,
  type Settings,
  type SwToPanelMessage,
  type UsageStats,
} from '../shared/settings';
import { exportProfile, validateProfile } from '../shared/profile';
import { formatNextRun, validateSchedule } from '../shared/schedules';
import { formatElapsed } from '../shared/approval';
import { t, type Lang } from '../shared/i18n';
import { mapBridgeCredentials, matchBridgeProviders } from '../shared/opencode';

interface LogEntry {
  id: number;
  kind: 'user' | 'tool' | 'result' | 'error' | 'info';
  text: string;
  at: number;
}

type LogFilter = 'all' | 'tools' | 'errors';

interface PendingApproval {
  id: string;
  tool: string;
  description: string;
  expiresAt: number;
  domain?: string;
}

let logId = 0;
const nextId = () => ++logId;

/** Versione letta dal manifest (una sola fonte di verità). */
const APP_VERSION = chrome.runtime.getManifest().version;

const SUGGESTIONS = [
  'Riassumi questa pagina in 5 punti.',
  'Trova il link “Contatti” e dimmi dove porta.',
  'Compila il campo di ricerca con “orari apertura” e premi Invio.',
];

function detectLang(): Lang {
  try {
    const ui = chrome.i18n.getUILanguage?.() ?? 'it';
    return ui.toLowerCase().startsWith('en') ? 'en' : 'it';
  } catch {
    return 'it';
  }
}

export default function App() {
  const [lang, setLang] = useState<Lang>(detectLang());
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [task, setTask] = useState('');
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [inbox, setInbox] = useState<InboxEntry | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState('');
  const [lastTask, setLastTask] = useState('');
  const [showRetry, setShowRetry] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [approval, setApproval] = useState<PendingApproval | null>(null);
  const [approvalLeft, setApprovalLeft] = useState(0);
  const [orphan, setOrphan] = useState<RunState | null>(null);
  const [usage, setUsage] = useState<UsageStats>({ runs: 0, inputTokens: 0, outputTokens: 0 });
  const [onboarded, setOnboardedState] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [logFilter, setLogFilter] = useState<LogFilter>('all');
  const [activeHost, setActiveHost] = useState('');
  const [testing, setTesting] = useState(false);
  const [rememberDomain, setRememberDomain] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [scheduleInterval, setScheduleInterval] = useState(1440);
  const audioRef = useRef<AudioContext | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const portRef = useRef<chrome.runtime.Port | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const taskRef = useRef<HTMLTextAreaElement>(null);
  const approvalRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const retryRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const apiKeyRef = useRef('');
  const startedAtRef = useRef(0);
  const settingsRef = useRef(settings);
  const langRef = useRef(lang);
  apiKeyRef.current = apiKey;
  settingsRef.current = settings;
  langRef.current = lang;

  const append = useCallback((entry: Omit<LogEntry, 'id' | 'at'>) => {
    setLog((prev) => [...prev.slice(-200), { ...entry, id: nextId(), at: Date.now() }]);
  }, []);

  // --- Port con riconnessione automatica e backoff (R51) ---
  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;

    const handleMessage = (message: SwToPanelMessage) => {
      if (message.type === 'STATUS') {
        setRunning(message.running);
        if (message.running) {
          setOrphan(null);
        } else {
          setApproval(null);
          setElapsedMs(0);
        }
      } else if (message.type === 'STEP') {
        if (message.tool === 'step') {
          setSteps(message.index);
          const max = settingsRef.current.maxSteps;
          const l = langRef.current;
          append({ kind: 'info', text: `— ${t(l, 'step_of', { n: message.index, max })} —` });
        } else if (message.tool.endsWith('✓')) {
          append({
            kind: 'tool',
            text: `✓ ${message.tool.replace(' ✓', '')}: ${(message.result ?? '').slice(0, 200)}`,
          });
        } else {
          append({ kind: 'tool', text: `→ ${message.tool} ${formatInput(message.input)}` });
        }
      } else if (message.type === 'DONE') {
        const tokens = message.inputTokens + message.outputTokens;
        const l = langRef.current;
        const usageLine = t(l, 'usage_line', {
          steps: message.steps,
          tokens,
          elapsed: formatElapsed(message.elapsedMs),
        });
        append({ kind: 'result', text: `${message.text}\n\n_${usageLine}_` });
        setLastResult(message.text);
        setShowRetry(false);
        setApproval(null);
        setStreamText('');
        setElapsedMs(0);
        setRunning(false);
        setSteps(0);
        playDone();
        taskRef.current?.focus();
        void refreshHistory();
        void loadInbox().then(setInbox);
        void loadUsage().then(setUsage);
      } else if (message.type === 'ERROR') {
        append({ kind: 'error', text: message.message });
        setErrorBanner(message.message);
        setShowRetry(true);
        setApproval(null);
        setStreamText('');
        setElapsedMs(0);
        setRunning(false);
        setSteps(0);
        playDone();
        taskRef.current?.focus();
      } else if (message.type === 'STREAM') {
        setStreamText((prev) => (prev + message.text).slice(-4000));
      } else if (message.type === 'APPROVAL') {
        setApproval({
          id: message.id,
          tool: message.tool,
          description: message.description,
          expiresAt: Date.now() + message.timeoutSec * 1000,
          domain: message.domain,
        });
        setRememberDomain(false);
        setApprovalLeft(message.timeoutSec);
      }
    };

    const connect = () => {
      if (disposed) return;
      try {
        const port = chrome.runtime.connect({ name: 'lmuse' });
        portRef.current = port;
        retryRef.current = 0;
        port.onMessage.addListener(handleMessage);
        port.onDisconnect.addListener(() => {
          portRef.current = null;
          if (disposed || intentionalCloseRef.current) return;
          retryRef.current += 1;
          const delay = Math.min(500 * 2 ** (retryRef.current - 1), 4000);
          timer = window.setTimeout(connect, delay);
        });
      } catch {
        if (disposed) return;
        retryRef.current += 1;
        timer = window.setTimeout(connect, Math.min(500 * 2 ** (retryRef.current - 1), 4000));
      }
    };

    connect();
    return () => {
      disposed = true;
      intentionalCloseRef.current = true;
      window.clearTimeout(timer);
      try {
        portRef.current?.disconnect();
      } catch {
        /* già chiusa */
      }
    };
  }, [append]);

  // --- Stato iniziale: settings, chiave, cronologia, inbox, usage, onboarding, run orfano ---
  useEffect(() => {
    void (async () => {
      const s = await loadSettings();
      setSettings(s);
      setLang(s.locale === 'auto' ? detectLang() : s.locale);
      const key = (await loadApiKey(s.providerId, s.rememberKey)) || (await loadApiKey(s.providerId, !s.rememberKey));
      setApiKey(key);
      if (!key && getProvider(s.providerId).needsKey) setShowSettings(true);
      setHistory(await loadHistory());
      setInbox(await loadInbox());
      setUsage(await loadUsage());
      setOnboardedState(await isOnboarded());
      const rs = await loadRunState();
      if (rs) setOrphan(rs);
      void refreshActiveHost();
    })();
    taskRef.current?.focus();
    const onFocus = () => void refreshActiveHost();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  function refreshActiveHost() {
    return chrome.tabs
      .query({ active: true, lastFocusedWindow: true })
      .then((tabs) => {
        const url = tabs[0]?.url ?? '';
        try {
          setActiveHost(url ? new URL(url).hostname : '');
        } catch {
          setActiveHost('');
        }
      })
      .catch(() => undefined);
  }

  // --- Tema effettivo su <html data-theme> (auto segue il sistema) ---
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const mode = settings.theme;
      const dark =
        mode === 'dark' || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    if (settings.theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
    return undefined;
  }, [settings.theme]);

  // --- Timer tempo trascorso durante il run ---
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  // --- Countdown approval + focus automatico sul banner (U200) ---
  useEffect(() => {
    if (!approval) return;
    approvalRef.current?.focus();
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((approval.expiresAt - Date.now()) / 1000));
      setApprovalLeft(left);
      if (left <= 0) {
        window.clearInterval(timer);
        setApproval(null);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [approval]);

  // --- Ctrl/Cmd+K: focus sul task (R69) ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        taskRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function refreshHistory() {
    return loadHistory().then(setHistory);
  }

  // --- Auto-scroll intelligente: solo se l'utente è già in fondo (R70) ---
  function onLogScroll() {
    const el = logRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  useEffect(() => {
    if (stickRef.current) logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  // --- Auto-resize textarea (U94) ---
  useEffect(() => {
    const el = taskRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [task]);

  function formatInput(input: unknown): string {
    try {
      const json = JSON.stringify(input);
      return json && json !== '{}' ? json.slice(0, 160) : '';
    } catch {
      return '';
    }
  }

  function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    void saveSettings(next);
  }

  function onKeyChange(value: string) {
    setApiKey(value);
    void saveApiKey(settings.providerId, value, settings.rememberKey);
  }

  async function onToggleRemember(remember: boolean) {
    update({ rememberKey: remember });
    // Sposta la chiave esistente nello store corrispondente.
    const current = apiKeyRef.current;
    await saveApiKey(settings.providerId, '', !remember);
    if (current) await saveApiKey(settings.providerId, current, remember);
  }

  async function onClearKey() {
    await saveApiKey(settings.providerId, '', settings.rememberKey);
    await saveApiKey(settings.providerId, '', !settings.rememberKey);
    setApiKey('');
  }

  async function onClearAll() {
    if (!window.confirm(t(lang, 'confirm_clear_all'))) return;
    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_ALL' });
    } catch {
      /* SW dormiente: puliamo comunque lato panel */
    }
    await clearHistory();
    await clearInbox();
    await clearRunState();
    setSettings(DEFAULT_SETTINGS);
    await saveSettings(DEFAULT_SETTINGS);
    setApiKey('');
    setHistory([]);
    setInbox(null);
    setUsage({ runs: 0, inputTokens: 0, outputTokens: 0 });
    setOrphan(null);
    setLog([]);
    setShowSettings(true);
  }

  function onExportSettings() {
    const { ...noKey } = settings;
    void navigator.clipboard.writeText(JSON.stringify(noKey, null, 2)).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  function changeProvider(id: ProviderId) {
    const def = getProvider(id);
    update({
      providerId: id,
      model: def.defaultModel || '',
      baseUrl: def.defaultBaseUrl?.includes('<') ? '' : (def.defaultBaseUrl ?? ''),
    });
    // Chiave per-provider: mostra subito quella salvata per il nuovo provider.
    void loadApiKey(id, settings.rememberKey).then((k) => setApiKey(k));
  }

  // --- Bridge opencode: rileva credenziali configurate e le importa ---
  const [opencodeStatus, setOpencodeStatus] = useState<string>('');
  const [opencodeFound, setOpencodeFound] = useState(false);

  async function bridgeCall(cmd: 'ping' | 'list' | 'export'): Promise<unknown> {
    const res = (await chrome.runtime.sendMessage({ type: 'OPENCODE_BRIDGE', cmd })) as {
      ok: boolean;
      payload?: unknown;
      error?: string;
    };
    if (!res.ok) throw new Error(res.error ?? 'bridge error');
    return res.payload;
  }

  async function detectOpencode() {
    setOpencodeStatus('…');
    try {
      await bridgeCall('ping');
      const payload = (await bridgeCall('list')) as { providers?: { id: string }[] };
      const ids = (payload.providers ?? []).map((p) => p.id);
      const found = matchBridgeProviders(ids);
      setOpencodeStatus(
        found.length > 0 ? t(lang, 'opencode_found', { n: found.length }) : t(lang, 'opencode_not_found'),
      );
      setOpencodeFound(found.length > 0);
    } catch (e) {
      setOpencodeStatus(String((e as Error).message));
      setOpencodeFound(false);
    }
  }

  async function importFromOpencode() {
    setOpencodeStatus('…');
    try {
      const payload = (await bridgeCall('export')) as {
        credentials?: { id: string; key: string }[];
      };
      const mapped = mapBridgeCredentials(payload.credentials ?? []);
      let imported = 0;
      for (const [pid, key] of Object.entries(mapped)) {
        await saveApiKey(pid as ProviderId, key as string, settings.rememberKey);
        imported++;
      }
      if (imported === 0) {
        setOpencodeStatus(t(lang, 'opencode_import_none'));
        return;
      }
      if (mapped[settings.providerId]) setApiKey(mapped[settings.providerId] as string);
      setOpencodeStatus(t(lang, 'opencode_imported', { n: imported }));
    } catch (e) {
      setOpencodeStatus(String((e as Error).message));
    }
  }

  function run() {
    const trimmed = task.trim().slice(0, MAX_TASK_CHARS);
    if (!trimmed || running) return;
    startTask(trimmed);
    setTask('');
  }

  function playDone() {
    if (!settingsRef.current.soundOnDone) return;
    try {
      const Ctx = window.AudioContext;
      if (!Ctx) return;
      audioRef.current ??= new Ctx();
      const ctx = audioRef.current;
      if (ctx.state === 'suspended') void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 660;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      /* audio non disponibile: silenzioso */
    }
  }

  function startTask(trimmed: string) {
    setErrorBanner(null);
    setShowRetry(false);
    setApproval(null);
    setLastTask(trimmed);
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    append({ kind: 'user', text: trimmed });
    portRef.current?.postMessage({ type: 'RUN', task: trimmed });
    void addHistoryTask(trimmed, settingsRef.current.keepHistory).then(refreshHistory);
  }

  function retry() {
    if (running || !lastTask) return;
    startTask(lastTask);
  }

  function stop() {
    setApproval(null);
    portRef.current?.postMessage({ type: 'STOP' });
  }

  function respondApproval(approved: boolean) {
    if (!approval) return;
    if (approved && rememberDomain && approval.domain) {
      const next = sanitizeDomainList([...settingsRef.current.trustedDomains, approval.domain]);
      const capped = next.slice(0, 50);
      update({ trustedDomains: capped });
    }
    portRef.current?.postMessage({ type: approved ? 'APPROVE' : 'DENY', id: approval.id });
    setApproval(null);
  }

  function downloadLog() {
    const text = log.map((e) => `[${e.kind}] ${e.text}`).join('\n\n');
    if (!text) return;
    const blob = new Blob([text], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lmuse-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function testConnection() {
    setTesting(true);
    try {
      const res = (await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' })) as {
        ok: boolean;
        error?: string;
      };
      if (res?.ok) {
        flashNotice(t(langRef.current, 'test_ok'));
      } else {
        setErrorBanner(res?.error ?? 'Errore.');
      }
    } catch {
      setErrorBanner('SW non raggiungibile: ricarica il pannello.');
    } finally {
      setTesting(false);
    }
  }

  function applyPreset(id: string) {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    if (preset.patch.providerId && preset.patch.providerId !== settings.providerId) {
      changeProvider(preset.patch.providerId);
    }
    update(preset.patch);
  }

  function saveTemplate() {
    const trimmed = task.trim();
    if (!trimmed) return;
    update({ savedPrompts: buildPromptList(settings.savedPrompts, trimmed) });
  }

  function syncAlarms() {
    void chrome.runtime.sendMessage({ type: 'SYNC_ALARMS' }).catch(() => undefined);
  }

  function addSchedule() {
    const trimmed = task.trim().slice(0, MAX_TASK_CHARS);
    if (!trimmed) return;
    const check = validateSchedule(trimmed, scheduleInterval, settings.schedules.length);
    if (!check.ok || !check.task) {
      setErrorBanner(check.error ?? 'Schedule non valido.');
      return;
    }
    const entry = {
      id: `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
      task: check.task,
      intervalMin: scheduleInterval,
      enabled: true,
      createdAt: Date.now(),
    };
    update({ schedules: [...settings.schedules, entry].slice(0, 5) });
    setTask('');
    syncAlarms();
  }

  function toggleSchedule(id: string) {
    update({
      schedules: settings.schedules.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    });
    syncAlarms();
  }

  function deleteSchedule(id: string) {
    update({ schedules: settings.schedules.filter((s) => s.id !== id) });
    syncAlarms();
  }

  function downloadProfile() {
    const json = JSON.stringify(exportProfile(settingsRef.current), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lmuse-profile-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function importProfileFile(file: File) {
    try {
      if (file.size > 100_000) throw new Error('File troppo grande (max 100KB).');
      const parsed: unknown = JSON.parse(await file.text());
      const next = validateProfile(parsed);
      setSettings(next);
      await saveSettings(next);
      setLang(next.locale === 'auto' ? detectLang() : next.locale);
      flashNotice(t(langRef.current, 'import_ok'));
    } catch {
      setErrorBanner(t(langRef.current, 'import_error'));
    }
  }

  function copyLog() {
    const text = log.map((e) => `[${e.kind}] ${e.text}`).join('\n\n');
    if (!text) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  function clearLog() {
    setLog([]);
  }

  function flashNotice(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 2500);
  }

  async function dismissOnboarding() {
    await setOnboarded();
    setOnboardedState(true);
  }

  function copyResult() {
    if (!lastResult) return;
    void navigator.clipboard.writeText(lastResult).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  const provider = getProvider(settings.providerId);
  const showBaseUrl = ['azure', 'custom'].includes(settings.providerId) || !!provider.defaultBaseUrl;
  const configured = !provider.needsKey || apiKey.trim().length > 0;

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="logo">lmuse</span>
          <span className="version-tag" title="lmuse versione installata">v{APP_VERSION}</span>
          <span className="model-tag" title={`${provider.name} · ${settings.model || '—'}`}>
            {provider.name} · {settings.model || '—'}
          </span>
          {activeHost && (
            <span className="model-tag" title={`${t(lang, 'active_tab')} ${activeHost}`}>
              🌐 {activeHost}
            </span>
          )}
        </div>
        <div className="header-actions">
          {running && (
            <span className="running-badge" title={t(lang, 'running')}>
              <span className="spinner" aria-hidden="true" />{' '}
              {t(lang, 'step_of', { n: steps, max: settings.maxSteps })}
              {elapsedMs > 0 && ` · ${formatElapsed(elapsedMs)}`}
            </span>
          )}
          <button
            className="ghost"
            onClick={() => setShowSettings((v) => !v)}
            title={t(lang, 'settings')}
            aria-label={t(lang, 'settings')}
            aria-expanded={showSettings}
          >
            ⚙
          </button>
        </div>
      </header>

      {errorBanner && (
        <div className="banner error" role="alert">
          <span>{errorBanner}</span>
          <span className="btn-row">
            {showRetry && lastTask && (
              <button type="button" className="secondary xs" onClick={retry}>
                {t(lang, 'retry')}
              </button>
            )}
            <button className="ghost" onClick={() => setErrorBanner(null)} aria-label="Chiudi avviso">
              ✕
            </button>
          </span>
        </div>
      )}

      {approval && (
        <div
          className="banner approval"
          role="alertdialog"
          aria-label={t(lang, 'approval_title')}
          aria-modal="false"
          tabIndex={-1}
          ref={approvalRef}
        >
          <div>
            <strong>{t(lang, 'approval_title')}</strong>
            <p>
              <code>{approval.tool}</code> — {approval.description}
            </p>
            {approval.domain && (
              <label className="check xs">
                <input
                  type="checkbox"
                  checked={rememberDomain}
                  onChange={(e) => setRememberDomain(e.target.checked)}
                />
                {t(lang, 'trusted_remember')} ({approval.domain})
              </label>
            )}
            <p className="muted">{t(lang, 'approval_timeout', { n: approvalLeft })}</p>
          </div>
          <span className="btn-row">
            <button type="button" className="run xs" onClick={() => respondApproval(true)}>
              {t(lang, 'approve')}
            </button>
            <button type="button" className="stop xs" onClick={() => respondApproval(false)}>
              {t(lang, 'deny')}
            </button>
          </span>
        </div>
      )}

      {orphan && !running && (
        <div className="banner inbox" role="status">
          <div>
            <strong>{t(lang, 'orphan_title')}</strong>
            <p>
              {t(lang, 'last_run')} {orphan.task.slice(0, 140)}
            </p>
          </div>
          <span className="btn-row">
            <button
              type="button"
              className="secondary xs"
              onClick={() => {
                const taskText = orphan.task;
                setOrphan(null);
                void clearRunState().then(() => startTask(taskText));
              }}
            >
              {t(lang, 'orphan_retry')}
            </button>
            <button
              type="button"
              className="ghost xs"
              onClick={() => {
                setOrphan(null);
                void clearRunState();
              }}
              aria-label="Chiudi avviso"
            >
              ✕
            </button>
          </span>
        </div>
      )}

      {!settings.privacyMaskPii && (
        <div className="banner warn-banner" role="status">
          <span>{t(lang, 'privacy_off_warn')}</span>
        </div>
      )}

      {notice && (
        <div className="banner notice" role="status">
          <span>{notice}</span>
        </div>
      )}

      {inbox && !running && (
        <div className="banner inbox">
          <div>
            <strong>{t(lang, 'inbox_title')}</strong>
            <p>{inbox.text.slice(0, 300)}</p>
          </div>
          <button
            className="ghost"
            onClick={() => {
              setLastResult(inbox.text);
              append({ kind: 'result', text: inbox.text });
              void clearInbox().then(() => setInbox(null));
            }}
          >
            {t(lang, 'inbox_dismiss')}
          </button>
        </div>
      )}

      {showSettings && (
        <section className="settings" aria-label={t(lang, 'settings')}>
          <label>
            {t(lang, 'provider')}
            <select
              value={settings.providerId}
              onChange={(e) => changeProvider(e.target.value as ProviderId)}
            >
              {(['cloud', 'gateway', 'local'] as const).map((g) => (
                <optgroup key={g} label={t(lang, `group_${g}`)}>
                  {PROVIDERS.filter((p) => p.group === g).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            {t(lang, 'model')}
            <input
              list="lmuse-models"
              value={settings.model}
              onChange={(e) => update({ model: e.target.value })}
              placeholder={provider.defaultModel || 'nome-modello'}
            />
            <datalist id="lmuse-models">
              {provider.models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          {provider.needsKey && (
            <label>
              {t(lang, 'api_key')}
              <span className="key-row">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => onKeyChange(e.target.value)}
                  placeholder="sk-…"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setShowKey((v) => !v)}
                  title={showKey ? 'Nascondi' : 'Mostra'}
                  aria-label={showKey ? 'Nascondi chiave' : 'Mostra chiave'}
                >
                  {showKey ? '🙈' : '👁'}
                </button>
              </span>
            </label>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={settings.rememberKey}
              onChange={(e) => void onToggleRemember(e.target.checked)}
            />
            {t(lang, 'remember_key')}
          </label>
          <div className="btn-row">
            <button type="button" className="secondary" onClick={() => void onClearKey()}>
              {t(lang, 'clear_key')}
            </button>
            <button type="button" className="secondary danger" onClick={() => void onClearAll()}>
              {t(lang, 'clear_all')}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => void testConnection()}
              disabled={testing}
            >
              {testing ? t(lang, 'testing') : t(lang, 'test_connection')}
            </button>
          </div>
          <div className="btn-row">
            <span className="muted">{t(lang, 'presets_title')}:</span>
            <button type="button" className="secondary xs" onClick={() => applyPreset('fast')}>
              {t(lang, 'preset_fast')}
            </button>
            <button type="button" className="secondary xs" onClick={() => applyPreset('precise')}>
              {t(lang, 'preset_precise')}
            </button>
            <button type="button" className="secondary xs" onClick={() => applyPreset('local')}>
              {t(lang, 'preset_local')}
            </button>
          </div>
          {showBaseUrl && (
            <label>
              {t(lang, 'base_url')}
              <input
                value={settings.baseUrl}
                onChange={(e) => update({ baseUrl: e.target.value })}
                placeholder={provider.defaultBaseUrl ?? 'https://…'}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          )}
          <fieldset className="opencode-card">
            <legend>{t(lang, 'opencode_title')}</legend>
            <p className="muted">{t(lang, 'opencode_desc')}</p>
            <div className="btn-row">
              <button type="button" className="secondary xs" onClick={() => void detectOpencode()}>
                {t(lang, 'opencode_detect')}
              </button>
              <button
                type="button"
                className="secondary xs"
                onClick={() => void importFromOpencode()}
                disabled={!opencodeFound}
              >
                {t(lang, 'opencode_import')}
              </button>
            </div>
            {opencodeStatus && <p className="muted">{opencodeStatus}</p>}
          </fieldset>
          <div className="num-row">
            <label>
              {t(lang, 'max_steps')}
              <input
                type="number"
                min={3}
                max={100}
                value={settings.maxSteps}
                onChange={(e) => update({ maxSteps: Number(e.target.value) || 25 })}
              />
            </label>
            <label>
              {t(lang, 'max_retries')}
              <input
                type="number"
                min={0}
                max={6}
                value={settings.maxRetries}
                onChange={(e) => update({ maxRetries: Number(e.target.value) || 0 })}
              />
            </label>
            <label>
              {t(lang, 'run_timeout')}
              <input
                type="number"
                min={1}
                max={120}
                value={settings.runTimeoutMin}
                onChange={(e) => update({ runTimeoutMin: Number(e.target.value) || 15 })}
              />
            </label>
            <label>
              Timeout conferma (s)
              <input
                type="number"
                min={30}
                max={300}
                value={settings.approvalTimeoutSec}
                onChange={(e) => update({ approvalTimeoutSec: Number(e.target.value) || 120 })}
              />
            </label>
          </div>
          <div className="num-row">
            <label>
              {t(lang, 'theme_label')}
              <select
                value={settings.theme}
                onChange={(e) => update({ theme: e.target.value as Settings['theme'] })}
              >
                <option value="auto">{t(lang, 'theme_auto')}</option>
                <option value="dark">{t(lang, 'theme_dark')}</option>
                <option value="light">{t(lang, 'theme_light')}</option>
              </select>
            </label>
            <label>
              {t(lang, 'lang_label')}
              <select
                value={settings.locale}
                onChange={(e) => {
                  const locale = e.target.value as Settings['locale'];
                  update({ locale });
                  setLang(locale === 'auto' ? detectLang() : locale);
                }}
              >
                <option value="auto">Auto</option>
                <option value="it">Italiano</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>

          <h3>{t(lang, 'privacy_section')}</h3>
          <label>
            {t(lang, 'approval_label')}
            <select
              value={settings.approval}
              onChange={(e) => update({ approval: e.target.value as ApprovalPolicy })}
            >
              <option value="off">{t(lang, 'approval_off')}</option>
              <option value="sensitive">{t(lang, 'approval_sensitive')}</option>
              <option value="all">{t(lang, 'approval_all')}</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.privacyMaskPii}
              onChange={(e) => update({ privacyMaskPii: e.target.checked })}
            />
            {t(lang, 'mask_pii')}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.privacyHidePasswords}
              onChange={(e) => update({ privacyHidePasswords: e.target.checked })}
            />
            {t(lang, 'hide_passwords')}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.sendScreenshots}
              onChange={(e) => update({ sendScreenshots: e.target.checked })}
            />
            {t(lang, 'send_screenshots')}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.privacyHostOnly}
              onChange={(e) => update({ privacyHostOnly: e.target.checked })}
            />
            {t(lang, 'host_only')}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.keepHistory}
              onChange={(e) => update({ keepHistory: e.target.checked })}
            />
            {t(lang, 'keep_history')}
          </label>
          <label>
            {t(lang, 'max_tokens_label')}
            <input
              type="number"
              min={1000}
              max={200000}
              step={1000}
              value={settings.maxTokensPerRun}
              onChange={(e) => update({ maxTokensPerRun: Number(e.target.value) || 60000 })}
            />
          </label>
          <label>
            {t(lang, 'stop_text_label')}
            <input
              value={settings.stopText}
              onChange={(e) => update({ stopText: e.target.value })}
              placeholder={t(lang, 'stop_text_ph')}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.compactLog}
              onChange={(e) => update({ compactLog: e.target.checked })}
            />
            {t(lang, 'compact_label')}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.soundOnDone}
              onChange={(e) => update({ soundOnDone: e.target.checked })}
            />
            {t(lang, 'sound_label')}
          </label>
          <label>
            {t(lang, 'allowed_domains')}
            <input
              value={settings.allowedDomains}
              onChange={(e) => update({ allowedDomains: e.target.value })}
              placeholder={t(lang, 'allowed_domains_ph')}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="history">
            <span className="muted">{t(lang, 'trusted_title')}</span>
            {settings.trustedDomains.length === 0 && <p className="muted">{t(lang, 'trusted_empty')}</p>}
            {settings.trustedDomains.map((d) => (
              <span key={d} className="history-row">
                <span className="history-item">{d}</span>
                <button
                  type="button"
                  className="ghost xs"
                  onClick={() => update({ trustedDomains: settings.trustedDomains.filter((x) => x !== d) })}
                  aria-label={`Rimuovi: ${d}`}
                  title="Rimuovi"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <div className="btn-row">
            <button type="button" className="secondary" onClick={onExportSettings}>
              {copied ? t(lang, 'copied') : t(lang, 'export_settings')}
            </button>
            <button type="button" className="secondary" onClick={downloadProfile}>
              {t(lang, 'export_profile')}
            </button>
            <button type="button" className="secondary" onClick={() => importRef.current?.click()}>
              {t(lang, 'import_profile')}
            </button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void importProfileFile(file);
              }}
            />
          </div>

          <h3>{t(lang, 'schedules_title')}</h3>
          <div className="num-row">
            <label>
              {t(lang, 'schedule_interval')}
              <input
                type="number"
                min={60}
                max={10080}
                value={scheduleInterval}
                onChange={(e) => setScheduleInterval(Number(e.target.value) || 1440)}
              />
            </label>
          </div>
          <div className="btn-row">
            <button type="button" className="secondary xs" onClick={addSchedule} disabled={!task.trim()}>
              {t(lang, 'schedule_add')}
            </button>
          </div>
          <div className="history">
            {settings.schedules.length === 0 && <p className="muted">{t(lang, 'schedule_ph')}</p>}
            {settings.schedules.map((s) => (
              <span key={s.id} className="history-row">
                <button
                  type="button"
                  className="history-item"
                  onClick={() => setTask(s.task)}
                  title={`${s.task}\n${t(lang, 'next_run')} ${formatNextRun(s.lastFire ?? null, s.intervalMin, Date.now())}`}
                >
                  {s.enabled ? '● ' : '○ '}
                  {s.task.length > 60 ? `${s.task.slice(0, 60)}…` : s.task} ({t(lang, 'next_run')}{' '}
                  {formatNextRun(s.lastFire ?? null, s.intervalMin, Date.now())})
                </button>
                <button
                  type="button"
                  className="ghost xs"
                  onClick={() => toggleSchedule(s.id)}
                  aria-label={t(lang, 'schedule_enable')}
                  title={t(lang, 'schedule_enable')}
                >
                  {s.enabled ? '⏸' : '▶'}
                </button>
                <button
                  type="button"
                  className="ghost xs"
                  onClick={() => deleteSchedule(s.id)}
                  aria-label={t(lang, 'schedule_delete')}
                  title={t(lang, 'schedule_delete')}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>

          <h3>{t(lang, 'run_history_title')}</h3>
          <div className="history">
            {settings.lastRuns.length === 0 && <p className="muted">{t(lang, 'run_history_empty')}</p>}
            {settings.lastRuns.slice(0, 5).map((r) => (
              <span key={`${r.at}-${r.task}`} className="history-row">
                <button type="button" className="history-item" onClick={() => setTask(r.task)} title={r.task}>
                  {r.task.length > 60 ? `${r.task.slice(0, 60)}…` : r.task} · {r.steps} passi · {r.tokens}{' '}
                  token
                </button>
              </span>
            ))}
            {settings.lastRuns.length > 0 && (
              <button type="button" className="secondary xs" onClick={() => update({ lastRuns: [] })}>
                {t(lang, 'run_history_clear')}
              </button>
            )}
          </div>
          {!provider.supportsVision && <p className="warn">{t(lang, 'vision_warn')}</p>}
          {provider.keyUrl && provider.needsKey && (
            <a href={provider.keyUrl} target="_blank" rel="noreferrer noopener">
              {t(lang, 'get_key', { provider: provider.name })}
            </a>
          )}
          <p className="muted">
            {t(lang, 'run_stats', {
              runs: usage.runs,
              tokens: usage.inputTokens + usage.outputTokens,
            })}
          </p>
        </section>
      )}

      <div
        className="log"
        ref={logRef}
        onScroll={onLogScroll}
        role="log"
        aria-live="polite"
        aria-label="Attività agente"
      >
        {log.length > 0 && (
          <div className="log-toolbar">
            <select
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value as LogFilter)}
              aria-label="Filtro log"
              className="secondary xs"
            >
              <option value="all">{t(lang, 'filter_all')}</option>
              <option value="tools">{t(lang, 'filter_tools')}</option>
              <option value="errors">{t(lang, 'filter_errors')}</option>
            </select>
            <button type="button" className="secondary xs" onClick={downloadLog}>
              {t(lang, 'download_log')}
            </button>
            <button type="button" className="secondary xs" onClick={copyLog}>
              {copied ? t(lang, 'copied') : t(lang, 'copy_log')}
            </button>
            <button type="button" className="secondary xs" onClick={clearLog}>
              {t(lang, 'clear_log')}
            </button>
          </div>
        )}
        {log.length === 0 && (
          <>
            {!onboarded && (
              <div className="banner inbox" role="status">
                <div>
                  <strong>{t(lang, 'onboarding_title')}</strong>
                  <p>{t(lang, 'onboarding_body')}</p>
                </div>
                <button type="button" className="secondary xs" onClick={() => void dismissOnboarding()}>
                  {t(lang, 'onboarding_done')}
                </button>
              </div>
            )}
            <p className="hint">{configured ? t(lang, 'hint_ok') : t(lang, 'hint_no_key')}</p>
            {configured && (
              <div className="chips">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className="chip" onClick={() => setTask(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {history.length === 0 && settings.keepHistory && (
              <p className="muted">{t(lang, 'history_empty')}</p>
            )}
            <div className="history">
              <span className="muted">{t(lang, 'templates_title')}</span>
              {settings.savedPrompts.length === 0 && <p className="muted">{t(lang, 'template_ph')}</p>}
              {settings.savedPrompts.map((p) => (
                <span key={p} className="history-row">
                  <button type="button" className="history-item" onClick={() => setTask(p)} title={p}>
                    {p.length > 70 ? `${p.slice(0, 70)}…` : p}
                  </button>
                  <button
                    type="button"
                    className="ghost xs"
                    onClick={() => update({ savedPrompts: settings.savedPrompts.filter((x) => x !== p) })}
                    aria-label={t(lang, 'template_delete')}
                    title={t(lang, 'template_delete')}
                  >
                    ✕
                  </button>
                </span>
              ))}
              <button type="button" className="secondary xs" onClick={saveTemplate} disabled={!task.trim()}>
                {t(lang, 'template_save')}
              </button>
            </div>
            {history.length > 0 && (
              <div className="history">
                <span className="muted">{t(lang, 'recent')}</span>
                {history.slice(0, 5).map((h) => (
                  <span key={h} className="history-row">
                    <button type="button" className="history-item" onClick={() => setTask(h)} title={h}>
                      {h.length > 70 ? `${h.slice(0, 70)}…` : h}
                    </button>
                    <button
                      type="button"
                      className="ghost xs"
                      onClick={() => void removeHistoryTask(h).then(refreshHistory)}
                      aria-label={`Rimuovi: ${h.slice(0, 40)}`}
                      title="Rimuovi"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  className="secondary xs"
                  onClick={() =>
                    void clearHistory().then(() => {
                      void refreshHistory().then(() => flashNotice(t(lang, 'history_cleared')));
                    })
                  }
                >
                  Svuota cronologia
                </button>
              </div>
            )}
          </>
        )}
        {log
          .filter((entry) => {
            if (settings.compactLog && (entry.kind === 'tool' || entry.kind === 'info')) return false;
            if (logFilter === 'tools') return entry.kind === 'tool' || entry.kind === 'info';
            if (logFilter === 'errors') return entry.kind === 'error';
            return true;
          })
          .map((entry) => (
            <div
              key={entry.id}
              className={`msg ${entry.kind}`}
              title={new Date(entry.at).toLocaleTimeString()}
            >
              {entry.text.length > 400 && entry.kind !== 'user' ? (
                <details>
                  <summary>{entry.text.slice(0, 120)}…</summary>
                  {entry.text}
                </details>
              ) : (
                entry.text
              )}
              {entry.kind === 'result' && (
                <button type="button" className="secondary xs copy" onClick={copyResult}>
                  {copied ? t(lang, 'copied') : t(lang, 'copy_result')}
                </button>
              )}
            </div>
          ))}
        {running && streamText && (
          <div className="msg result streaming" role="status" aria-live="polite">
            {streamText}▍
          </div>
        )}
      </div>

      <footer className="composer">
        <div className="composer-box">
          <textarea
            ref={taskRef}
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                run();
              }
            }}
            placeholder={t(lang, 'compose_ph')}
            rows={2}
            disabled={running}
            maxLength={MAX_TASK_CHARS}
            aria-label={t(lang, 'compose_ph')}
          />
          <span className="muted counter">
            {task.length}/{MAX_TASK_CHARS}
          </span>
        </div>
        {running ? (
          <button
            className="stop prominent"
            onClick={stop}
            title={t(lang, 'keyboard_stop')}
            aria-label={t(lang, 'stop')}
          >
            ⏹ {t(lang, 'stop')}
          </button>
        ) : (
          <button
            className="run"
            onClick={run}
            disabled={!task.trim() || !configured}
            aria-label={t(lang, 'run')}
          >
            {t(lang, 'run')}
          </button>
        )}
      </footer>
      {!configured && !showSettings && (
        <button type="button" className="cta" onClick={() => setShowSettings(true)}>
          {t(lang, 'not_configured')}
        </button>
      )}
    </div>
  );
}
