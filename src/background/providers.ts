import type { LanguageModel } from 'ai';
import type { Settings } from '../shared/settings';

/**
 * Crea il modello AI SDK v7 corrispondente alle impostazioni utente.
 * Ogni package provider è importato dinamicamente: il service worker carica
 * SOLO il chunk del provider configurato (avvio più leggero, bundle minore).
 * Provider OpenAI-compatibili (OpenRouter, NVIDIA, OpenCode Zen, GitHub,
 * Baseten, SambaNova, Ollama, LM Studio, custom) passano da
 * createOpenAICompatible con baseURL configurabile.
 * La chiave non vive nelle settings: arriva come parametro dedicato.
 */
export async function createModel(settings: Settings, apiKey: string): Promise<LanguageModel> {
  const { providerId, model, baseUrl } = settings;
  if (!model) throw new Error('Specifica il nome del modello nelle impostazioni.');

  const factories: Partial<Record<Settings['providerId'], () => Promise<LanguageModel>>> = {
    openai: async () => (await import('@ai-sdk/openai')).createOpenAI({ apiKey })(model),
    anthropic: async () => (await import('@ai-sdk/anthropic')).createAnthropic({ apiKey })(model),
    google: async () => (await import('@ai-sdk/google')).createGoogleGenerativeAI({ apiKey })(model),
    xai: async () => (await import('@ai-sdk/xai')).createXai({ apiKey })(model),
    groq: async () => (await import('@ai-sdk/groq')).createGroq({ apiKey })(model),
    deepseek: async () => (await import('@ai-sdk/deepseek')).createDeepSeek({ apiKey })(model),
    cerebras: async () => (await import('@ai-sdk/cerebras')).createCerebras({ apiKey })(model),
    mistral: async () => (await import('@ai-sdk/mistral')).createMistral({ apiKey })(model),
    cohere: async () => (await import('@ai-sdk/cohere')).createCohere({ apiKey })(model),
    deepinfra: async () => (await import('@ai-sdk/deepinfra')).createDeepInfra({ apiKey })(model),
    fireworks: async () => (await import('@ai-sdk/fireworks')).createFireworks({ apiKey })(model),
    perplexity: async () => (await import('@ai-sdk/perplexity')).createPerplexity({ apiKey })(model),
    togetherai: async () => (await import('@ai-sdk/togetherai')).createTogetherAI({ apiKey })(model),
    huggingface: async () => (await import('@ai-sdk/huggingface')).createHuggingFace({ apiKey })(model),
    gateway: async () => (await import('@ai-sdk/gateway')).createGateway({ apiKey })(model),
    azure: async () => {
      if (!baseUrl) throw new Error('Azure OpenAI richiede il base URL (endpoint risorsa).');
      return (await import('@ai-sdk/azure')).createAzure({ apiKey, baseURL: baseUrl })(model);
    },
    openrouter: async () =>
      (
        await import('@ai-sdk/openai-compatible')
      ).createOpenAICompatible({
        name: 'openrouter',
        apiKey,
        baseURL: baseUrl || 'https://openrouter.ai/api/v1',
        // Nessun referer falso: solo il nome del prodotto. (P28)
        headers: { 'X-Title': 'lmuse' },
      })(model),
    nvidia: async () =>
      (await import('@ai-sdk/openai-compatible')).createOpenAICompatible({
        name: 'nvidia',
        apiKey,
        baseURL: baseUrl || 'https://integrate.api.nvidia.com/v1',
      })(model),
    opencode: async () =>
      (await import('@ai-sdk/openai-compatible')).createOpenAICompatible({
        name: 'opencode',
        apiKey,
        baseURL: baseUrl || 'https://opencode.ai/zen/v1',
        headers: { 'X-Title': 'lmuse' },
      })(model),
    github: async () =>
      (await import('@ai-sdk/openai-compatible')).createOpenAICompatible({
        name: 'github',
        apiKey,
        baseURL: baseUrl || 'https://models.github.ai/inference',
      })(model),
    baseten: async () =>
      (await import('@ai-sdk/openai-compatible')).createOpenAICompatible({
        name: 'baseten',
        apiKey,
        baseURL: baseUrl || 'https://inference.baseten.co/v1',
      })(model),
    sambanova: async () =>
      (await import('@ai-sdk/openai-compatible')).createOpenAICompatible({
        name: 'sambanova',
        apiKey,
        baseURL: baseUrl || 'https://api.sambanova.ai/v1',
      })(model),
    ollama: async () =>
      (await import('@ai-sdk/openai-compatible')).createOpenAICompatible({
        name: 'ollama',
        baseURL: baseUrl || 'http://localhost:11434/v1',
        apiKey: apiKey || 'ollama',
      })(model),
    lmstudio: async () =>
      (await import('@ai-sdk/openai-compatible')).createOpenAICompatible({
        name: 'lmstudio',
        baseURL: baseUrl || 'http://localhost:1234/v1',
        apiKey: apiKey || 'lm-studio',
      })(model),
    custom: async () => {
      if (!baseUrl) throw new Error('Il provider custom richiede il base URL.');
      return (await import('@ai-sdk/openai-compatible')).createOpenAICompatible({
        name: 'custom',
        apiKey: apiKey || undefined,
        baseURL: baseUrl,
      })(model);
    },
  };

  const factory = factories[providerId];
  if (!factory) throw new Error(`Provider non supportato: ${providerId}`);
  return factory();
}
