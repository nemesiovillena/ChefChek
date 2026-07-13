'use client';

import { Sparkles, AlertTriangle } from 'lucide-react';

/**
 * Badge que indica cómo se extrajeron los datos del albarán:
 * - "ai": extracción con modelo multimodal (fiable)
 * - "regex": la IA falló o no se configuró y actuó el método básico (baja calidad)
 * Los albaranes anteriores a la introducción de extraction_method no muestran nada.
 */
interface OcrMethodBadgeProps {
  extractionMethod?: string | null;
  extractionModel?: string | null;
}

/** Nombres legibles para los IDs de modelo del selector */
const MODEL_LABELS: Record<string, string> = {
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-4o': 'GPT-4o',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'claude-haiku-4-5-20251001': 'Claude Haiku',
  'claude-sonnet-4-20250514': 'Claude Sonnet',
  'openrouter-gpt-4o-mini': 'GPT-4o Mini',
  'openrouter-claude-haiku': 'Claude Haiku',
  'openrouter-gemini-flash': 'Gemini Flash',
  'openrouter-llama': 'Llama 4',
};

export function OcrMethodBadge({ extractionMethod, extractionModel }: OcrMethodBadgeProps) {
  if (!extractionMethod) return null;

  if (extractionMethod === 'ai') {
    const modelLabel = extractionModel ? MODEL_LABELS[extractionModel] || extractionModel : null;
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
        title="Los datos se extrajeron con un modelo de IA multimodal"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {modelLabel ? `IA · ${modelLabel}` : 'Procesado con IA'}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
      title="La extracción con IA falló o no estaba configurada; los datos provienen del método básico y pueden contener errores. Revisa las líneas con atención."
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      Método básico — revisar
    </span>
  );
}
