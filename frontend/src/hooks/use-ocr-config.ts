import { useApiQuery, useApiMutation, useInvalidateQueries } from './use-api';

/**
 * Configuración del motor IA de OCR, guardada por tenant en el servidor
 * (modelo + API key cifrada). Compartida por todos los dispositivos del tenant,
 * a diferencia del localStorage que es por-navegador.
 */
export interface OcrConfig {
  model: string; // "regex" si no hay nada configurado
  hasApiKey: boolean;
}

const OCR_CONFIG_KEY = ['ocr-config'];

export function useOcrConfig() {
  return useApiQuery<OcrConfig>(OCR_CONFIG_KEY, '/v1/ocr-config');
}

export function useUpdateOcrConfig() {
  const invalidateQueries = useInvalidateQueries();
  return useApiMutation<OcrConfig, { model?: string; apiKey?: string }>(
    '/v1/ocr-config',
    'PUT',
    {
      onSuccess: () => {
        invalidateQueries([OCR_CONFIG_KEY]);
      },
    },
  );
}
