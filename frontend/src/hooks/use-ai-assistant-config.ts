import { useApiQuery, useApiMutation, useInvalidateQueries } from './use-api';

/**
 * Configuración del proveedor IA del asistente "Chefchek", guardada por
 * tenant en el servidor (proveedor + modelo + API key cifrada). Config
 * propia, independiente de use-ocr-config (dominio distinto: chat de
 * negocio vs. extracción de albaranes).
 */
export type AiAssistantProvider = 'openai' | 'gemini' | 'anthropic';

export interface AiAssistantConfig {
  provider: AiAssistantProvider | null;
  model: string | null;
  hasApiKey: boolean;
}

export interface AiAssistantConfigInput {
  provider?: AiAssistantProvider;
  model?: string;
  apiKey?: string; // omitir para conservar la key guardada
}

const AI_ASSISTANT_CONFIG_KEY = ['ai-assistant-config'];

export function useAiAssistantConfig() {
  return useApiQuery<AiAssistantConfig>(AI_ASSISTANT_CONFIG_KEY, '/v1/ai-assistant/config');
}

export function useSaveAiAssistantConfig() {
  const invalidateQueries = useInvalidateQueries();
  return useApiMutation<AiAssistantConfig, AiAssistantConfigInput>(
    '/v1/ai-assistant/config',
    'PUT',
    {
      onSuccess: () => {
        invalidateQueries([AI_ASSISTANT_CONFIG_KEY]);
      },
    },
  );
}
