'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useAiAssistantConfig } from '@/hooks/use-ai-assistant-config';
import { RecipeCaptureCreateForm } from './components/recipe-capture-create-form';
import { RecipeCaptureList } from './components/recipe-capture-list';
import { RecipeCaptureReview } from './components/recipe-capture-review';

/**
 * Captura de recetas: la IA convierte una receta externa (enlace, texto o
 * foto/PDF) a nuestro formato; se revisa aquí y se pasa a Recetas.
 */
export default function CapturaRecetasPage() {
  const { user } = useAuth();
  const { data: aiConfig, isLoading: aiConfigLoading } = useAiAssistantConfig();
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

      {aiConfigLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-[var(--on-surface-variant)]" />}

      {/* Proveedor, modelo y clave: con solo la clave la captura fallaría. */}
      {aiConfig && !aiConfig.isReady && (
        <div className="space-y-2 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
          <p className="text-sm text-[var(--on-surface)]">
            Para capturar recetas hace falta un proveedor de IA configurado (proveedor, modelo y API key).
          </p>
          <Link
            href="/dashboard/settings"
            className="flex w-fit items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
          >
            <Settings className="h-4 w-4" />
            Ir a Configuración → Asistente IA
          </Link>
        </div>
      )}

      {aiConfig?.isReady && <RecipeCaptureCreateForm />}

      <RecipeCaptureList onOpen={setSelectedId} />
    </div>
  );
}
