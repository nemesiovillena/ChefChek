/**
 * AI API Keys management — centraliza el acceso a las claves API de IA.
 * Se guardan en localStorage (persisten entre sesiones).
 * Nunca se envían al backend para almacenamiento — solo en el FormData de cada petición.
 */

export interface AIProvider {
  id: string;
  name: string;
  keyPrefix: string;
  keyPlaceholder: string;
  models: { id: string; name: string }[];
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-proj-...',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4o', name: 'GPT-4o' },
    ],
  },
  {
    id: 'google',
    name: 'Google Gemini',
    keyPrefix: 'AIza',
    keyPlaceholder: 'AIza...',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    keyPrefix: 'sk-ant-',
    keyPlaceholder: 'sk-ant-api03-...',
    models: [
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    keyPrefix: 'sk-or-',
    keyPlaceholder: 'sk-or-v1-...',
    models: [
      { id: 'openrouter-gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'openrouter-claude-haiku', name: 'Claude Haiku' },
      { id: 'openrouter-gemini-flash', name: 'Gemini Flash' },
      { id: 'openrouter-llama', name: 'Llama 4 Maverick' },
    ],
  },
];

const STORAGE_KEY_PREFIX = 'ai_api_key_';

/** Obtener la API key de un provider */
export function getApiKey(providerId: string): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(`${STORAGE_KEY_PREFIX}${providerId}`) || '';
}

/** Guardar la API key de un provider */
export function setApiKey(providerId: string, key: string): void {
  if (typeof window === 'undefined') return;
  if (key) {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${providerId}`, key);
  } else {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${providerId}`);
  }
}

/** Obtener la API key para un modelo específico (busca su provider) */
export function getApiKeyForModel(modelId: string): string {
  const provider = AI_PROVIDERS.find(p => p.models.some(m => m.id === modelId));
  return provider ? getApiKey(provider.id) : '';
}

/** Obtener el provider ID de un modelo */
export function getProviderForModel(modelId: string): string | undefined {
  return AI_PROVIDERS.find(p => p.models.some(m => m.id === modelId))?.id;
}
