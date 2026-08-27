'use client';

import { useState, useSyncExternalStore } from 'react';
import { AlertTriangle, Bot, Check, CheckCircle2, Loader2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import {
  getApiKey,
  getApiKeyPresenceSnapshot,
  subscribeToApiKeyChanges,
} from '@/lib/ai-api-keys';
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

/** Proveedor del almacén «Claves API» (AI_PROVIDERS) que corresponde a cada
 *  proveedor del asistente — el id de Gemini allí es "google". */
const KEY_STORE_PROVIDER: Record<AiAssistantProvider, string> = {
  openai: 'openai',
  gemini: 'google',
  anthropic: 'anthropic',
};

/** Modelo elegible en la rejilla (mismo patrón que OCR_MODELS del motor OCR). */
interface AssistantModelOption {
  id: string;
  name: string;
  provider: AiAssistantProvider;
  /** Coste aproximado por llamada al asistente */
  cost: string;
  desc: string;
}

/** Catálogo de modelos del asistente. Solo proveedores con adapter en backend
 *  (openai/gemini/anthropic); el id se envía tal cual al proveedor. La rejilla
 *  solo muestra los modelos cuyo proveedor tiene API key configurada. */
const AI_ASSISTANT_MODELS: AssistantModelOption[] = [
  { id: 'gpt-5.2', provider: 'openai', name: 'GPT-5.2', cost: '~0,01 €', desc: 'Rápido y económico para consultas cortas' },
  { id: 'claude-sonnet-4-5', provider: 'anthropic', name: 'Claude Sonnet 4.5', cost: '~0,02 €', desc: 'El más preciso para preguntas complejas' },
  { id: 'claude-haiku-4-5-20251001', provider: 'anthropic', name: 'Claude Haiku 4.5', cost: '~0,005 €', desc: 'Buen balance calidad/precio' },
  { id: 'gemini-3.6-flash', provider: 'gemini', name: 'Gemini 3.6 Flash', cost: '~0,001 €', desc: 'El más barato, respuestas muy rápidas' },
  { id: 'gpt-4o-mini', provider: 'openai', name: 'GPT-4o Mini', cost: '~0,002 €', desc: 'OpenAI económico, respuestas correctas' },
];

/** Último recurso del prefill cuando no hay config ni keys visibles. */
const DEFAULT_MODEL_ID = 'gpt-4o-mini';

function modelName(id: string | null | undefined): string {
  return AI_ASSISTANT_MODELS.find((m) => m.id === id)?.name ?? id ?? '';
}

/**
 * Configuración del modelo IA del asistente "Chefchek" (chat en lenguaje
 * natural sobre precios/compras/recetas/stock), por tenant. Solo se ofrecen
 * modelos de proveedores con API key ya configurada en «Claves API» (o con la
 * key del propio asistente ya guardada en el servidor); al guardar, la key del
 * almacén local se sincroniza al servidor cifrada, igual que el motor OCR.
 */
export function AiAssistantConfigSection() {
  const addNotification = useNotification();
  const { data: config, isLoading } = useAiAssistantConfig();
  const saveMut = useSaveAiAssistantConfig();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    provider: 'openai' as AiAssistantProvider,
    model: '',
  });

  // Re-render en vivo cuando cambien las keys en «Claves API» (misma pestaña u otra).
  useSyncExternalStore(subscribeToApiKeyChanges, getApiKeyPresenceSnapshot, () => '');

  const hasLocalKey = (p: AiAssistantProvider) => Boolean(getApiKey(KEY_STORE_PROVIDER[p]));
  const hasServerKey = (p: AiAssistantProvider) => Boolean(config?.hasApiKey) && config?.provider === p;
  const isModelVisible = (m: AssistantModelOption) => hasLocalKey(m.provider) || hasServerKey(m.provider);
  const visibleModels = AI_ASSISTANT_MODELS.filter(isModelVisible);

  const startEditing = () => {
    const savedInCatalog = AI_ASSISTANT_MODELS.find((m) => m.id === config?.model);
    let provider: AiAssistantProvider;
    let model: string;
    if (savedInCatalog && isModelVisible(savedInCatalog)) {
      // La config guardada sigue siendo elegible: preseleccionarla tal cual.
      provider = savedInCatalog.provider;
      model = savedInCatalog.id;
    } else if (config?.model && config.provider && (hasLocalKey(config.provider) || hasServerKey(config.provider))) {
      // Modelo guardado fuera del catálogo (p.ej. un id retirado) con key aún
      // disponible: conservarlo — guardar sin tocar nada no debe cambiar nada.
      provider = config.provider;
      model = config.model;
    } else {
      provider = visibleModels[0]?.provider ?? 'openai';
      model = visibleModels[0]?.id ?? DEFAULT_MODEL_ID;
    }
    setForm({ provider, model });
    setEditing(true);
  };

  const handleModelPick = (option: AssistantModelOption) => {
    setForm((f) => ({ ...f, provider: option.provider, model: option.id }));
  };

  const handleSave = async () => {
    try {
      // La key viaja del almacén «Claves API» al servidor (cifrada, multi-
      // dispositivo), igual que al elegir el motor de extracción OCR. Vacía
      // (= proveedor visible solo por key de servidor) → conservar la guardada.
      const apiKey = getApiKey(KEY_STORE_PROVIDER[form.provider]);
      await saveMut.mutateAsync({
        provider: form.provider,
        model: form.model.trim(),
        apiKey: apiKey || undefined,
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

  const selectedModel = AI_ASSISTANT_MODELS.find((m) => m.id === form.model);

  return (
    <section className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--on-surface)]">
        <Bot className="h-5 w-5 text-[var(--primary)]" />
        Asistente IA (Chefchek)
      </h2>
      <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
        Modelo de IA que usa el asistente para responder preguntas sobre precios,
        compras, recetas y stock. Solo aparecen los modelos con API key ya
        configurada en «Claves API» (más abajo); la key se guarda cifrada en el
        servidor.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-[var(--on-surface-variant)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
        </div>
      ) : !editing ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {config?.provider ? (
            <p className="text-sm text-[var(--on-surface)]">
              {config.model ? modelName(config.model) : PROVIDER_LABELS[config.provider]}
              {' · '}
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
      ) : visibleModels.length === 0 ? (
        <p className="mt-4 flex items-start gap-1 text-xs text-amber-600">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          Configura primero la API key de un proveedor en «Claves API», más
          abajo — sus modelos aparecerán aquí automáticamente.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {/* Rejilla de modelos — misma interfaz que el motor de extracción OCR */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {visibleModels.map((model) => {
              const isSelected = form.model === model.id;
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => handleModelPick(model)}
                  className={`relative rounded-lg border p-2 text-left transition-colors ${
                    isSelected
                      ? 'border-[var(--primary)] bg-[var(--surface-container-low)] ring-1 ring-[var(--primary)]'
                      : 'border-[var(--outline-variant)] hover:border-[var(--primary)]'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary)] text-primary-foreground">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  )}
                  <div className="truncate text-xs font-medium text-[var(--on-surface)]">{model.name}</div>
                  <div className="text-[10px] text-[var(--on-surface-variant)]">{model.cost}/llamada</div>
                </button>
              );
            })}
          </div>

          {/* Descripción del modelo elegido + confirmación de key */}
          <p className="text-xs text-[var(--on-surface-variant)]">
            {selectedModel
              ? `${selectedModel.name} — ${selectedModel.desc}.`
              : `Modelo personalizado: ${form.model}`}
          </p>
          <p className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            API key de {PROVIDER_LABELS[selectedModel?.provider ?? form.provider]} configurada
          </p>

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
