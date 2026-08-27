/**
 * AI API Keys management — centraliza el acceso a las claves API de IA.
 * Se guardan en localStorage (persisten entre sesiones).
 * Nunca se envían al backend para almacenamiento — solo en el FormData de cada petición.
 */

export interface AIProvider {
  id: string;
  name: string;
  /** Prefijos aceptados para la key del provider (basta con que empiece por uno) */
  keyPrefixes: string[];
  keyPlaceholder: string;
  models: { id: string; name: string }[];
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    keyPrefixes: ['sk-'],
    keyPlaceholder: 'sk-proj-...',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4o', name: 'GPT-4o' },
    ],
  },
  {
    id: 'google',
    name: 'Google Gemini',
    // Google migra las keys de Gemini de 'AIza...' al nuevo formato 'AQ.Ab...' (2026)
    keyPrefixes: ['AIza', 'AQ.'],
    keyPlaceholder: 'AIza... o AQ.Ab...',
    // gemini-2.5-flash retirado: Google devuelve 404 "no longer available to
    // new users" para keys nuevas. Google Flash sigue disponible vía
    // OpenRouter (openrouter-gemini-flash), que usa su propia cuenta/cuota.
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    keyPrefixes: ['sk-ant-'],
    keyPlaceholder: 'sk-ant-api03-...',
    models: [
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    keyPrefixes: ['sk-or-'],
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

/**
 * Limpia una API key pegada. Las keys solo contienen ASCII imprimible
 * (letras, dígitos, guiones...), así que se elimina todo lo demás: espacios,
 * saltos de línea y caracteres invisibles (zero-width, NBSP, BOM) que se
 * cuelan al copiar desde webs, chats o PDFs. También comillas envolventes.
 */
export function sanitizeApiKey(key: string): string {
  return key.replace(/[^\x21-\x7E]+/g, '').replace(/^["']+|["']+$/g, '');
}

/** Obtener la API key de un provider */
export function getApiKey(providerId: string): string {
  if (typeof window === 'undefined') return '';
  return sanitizeApiKey(localStorage.getItem(`${STORAGE_KEY_PREFIX}${providerId}`) || '');
}

/** Guardar la API key de un provider */
export function setApiKey(providerId: string, key: string): void {
  if (typeof window === 'undefined') return;
  key = sanitizeApiKey(key);
  if (key) {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${providerId}`, key);
  } else {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${providerId}`);
  }
  notifyApiKeyChange();
}

const API_KEYS_CHANGED_EVENT = 'ai-api-keys-changed';

function notifyApiKeyChange(): void {
  window.dispatchEvent(new Event(API_KEYS_CHANGED_EVENT));
}

/**
 * Suscripción reactiva a cambios en las API keys: evento propio (misma pestaña,
 * p.ej. al guardar en la sección «Claves API») + evento `storage` (otras pestañas).
 * Para usar con useSyncExternalStore.
 */
export function subscribeToApiKeyChanges(callback: () => void): () => void {
  window.addEventListener(API_KEYS_CHANGED_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(API_KEYS_CHANGED_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

/**
 * Snapshot de qué providers tienen key guardada (string estable para
 * useSyncExternalStore: cambia solo cuando la presencia de una key cambia).
 */
export function getApiKeyPresenceSnapshot(): string {
  return AI_PROVIDERS.map((p) => `${p.id}:${getApiKey(p.id) ? 1 : 0}`).join('|');
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

export interface OcrModelOption {
  id: string;
  name: string;
  cost: string;
  desc: string;
}

/** Motores de extracción disponibles para el OCR de albaranes, con info de coste. Se elige en Configuración. */
export const OCR_MODELS: OcrModelOption[] = [
  { id: 'regex', name: 'Solo OCR (gratis)', cost: '0 €', desc: 'Regex básico, sin coste' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', cost: '~0,01 €', desc: 'Rápido y barato, buena precisión' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', cost: '~0,005 €', desc: 'El más barato, muy buena visión' },
  { id: 'gpt-4o', name: 'GPT-4o', cost: '~0,05 €', desc: 'Máxima precisión, más caro' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku', cost: '~0,01 €', desc: 'Buen balance calidad/precio' },
  { id: 'openrouter-gpt-4o-mini', name: 'OR: GPT-4o Mini', cost: '~0,01 €', desc: 'OpenRouter — GPT-4o Mini' },
  { id: 'openrouter-claude-haiku', name: 'OR: Claude Haiku', cost: '~0,01 €', desc: 'OpenRouter — Claude Haiku' },
  { id: 'openrouter-gemini-flash', name: 'OR: Gemini Flash', cost: '~0,005 €', desc: 'OpenRouter — Gemini Flash' },
  { id: 'openrouter-llama', name: 'OR: Llama 4', cost: '~0,002 €', desc: 'OpenRouter — Llama 4 Maverick' },
];

const OCR_MODEL_STORAGE_KEY = 'ocr_ai_model';

/** Obtener el motor de extracción configurado (elegido en Configuración). Por defecto "regex" (solo OCR, gratis). */
export function getOcrModel(): string {
  if (typeof window === 'undefined') return 'regex';
  return localStorage.getItem(OCR_MODEL_STORAGE_KEY) || 'regex';
}

/** Guardar el motor de extracción elegido */
export function setOcrModel(modelId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OCR_MODEL_STORAGE_KEY, modelId);
}
