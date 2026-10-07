'use client';

import { FileClock, FileText, FileUp, Link2, Loader2, Trash2 } from 'lucide-react';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import { useDiscardRecipeCapture, useRecipeCaptures } from '@/hooks/use-recipe-captures';
import type { RecipeCaptureListItem } from '@/lib/recipe-capture-types';

const SOURCE_ICON = { URL: Link2, TEXTO: FileText, ARCHIVO: FileUp } as const;

/** Etiqueta y estilo del estado tal como lo ve el usuario. */
function statusChip(capture: RecipeCaptureListItem): { label: string; className: string; spinning?: boolean } {
  const neutral = 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]';
  switch (capture.status) {
    case 'PROCESANDO':
      return { label: 'Procesando...', className: neutral, spinning: true };
    case 'PASANDO':
      return { label: 'Pasando a Recetas...', className: neutral, spinning: true };
    case 'PENDIENTE':
      return {
        label: 'Lista para revisar',
        className: 'bg-[var(--secondary-container)] text-[var(--on-surface)]',
      };
    case 'ERROR':
      return { label: 'Error', className: 'bg-[var(--error-container)] text-[var(--on-error-container)]' };
    case 'PASADA':
      // Sin recipeId la receta creada se eliminó después.
      return { label: capture.recipeId ? 'Pasada a Recetas' : 'Receta eliminada', className: neutral };
  }
}

/** Nombre de la receta o, mientras no lo hay, de dónde viene. */
function captureTitle(capture: RecipeCaptureListItem): string {
  if (capture.name) return capture.name;
  if (capture.source === 'URL') return capture.sourceUrl ?? 'Enlace';
  if (capture.source === 'ARCHIVO') return capture.sourceFileName ?? 'Archivo';
  return 'Texto pegado';
}

/** Listado de capturas. Pulsar una abre su revisión (o su texto original si falló). */
export function RecipeCaptureList({ onOpen }: { onOpen: (id: string) => void }) {
  const { data: captures, isLoading, error } = useRecipeCaptures();
  const discardMut = useDiscardRecipeCapture();
  const confirm = useConfirm();
  const addNotification = useNotification();

  const handleDiscard = async (capture: RecipeCaptureListItem) => {
    const ok = await confirm({
      title: 'Descartar captura',
      description:
        capture.status === 'PASADA'
          ? `Se quitará "${captureTitle(capture)}" de esta lista. La receta ya creada en Recetas no se toca.`
          : `Se quitará "${captureTitle(capture)}" de esta lista.`,
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await discardMut.mutateAsync(capture.id);
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo descartar la captura',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  };

  return (
    <div className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--on-surface)]">
        <FileClock className="h-4 w-4" />
        Capturas
      </h2>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-[var(--on-surface-variant)]">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando...
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-[var(--error-container)] p-4 text-sm text-[var(--on-error-container)]">
          No se pudieron cargar las capturas: {error.message}
        </div>
      )}
      {!isLoading && !error && (captures ?? []).length === 0 && (
        <p className="py-4 text-center text-sm text-[var(--on-surface-variant)]">
          Todavía no has capturado ninguna receta.
        </p>
      )}

      <ul className="space-y-2">
        {(captures ?? []).map((capture) => {
          const chip = statusChip(capture);
          const SourceIcon = SOURCE_ICON[capture.source];
          // No hay nada que abrir mientras se procesa.
          const canOpen = capture.status !== 'PROCESANDO';
          return (
            <li
              key={capture.id}
              className="flex items-center gap-2 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] transition hover:bg-[var(--surface-container-high)]"
            >
              <button
                type="button"
                onClick={() => onOpen(capture.id)}
                disabled={!canOpen}
                className="flex min-w-0 flex-1 flex-col gap-2 px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <SourceIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--on-surface-variant)]" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--on-surface)]">{captureTitle(capture)}</p>
                    <p className="text-xs text-[var(--on-surface-variant)]">
                      {new Date(capture.createdAt).toLocaleString('es-ES', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </p>
                    {capture.status === 'ERROR' && capture.errorMessage && (
                      <p className="mt-1 text-xs text-[var(--error)]">{capture.errorMessage}</p>
                    )}
                  </div>
                </div>
                <span
                  className={`flex w-fit shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs ${chip.className}`}
                >
                  {chip.spinning && <Loader2 className="h-3 w-3 animate-spin" />}
                  {chip.label}
                </span>
              </button>
              {capture.status !== 'PASANDO' && (
                <button
                  type="button"
                  onClick={() => handleDiscard(capture)}
                  disabled={discardMut.isPending}
                  aria-label={`Descartar ${captureTitle(capture)}`}
                  className="mr-2 rounded-lg p-2 text-[var(--on-surface-variant)] transition hover:bg-[var(--error-container)] hover:text-[var(--on-error-container)] disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
