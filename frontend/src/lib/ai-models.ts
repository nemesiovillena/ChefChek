/**
 * Catálogo compartido de modelos de IA del proyecto. Lo usan la sección
 * «Asistente IA» (todos los modelos) y la de «Captura de recetas» (solo los
 * que tienen visión, porque la captura puede leer fotos y PDF).
 *
 * El `id` se envía tal cual al proveedor; solo hay adaptadores para los
 * proveedores listados (openai/gemini/anthropic/opencode).
 */
export const AI_ASSISTANT_PROVIDERS = [
  'openai',
  'gemini',
  'anthropic',
  'opencode',
] as const;
export type AiAssistantProvider = (typeof AI_ASSISTANT_PROVIDERS)[number];

export interface AiModelOption {
  id: string;
  name: string;
  provider: AiAssistantProvider;
  /** Coste aproximado por llamada. */
  cost: string;
  desc: string;
  /** true si el modelo lee imágenes/PDF (necesario para captura por foto). */
  vision: boolean;
}

export const AI_MODELS: AiModelOption[] = [
  // OpenAI
  { id: 'gpt-4o-mini', provider: 'openai', name: 'GPT-4o Mini', cost: '~0,002 €', desc: 'OpenAI económico, respuestas correctas', vision: true },
  { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', cost: '~0,02 €', desc: 'OpenAI, más preciso en preguntas complejas', vision: true },
  { id: 'gpt-5.2', provider: 'openai', name: 'GPT-5.2', cost: '~0,01 €', desc: 'Rápido y económico para consultas cortas', vision: true },
  // Gemini — Google retira modelos rápido: gemini-2.0-flash y gemini-2.5-flash
  // devuelven 404 "no longer available" y remiten a gemini-3.6-flash.
  // gemini-flash-latest es un alias que Google mantiene apuntando a la Flash
  // vigente (no se pudre), pero puede saturarse igual que 3.6.
  { id: 'gemini-3.6-flash', provider: 'gemini', name: 'Gemini 3.6 Flash', cost: '~0,001 €', desc: 'El más barato; puede dar 503 en horas punta', vision: true },
  { id: 'gemini-flash-latest', provider: 'gemini', name: 'Gemini Flash (última)', cost: '~0,002 €', desc: 'Alias a la última Flash; a prueba de retiradas de modelo', vision: true },
  // Anthropic
  { id: 'claude-haiku-4-5-20251001', provider: 'anthropic', name: 'Claude Haiku 4.5', cost: '~0,005 €', desc: 'Buen balance calidad/precio', vision: true },
  { id: 'claude-sonnet-4-5', provider: 'anthropic', name: 'Claude Sonnet 4.5', cost: '~0,02 €', desc: 'El más preciso para preguntas complejas', vision: true },
  // OpenCode Zen (https://opencode.ai/zen): gateway OpenAI-compatible; una sola
  // API key da acceso a todos estos modelos. Subconjunto curado de los modelos
  // servidos por /chat/completions (precio por 1M tokens: entrada/salida).
  // De Zen, solo el "-vision-exp" está confirmado como multimodal.
  { id: 'deepseek-v4-flash', provider: 'opencode', name: 'DeepSeek V4 Flash', cost: '~0,001 €', desc: 'El más barato y rápido de Zen', vision: false },
  { id: 'deepseek-v4-flash-vision-exp', provider: 'opencode', name: 'DeepSeek V4 Flash Visión', cost: '~0,001 €', desc: 'Barato y además lee imágenes/PDF', vision: true },
  { id: 'glm-5.3-flash', provider: 'opencode', name: 'GLM 5.3 Flash', cost: '~0,001 €', desc: 'Rápido y muy económico', vision: false },
  { id: 'minimax-m2.7', provider: 'opencode', name: 'MiniMax M2.7', cost: '~0,002 €', desc: 'Buen equilibrio calidad/precio', vision: false },
  { id: 'mistral-large-4', provider: 'opencode', name: 'Mistral Large 4', cost: '~0,003 €', desc: 'Europeo (RGPD) y buena calidad', vision: false },
  { id: 'kimi-k2.6', provider: 'opencode', name: 'Kimi K2.6', cost: '~0,005 €', desc: 'Sólido en preguntas complejas', vision: false },
  { id: 'glm-5.2', provider: 'opencode', name: 'GLM 5.2', cost: '~0,006 €', desc: 'Más preciso, coste medio', vision: false },
  { id: 'qwen3.8-max', provider: 'opencode', name: 'Qwen3.8 Max', cost: '~0,008 €', desc: 'El más potente de Zen (y el más caro)', vision: false },
];

/** Solo los modelos que leen imágenes/PDF. */
export const VISION_MODELS: AiModelOption[] = AI_MODELS.filter(
  (m) => m.vision,
);

/** Nombre legible de un id de modelo (cae al propio id si no está en catálogo). */
export function aiModelName(id: string | null | undefined): string {
  return AI_MODELS.find((m) => m.id === id)?.name ?? id ?? '';
}
