import { useApiQuery, useApiMutation, useInvalidateQueries } from './use-api';
import type { AiAssistantProvider } from '@/lib/ai-models';

/**
 * Configuración del modelo IA de la Captura de recetas, guardada por tenant en
 * el servidor (proveedor + modelo + API key cifrada). Independiente de la del
 * Asistente IA: permite usar un modelo con visión solo para las capturas.
 */
export interface RecipeCaptureConfig {
  provider: AiAssistantProvider | null;
  model: string | null;
  hasApiKey: boolean;
  /** Proveedor, modelo y clave presentes: se puede llamar a la IA. */
  isReady: boolean;
}

export interface RecipeCaptureConfigInput {
  provider?: AiAssistantProvider;
  model?: string;
  apiKey?: string; // omitir para conservar la key guardada
}

const RECIPE_CAPTURE_CONFIG_KEY = ['recipe-capture-config'];

export function useRecipeCaptureConfig() {
  return useApiQuery<RecipeCaptureConfig>(
    RECIPE_CAPTURE_CONFIG_KEY,
    '/v1/recipe-capture-config',
  );
}

export function useSaveRecipeCaptureConfig() {
  const invalidateQueries = useInvalidateQueries();
  return useApiMutation<RecipeCaptureConfig, RecipeCaptureConfigInput>(
    '/v1/recipe-capture-config',
    'PUT',
    {
      onSuccess: () => {
        invalidateQueries([RECIPE_CAPTURE_CONFIG_KEY]);
      },
    },
  );
}
