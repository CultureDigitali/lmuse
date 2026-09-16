import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  MAX_TASK_CHARS,
  PROVIDERS,
  addHistoryTask,
  clearHistory,
  clearInbox,
  clearRunState,
  clearStoredKey,
  getProvider,
  isOnboarded,
  loadHistory,
  loadInbox,
  loadRunState,
  loadSettings,
  loadStoredKey,
  loadUsage,
  removeHistoryTask,
  saveSettings,
  saveStoredKey,
  setOnboarded,
  type ApprovalPolicy,
  type InboxEntry,
  type ProviderId,
  type RunState,
  type Settings,
  type SwToPanelMessage,
  type UsageStats,
} from '../shared/settings';
import { formatElapsed } from '../shared/approval';
import { t, type Lang } from '../shared/i18n';

interface LogEntry {
  id: number;
  kind: 'user' | 'tool' | 'result' | 'error' | 'info';
  text: string;
}

interface PendingApproval {
  id: string;
  tool: string;
  description: string;
  expiresAt: number;
}

let logId = 0;
const nextId = () => ++logId;

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
  const lang = useRef<Lang>(detectLang()).current;
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
  apiKeyRef.current = apiKey;
  settingsRef.current = settings;

  const append = useCallback((entry: Omit<LogEntry, 'id'>) => {
    setLog((prev) => [...prev.slice(-200), { ...entry, id: nextId() }]);
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
          append({ kind: 'info', text: `— ${t(lang, 'step_of', { n: message.index, max })} —` });
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
        const usageLine = t(lang, 'usage_line', {
          steps: message.steps,
          tokens,
          elapsed: formatElapsed(message.elapsedMs),
        });
        append({ kind: 'result', text: `${message.text}\n\n_${usageLine}_` });
        setLastResult(message.text);
        setShowRetry(false);
        setApproval(null);
        setElapsedMs(0);
        setRunning(false);
        setSteps(0);
        void refreshHistory();
        void loadInbox().then(setInbox);
        void loadUsage().then(setUsage);
      } else if (message.type === 'ERROR') {
        append({ kind: 'error', text: message.message });
        setErrorBanner(message.message);
        setShowRetry(true);
        setApproval(null);
        setElapsedMs(0);
        setRunning(false);
        setSteps(0);
      } else if (message.type === 'APPROVAL') {
        setApproval({
          id: message.id,
          tool: message.tool,
          description: message.description,
          expiresAt: Date.now() + message.timeoutSec * 1000,
        });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [append]);

  // --- Stato iniziale: settings, chiave, cronologia, inbox, usage, onboarding, run orfano ---
  useEffect(() => {
    void (async () => {
      const s = await loadSettings();
      setSettings(s);
      const key = (await loadStoredKey(s.rememberKey)) || (await loadStoredKey(!s.rememberKey));
      setApiKey(key);
      if (!key && getProvider(s.providerId).needsKey) setShowSettings(true);
      setHistory(await loadHistory());
      setInbox(await loadInbox());
      setUsage(await loadUsage());
      setOnboardedState(await isOnboarded());
      const rs = await loadRunState();
      if (rs) setOrphan(rs);
    })();
    taskRef.current?.focus();
  }, []);

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
    void saveStoredKey(value, settings.rememberKey);
  }

  async function onToggleRemember(remember: boolean) {
    update({ rememberKey: remember });
    // Sposta la chiave esistente nello store corrispondente.
    const current = apiKeyRef.current;
    await saveStoredKey('', !remember);
    if (current) await saveStoredKey(current, remember);
  }

  async function onClearKey() {
    await clearStoredKey();
    setApiKey('');
  }

  async function onClearAll() {
    if (!window.confirm(t(lang, 'confirm_clear_all'))) return;
    await clearStoredKey();
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
  }

  function run() {
    const trimmed = task.trim().slice(0, MAX_TASK_CHARS);
    if (!trimmed || running) return;
    startTask(trimmed);
    setTask('');
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
    portRef.current?.postMessage({ type: approved ? 'APPROVE' : 'DENY', id: approval.id });
    setApproval(null);
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
  const showBaseUrl = ['azure', 'ollama', 'lmstudio', 'custom', 'openrouter'].includes(settings.providerId);
  const configured = !provider.needsKey || apiKey.trim().length > 0;

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="logo">lmuse</span>
          <span className="model-tag" title={`${provider.name} · ${settings.model || '—'}`}>
            {provider.name} · {settings.model || '—'}
          </span>
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
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
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
            {t(lang, 'allowed_domains')}
            <input
              value={settings.allowedDomains}
              onChange={(e) => update({ allowedDomains: e.target.value })}
              placeholder={t(lang, 'allowed_domains_ph')}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="btn-row">
            <button type="button" className="secondary" onClick={onExportSettings}>
              {copied ? t(lang, 'copied') : t(lang, 'export_settings')}
            </button>
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
        {log.map((entry) => (
          <div key={entry.id} className={`msg ${entry.kind}`}>
            {entry.text}
            {entry.kind === 'result' && (
              <button type="button" className="secondary xs copy" onClick={copyResult}>
                {copied ? t(lang, 'copied') : t(lang, 'copy_result')}
              </button>
            )}
          </div>
        ))}
      </div>

      <footer className="composer">
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
