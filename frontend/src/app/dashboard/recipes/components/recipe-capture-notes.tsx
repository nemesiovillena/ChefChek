'use client';

import { ExternalLink, TriangleAlert } from 'lucide-react';

interface RecipeCaptureNotesProps {
  /** `Recipe.notes`: en recetas capturadas, los ingredientes sin vincular. */
  notes: string;
  sourceUrl?: string | null;
  /** Sin `onChange` el bloque es de solo lectura (vista de la receta). */
  onChange?: (notes: string) => void;
}

/**
 * Lo que una receta trae de su captura: los ingredientes que no se pudieron
 * pasar como líneas (y que por tanto faltan en el coste y en los alérgenos) y
 * el enlace a la página de origen. Solo se muestra si hay algo que enseñar.
 */
export default function RecipeCaptureNotes({ notes, sourceUrl, onChange }: RecipeCaptureNotesProps) {
  if (!notes.trim() && !sourceUrl && !onChange) return null;

  return (
    <div className="space-y-2">
      {(notes.trim() || onChange) && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            Pendiente de completar
          </p>
          {onChange ? (
            <>
              <textarea
                aria-label="Ingredientes pendientes de la captura"
                value={notes}
                onChange={(e) => onChange(e.target.value)}
                rows={Math.min(8, Math.max(3, notes.split('\n').length))}
                maxLength={5000}
                className="mt-2 block w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-base text-zinc-900 dark:border-amber-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
                Estos ingredientes no cuentan todavía para el coste ni para los alérgenos. Añádelos como ingredientes y
                bórralos de aquí; con el cuadro vacío el aviso desaparece.
              </p>
            </>
          ) : (
            <p className="mt-2 whitespace-pre-line text-sm text-amber-900 dark:text-amber-100">{notes}</p>
          )}
        </div>
      )}
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-1 text-sm text-[var(--primary)] hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          Ver la receta original
        </a>
      )}
    </div>
  );
}
