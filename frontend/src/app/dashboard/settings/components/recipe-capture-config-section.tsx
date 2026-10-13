'use client';

import { useState, useSyncExternalStore } from 'react';
import { AlertTriangle, Camera, Check, CheckCircle2, Loader2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import {
  ASSISTANT_KEY_STORE_PROVIDER,
  getApiKey,
  getApiKeyPresenceSnapshot,
  subscribeToApiKeyChanges,
} from '@/lib/ai-api-keys';
import {
  VISION_MODELS,
  aiModelName,
  type AiAssistantProvider,
  type AiModelOption,
} from '@/lib/ai-models';
import { useModules } from '@/features/modules/hooks/use-modules';
import {
  useRecipeCaptureConfig,
  useSaveRecipeCaptureConfig,
} from '@/hooks/use-recipe-capture-config';
import { useAiAssistantConfig } from '@/hooks/use-ai-assistant-config';

const PROVIDER_LABELS: Record<AiAssistantProvider, string> = {
  openai: 'OpenAI',
  gemini: 'Gemini',
  anthropic: 'Anthropic',
  opencode: 'OpenCode Zen',
};

/** Proveedor del almacén «Claves API» que corresponde a cada proveedor de IA. */
const KEY_STORE_PROVIDER = ASSISTANT_KEY_STORE_PROVIDER as Record<
  AiAssistantProvider,
  string
>;

/** Modelo recomendado por defecto para la captura (o el primero del catálogo). */
const DEFAULT_MODEL =
  VISION_MODELS.find((m) => m.id === 'gemini-3.1-flash-lite') ??
  VISION_MODELS[0];

/**
 * Configuración del modelo IA de la Captura de recetas, por tenant. A
 * diferencia de la del Asistente IA, solo ofrece modelos con visión, porque la
 * captura puede leer fotos y PDF. Independiente del asistente: si no se elige
 * nada, la captura sigue usando el modelo del asistente como respaldo.
 */
export function RecipeCaptureConfigSection() {
  const addNotification = useNotification();
  const { isEnabled } = useModules();
  const { data: config, isLoading } = useRecipeCaptureConfig();
  const { data: assistantConfig } = useAiAssistantConfig();
  const saveMut = useSaveRecipeCaptureConfig();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    provider: DEFAULT_MODEL.provider as AiAssistantProvider,
    model: DEFAULT_MODEL.id,
  });

  // Re-render en vivo cuando cambien las keys en «Claves API».
  useSyncExternalStore(subscribeToApiKeyChanges, getApiKeyPresenceSnapshot, () => '');

  const hasLocalKey = (p: AiAssistantProvider) =>
    Boolean(getApiKey(KEY_STORE_PROVIDER[p]));
  /** Key ya guardada en el servidor para la captura, por proveedor. */
  const hasServerKey = (p: AiAssistantProvider) =>
    Boolean(config?.hasApiKey) && config?.provider === p;
  const keyReady = (p: AiAssistantProvider) => hasLocalKey(p) || hasServerKey(p);

  // El módulo debe estar activo: sin él la sección no aplica.
  if (!isEnabled('captura-recetas')) {
    return null;
  }

  const startEditing = () => {
    const savedInCatalog = VISION_MODELS.find((m) => m.id === config?.model);
    // Sin modelo propio todavía: prefill con el del asistente (el que se está
    // usando como respaldo), si es uno con visión.
    const assistantInCatalog = VISION_MODELS.find(
      (m) => m.id === assistantConfig?.model,
    );
    let provider: AiAssistantProvider;
    let model: string;
    if (savedInCatalog) {
      provider = savedInCatalog.provider;
      model = savedInCatalog.id;
    } else if (config?.model && config.provider) {
      // Modelo guardado fuera del catálogo (p.ej. un id retirado): conservarlo.
      provider = config.provider;
      model = config.model;
    } else if (assistantInCatalog) {
      provider = assistantInCatalog.provider;
      model = assistantInCatalog.id;
    } else {
      provider = DEFAULT_MODEL.provider;
      model = DEFAULT_MODEL.id;
    }
    setForm({ provider, model });
    setEditing(true);
  };

  const handleModelPick = (option: AiModelOption) => {
    setForm((f) => ({ ...f, provider: option.provider, model: option.id }));
  };

  const handleSave = async () => {
    try {
      // La key viaja del almacén «Claves API» al servidor (cifrada). Vacía
      // (= proveedor con key solo en servidor) → conservar la guardada.
      const apiKey = getApiKey(KEY_STORE_PROVIDER[form.provider]);
      await saveMut.mutateAsync({
        provider: form.provider,
        model: form.model.trim(),
        apiKey: apiKey || undefined,
      });
      setEditing(false);
      addNotification({
        type: 'success',
        title: 'Modelo de captura guardado',
        message: 'La Captura de recetas usará este modelo.',
      });
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo guardar',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  };

  const selectedModel = VISION_MODELS.find((m) => m.id === form.model);
  const selectedProvider = selectedModel?.provider ?? form.provider;
  const selectedKeyReady = keyReady(selectedProvider);

  // Con config propia es la que manda; si no, se usa la del asistente.
  const usingFallback = !config?.isReady && Boolean(assistantConfig?.isReady);
  const effectiveName = config?.isReady
    ? aiModelName(config.model) || PROVIDER_LABELS[config.provider!]
    : assistantConfig?.model
      ? aiModelName(assistantConfig.model)
      : assistantConfig?.provider
        ? PROVIDER_LABELS[assistantConfig.provider]
        : '';

  return (
    <section className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--on-surface)]">
        <Camera className="h-5 w-5 text-[var(--primary)]" />
        Captura de recetas
      </h2>
      <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
        Modelo de IA que convierte las recetas externas (enlace, texto o
        foto/PDF). Solo se ofrecen modelos con visión, para poder leer fotos y
        PDF. Independiente del Asistente IA: si no eliges ninguno, la captura
        usa el del asistente.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-[var(--on-surface-variant)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
        </div>
      ) : !editing ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {config?.isReady ? (
            <p className="text-sm text-[var(--on-surface)]">
              {effectiveName}
              {' · '}
              {keyReady(config.provider!) ? (
                <span className="inline-flex items-center gap-1 font-medium text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> API key configurada
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" /> sin API key — añádela en «Claves API»
                </span>
              )}
            </p>
          ) : usingFallback ? (
            <p className="text-sm text-[var(--on-surface)]">
              Usando el modelo del Asistente IA: <strong>{effectiveName}</strong>.
              {' '}Puedes elegir uno propio para la captura.
            </p>
          ) : (
            <p className="text-sm italic text-[var(--on-surface-variant)]">
              Sin configurar: la captura usará el modelo del Asistente IA (aún sin
              configurar).
            </p>
          )}
          <button
            onClick={startEditing}
            className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
          >
            {config?.isReady ? 'Editar' : 'Configurar'}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {/* Solo modelos con visión: la captura puede leer fotos y PDF. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {VISION_MODELS.map((model) => {
              const isSelected = form.model === model.id;
              const usable = keyReady(model.provider);
              return (
                <button
                  key={model.id}
                  type="button"
                  disabled={!usable}
                  onClick={() => handleModelPick(model)}
                  className={`relative rounded-lg border p-2 text-left transition-colors ${
                    isSelected
                      ? 'border-[var(--primary)] bg-[var(--surface-container-low)] ring-1 ring-[var(--primary)]'
                      : 'border-[var(--outline-variant)] hover:border-[var(--primary)]'
                  } ${usable ? '' : 'cursor-not-allowed opacity-40 hover:border-[var(--outline-variant)]'}`}
                >
                  {isSelected && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary)] text-primary-foreground">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  )}
                  {usable && !isSelected && (
                    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />
                  )}
                  <div className="truncate text-xs font-medium text-[var(--on-surface)]">{model.name}</div>
                  <div className="text-[10px] text-[var(--on-surface-variant)]">{model.cost}/llamada</div>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-[var(--on-surface-variant)]">
            Solo modelos con visión (leen fotos y PDF). Los atenuados necesitan la
            API key de su proveedor en «Claves API».
          </p>

          <p className="text-xs text-[var(--on-surface-variant)]">
            {selectedModel
              ? `${selectedModel.name} — ${selectedModel.desc}.`
              : `Modelo personalizado: ${form.model}`}
          </p>
          {selectedKeyReady ? (
            <p className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              API key de {PROVIDER_LABELS[selectedProvider]} configurada
            </p>
          ) : (
            <p className="flex items-start gap-1 text-xs text-amber-600">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              Configura la clave de {PROVIDER_LABELS[selectedProvider]} en «Claves
              API», más abajo, para poder usar este modelo.
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saveMut.isPending || !selectedKeyReady}
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
