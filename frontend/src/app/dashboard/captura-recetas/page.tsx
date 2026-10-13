'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useAiAssistantConfig } from '@/hooks/use-ai-assistant-config';
import { useRecipeCaptureConfig } from '@/hooks/use-recipe-capture-config';
import { aiModelName } from '@/lib/ai-models';
import { RecipeCaptureCreateForm } from './components/recipe-capture-create-form';
import { RecipeCaptureList } from './components/recipe-capture-list';
import { RecipeCaptureReview } from './components/recipe-capture-review';

const SETTINGS_ANCHOR = '/dashboard/settings#captura-recetas-ia';

/**
 * Captura de recetas: la IA convierte una receta externa (enlace, texto o
 * foto/PDF) a nuestro formato; se revisa aquí y se pasa a Recetas.
 */
export default function CapturaRecetasPage() {
  const { user } = useAuth();
  // Modelo propio de la captura; si no hay, se usa el del Asistente IA.
  const { data: captureConfig, isLoading: captureConfigLoading } =
    useRecipeCaptureConfig();
  const { data: assistantConfig, isLoading: assistantConfigLoading } =
    useAiAssistantConfig();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loading = captureConfigLoading || assistantConfigLoading;
  const ready = Boolean(captureConfig?.isReady || assistantConfig?.isReady);
  // Nombre del modelo que se usará de verdad (el propio o, si no, el del asistente).
  const effectiveConfig = captureConfig?.isReady ? captureConfig : assistantConfig;
  const effectiveModel = effectiveConfig?.model
    ? aiModelName(effectiveConfig.model)
    : effectiveConfig?.provider ?? '';

  // Las capturas son siempre de un cliente: un superadmin no pertenece a ninguno.
  if (user && !user.tenantId) {
    return (
      <p className="p-6 text-sm text-[var(--on-surface-variant)]">
        La captura de recetas se usa desde la cuenta de un cliente. Entra con un usuario de ese cliente.
      </p>
    );
  }

  if (selectedId) {
    return (
      <div className="container mx-auto max-w-4xl p-4 md:p-6">
        <RecipeCaptureReview captureId={selectedId} onClose={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      {/* <div>, no <header>: globals.css oculta header:not(.fixed). */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--on-surface)]">Captura de recetas</h1>
        <p className="text-sm text-[var(--on-surface-variant)]">
          Trae una receta de una web, un texto o una foto. La IA la convierte a nuestro formato; la revisas y la pasas
          a Recetas.
        </p>
      </div>

      {loading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-[var(--on-surface-variant)]" />}

      {/* Con solo la clave la captura fallaría: hacen falta proveedor y modelo. */}
      {!loading && !ready && (
        <div className="space-y-2 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
          <p className="text-sm text-[var(--on-surface)]">
            Para capturar recetas hace falta un modelo de IA configurado (proveedor, modelo y API key).
          </p>
          <Link
            href={SETTINGS_ANCHOR}
            className="flex w-fit items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
          >
            <Settings className="h-4 w-4" />
            Ir a Configuración → Captura de recetas
          </Link>
        </div>
      )}

      {/* Deja claro con qué modelo se está capturando (duda recurrente). */}
      {!loading && ready && effectiveModel && (
        <p className="flex flex-wrap items-center gap-1 text-xs text-[var(--on-surface-variant)]">
          Modelo de IA: <strong className="text-[var(--on-surface)]">{effectiveModel}</strong>
          {' · '}
          <Link href={SETTINGS_ANCHOR} className="text-[var(--primary)] hover:underline">
            cambiar
          </Link>
        </p>
      )}

      {ready && <RecipeCaptureCreateForm />}

      <RecipeCaptureList onOpen={setSelectedId} />
    </div>
  );
}
