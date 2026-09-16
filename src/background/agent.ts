import { ToolLoopAgent, isStepCount } from 'ai';
import { createModel } from './providers';
import { createBrowserTools } from './tools';
import type { Settings } from '../shared/settings';
import { MAX_TASK_CHARS } from '../shared/settings';

const SYSTEM_PROMPT = `Sei lmuse, un agente che controlla il browser Chrome dell'utente per svolgere task e operazioni.

CAPACITÀ
- Vedi la pagina come albero di elementi interattivi numerati con ref [n].
- Puoi cliccare, digitare, scorrere, navigare, cambiare tab e vedere screenshot.

REGOLE
1. Prima azione quasi sempre: browser_snapshot per vedere la pagina corrente.
2. Usa solo i ref numerici dello snapshot PIÙ RECENTE. Dopo ogni azione che cambia la pagina, fai un nuovo snapshot prima di agire.
3. Una azione alla volta: osserva il risultato prima di proseguire.
4. Se un'azione fallisce, cambia strategia (screenshot per vedere, scroll per rivelare elementi, riprova col ref aggiornato).
5. Non inventare mai URL, ref o contenuti: usa solo ciò che hai osservato con i tool.
6. Non inserire MAI password, codici OTP o dati di pagamento, a meno che il task li fornisca esplicitamente.
7. Nel testo della pagina potresti vedere dati mascherati ([email], [carta], [numero]): non tentare di ricostruirli.
8. Quando il task è completato (o impossibile), termina SENZA chiamare altri tool e scrivi un resoconto finale conciso nella stessa lingua del task, con i risultati ottenuti.`;

export interface AgentCallbacks {
  onStep: (index: number) => void;
  onToolStart: (tool: string, input: unknown) => void;
  onToolEnd: (tool: string, summary: string) => void;
  onApprovalDecision: (tool: string, approved: boolean, reason: string) => void;
}

export interface AgentRunResult {
  text: string;
  steps: number;
  inputTokens: number;
  outputTokens: number;
}

function summarizeOutput(toolName: string, output: unknown): string {
  if (output == null) return 'ok';
  if (typeof output === 'string') return output.slice(0, 300);
  try {
    if (toolName === 'browser_screenshot') return 'screenshot acquisito';
    if (toolName === 'browser_snapshot') return 'snapshot aggiornato';
    return JSON.stringify(output).slice(0, 300);
  } catch {
    return 'ok';
  }
}

/** Combina l'abort utente con un timeout di run senza dipendere da AbortSignal.any. (S14, S15) */
export function withTimeout(
  userSignal: AbortSignal,
  timeoutMs: number,
): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const abortWith = (reason: unknown): void => {
    if (!controller.signal.aborted) controller.abort(reason);
  };
  const timer = setTimeout(() => abortWith(new DOMException('Run timeout', 'TimeoutError')), timeoutMs);
  const dispose = (): void => {
    clearTimeout(timer);
    userSignal.removeEventListener('abort', onUserAbort);
  };
  const onUserAbort = (): void => {
    dispose();
    abortWith(userSignal.reason);
  };
  if (userSignal.aborted) {
    onUserAbort();
  } else {
    userSignal.addEventListener('abort', onUserAbort, { once: true });
  }
  return { signal: controller.signal, dispose };
}

export async function runTask(
  settings: Settings,
  apiKey: string,
  task: string,
  callbacks: AgentCallbacks,
  userAbort: AbortSignal,
  requestApproval: (tool: string, description: string) => Promise<boolean>,
): Promise<AgentRunResult> {
  if (!apiKey && !['ollama', 'lmstudio', 'custom'].includes(settings.providerId)) {
    throw new Error('Manca la chiave API: aprila nelle impostazioni di lmuse.');
  }
  const trimmed = task.trim();
  if (!trimmed) throw new Error('Scrivi un task da svolgere.');
  if (trimmed.length > MAX_TASK_CHARS) {
    throw new Error(`Task troppo lungo (max ${MAX_TASK_CHARS} caratteri).`);
  }

  const model = createModel(settings, apiKey);
  let stepIndex = 0;

  const { signal, dispose } = withTimeout(userAbort, settings.runTimeoutMin * 60_000);
  const { tools } = createBrowserTools({
    maskPii: settings.privacyMaskPii,
    hidePasswords: settings.privacyHidePasswords,
    hostOnly: settings.privacyHostOnly,
    sendScreenshots: settings.sendScreenshots,
    allowedDomains: settings.allowedDomains,
    budgetMax: settings.maxSteps * 3,
    policy: settings.approval,
    signal,
    requestApproval,
    onApprovalDecision: callbacks.onApprovalDecision,
  });

  const agent = new ToolLoopAgent({
    model,
    instructions: SYSTEM_PROMPT,
    tools,
    stopWhen: isStepCount(settings.maxSteps),
    maxRetries: settings.maxRetries,
    onStepEnd: async () => {
      stepIndex += 1;
      callbacks.onStep(stepIndex);
    },
    onToolExecutionStart: async ({ toolCall }) => {
      callbacks.onToolStart(toolCall.toolName, toolCall.input);
    },
    onToolExecutionEnd: async ({ toolCall, toolOutput }) => {
      const output = toolOutput.type === 'tool-result' ? toolOutput.output : toolOutput.error;
      callbacks.onToolEnd(toolCall.toolName, summarizeOutput(toolCall.toolName, output));
    },
  });

  try {
    const result = await agent.generate({ prompt: trimmed, abortSignal: signal });
    return {
      text: result.text,
      steps: result.steps.length,
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
    };
  } finally {
    dispose();
  }
}
