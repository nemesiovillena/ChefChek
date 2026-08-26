'use client';

import { useState } from 'react';
import { Bot, Loader2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import {
  useAiAssistantConfig,
  useSaveAiAssistantConfig,
  type AiAssistantProvider,
} from '@/hooks/use-ai-assistant-config';

const PROVIDER_LABELS: Record<AiAssistantProvider, string> = {
  openai: 'OpenAI',
  gemini: 'Gemini',
  anthropic: 'Anthropic',
};

const DEFAULT_MODEL: Record<AiAssistantProvider, string> = {
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  anthropic: 'claude-3-5-haiku-latest',
};

/**
 * Configuración del proveedor IA del asistente "Chefchek" (chat en lenguaje
 * natural sobre precios/compras/recetas/stock), por tenant. La API key nunca
 * vuelve al navegador tras guardarla: solo un flag hasApiKey.
 */
export function AiAssistantConfigSection() {
  const addNotification = useNotification();
  const { data: config, isLoading } = useAiAssistantConfig();
  const saveMut = useSaveAiAssistantConfig();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    provider: 'openai' as AiAssistantProvider,
    model: '',
    apiKey: '',
  });

  const startEditing = () => {
    const provider = (config?.provider ?? 'openai') as AiAssistantProvider;
    setForm({
      provider,
      // Precargado con un modelo real por defecto (no un placeholder vacío):
      // guardar sin tocar este campo debe dejar el asistente funcional, no
      // silenciosamente sin "model" (el backend exige provider+model+apiKey
      // completos o degrada a "sin configurar" — bug real detectado en la demo).
      model: config?.model ?? DEFAULT_MODEL[provider],
      apiKey: '',
    });
    setEditing(true);
  };

  const handleProviderChange = (provider: AiAssistantProvider) => {
    setForm((f) => ({
      ...f,
      provider,
      // Si el modelo seguía siendo el default del proveedor anterior (el
      // usuario no lo tocó a mano), lo cambiamos al default del nuevo.
      model: f.model === DEFAULT_MODEL[f.provider] ? DEFAULT_MODEL[provider] : f.model,
    }));
  };

  const handleSave = async () => {
    try {
      await saveMut.mutateAsync({
        provider: form.provider,
        model: form.model.trim() || DEFAULT_MODEL[form.provider],
        apiKey: form.apiKey || undefined,
      });
      setEditing(false);
      addNotification({
        type: 'success',
        title: 'Asistente configurado',
        message: 'Chefchek ya puede responder tus preguntas.',
      });
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo guardar',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  };

  const inputCls =
    'w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)] outline-none focus:border-[var(--primary)]';

  return (
    <section className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--on-surface)]">
        <Bot className="h-5 w-5 text-[var(--primary)]" />
        Asistente IA (Chefchek)
      </h2>
      <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
        Proveedor y modelo de IA que usa el asistente para responder preguntas
        sobre precios, compras, recetas y stock. La API key se guarda cifrada.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-[var(--on-surface-variant)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
        </div>
      ) : !editing ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {config?.provider ? (
            <p className="text-sm text-[var(--on-surface)]">
              {PROVIDER_LABELS[config.provider]}
              {config.model ? ` · ${config.model}` : ''} ·{' '}
              {config.hasApiKey ? 'API key guardada' : 'sin API key'}
            </p>
          ) : (
            <p className="text-sm italic text-[var(--on-surface-variant)]">
              Sin configurar: el asistente todavía no puede responder preguntas.
            </p>
          )}
          <button
            onClick={startEditing}
            className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
          >
            {config?.provider ? 'Editar' : 'Configurar'}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={form.provider}
              onChange={(e) => handleProviderChange(e.target.value as AiAssistantProvider)}
              className={inputCls}
            >
              {(Object.keys(PROVIDER_LABELS) as AiAssistantProvider[]).map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
            <input
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              placeholder="Modelo"
              className={inputCls}
            />
            <input
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              placeholder={
                config?.hasApiKey ? 'API key (vacío = conservar)' : 'API key'
              }
              type="password"
              className={`${inputCls} sm:col-span-2`}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saveMut.isPending}
              className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saveMut.isPending ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium text-[var(--on-surface)]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
