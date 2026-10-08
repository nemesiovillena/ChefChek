'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, Copy, ExternalLink, Loader2, RotateCcw } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useSectionAccess } from '@/features/modules/hooks/use-section-access';
import {
  usePromoteRecipeCapture,
  useRecipeCapture,
  useRetryRecipeCapture,
  useUpdateCaptureIngredient,
} from '@/hooks/use-recipe-captures';
import { parseSteps } from '@/app/dashboard/recipes/components/elaboration-step-editor';
import { CaptureIngredientRow, willBeRecipeLine } from './capture-ingredient-row';

const SECTION_TITLE = 'text-sm font-semibold text-[var(--on-surface)]';

/**
 * Revisión de una captura: muestra la receta que entendió la IA y deja
 * vincular cada ingrediente a un artículo antes de pasarla a Recetas. El
 * contenido (nombre, pasos, cantidades) se corrige después, ya en Recetas.
 */
export function RecipeCaptureReview({ captureId, onClose }: { captureId: string; onClose: () => void }) {
  const router = useRouter();
  const { data: capture, isLoading, error } = useRecipeCapture(captureId);
  const updateIngredient = useUpdateCaptureIngredient();
  const promote = usePromoteRecipeCapture();
  const retry = useRetryRecipeCapture();
  const addNotification = useNotification();
  const { canSee } = useSectionAccess();
  // Pasar una captura crea una receta: mismo permiso que crearla a mano.
  const canPromote = canSee('recipes') && canSee('recipes.edit');

  const back = (
    <button
      type="button"
      onClick={onClose}
      className="flex items-center gap-1 text-sm text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
    >
      <ArrowLeft className="h-4 w-4" />
      Volver a las capturas
    </button>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {back}
        <Loader2 className="mx-auto my-12 h-6 w-6 animate-spin text-[var(--on-surface-variant)]" />
      </div>
    );
  }
  if (error || !capture) {
    return (
      <div className="space-y-4">
        {back}
        <div className="rounded-xl bg-[var(--error-container)] p-4 text-sm text-[var(--on-error-container)]">
          No se pudo cargar la captura{error ? `: ${error.message}` : ''}
        </div>
      </div>
    );
  }

  const handleChangeProduct = async (ingredientId: string, matchedProductId: string | null) => {
    try {
      await updateIngredient.mutateAsync({ captureId, ingredientId, matchedProductId });
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo cambiar el artículo',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  };

  const handlePromote = async () => {
    try {
      const result = await promote.mutateAsync(captureId);
      // Nunca navegar sin un id real: acabaría en /recipes?recipe=null.
      if (!result.recipeId) return;
      addNotification(
        result.toNotes
          ? {
              type: 'warning',
              title: 'Receta creada como inactiva',
              message: `${result.lines ?? 0} ingrediente(s) pasaron como líneas y ${result.toNotes} quedaron pendientes. Complétalos y activa la receta.`,
            }
          : {
              type: 'success',
              title: 'Receta creada',
              message: 'Todos los ingredientes pasaron como líneas.',
            },
      );
      router.push(`/dashboard/recipes?recipe=${encodeURIComponent(result.recipeId)}&edit=1`);
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo pasar a Recetas',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  };

  const handleRetry = async () => {
    try {
      await retry.mutateAsync(captureId);
      addNotification({
        type: 'success',
        title: 'Reintentando',
        message: 'La IA está leyendo la receta otra vez.',
      });
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo reintentar',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  };

  const editable = capture.status === 'PENDIENTE';
  const steps = parseSteps(capture.elaboration).filter((step) => step.description.trim());
  const lines = capture.ingredients.filter(willBeRecipeLine).length;
  const toNotes = capture.ingredients.length - lines;
  const facts = [
    capture.portions ? `${capture.portions.toLocaleString('es-ES')} raciones` : null,
    capture.preparationTimeMinutes ? `Preparación ${capture.preparationTimeMinutes} min` : null,
    capture.cookingTimeMinutes ? `Cocción ${capture.cookingTimeMinutes} min` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      {back}

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-[var(--on-surface)]">{capture.name ?? 'Captura sin procesar'}</h1>
        {facts.length > 0 && <p className="text-sm text-[var(--on-surface-variant)]">{facts.join(' · ')}</p>}
        {capture.description && (
          <p className="whitespace-pre-line text-sm text-[var(--on-surface-variant)]">{capture.description}</p>
        )}
        {capture.sourceUrl && (
          <a
            href={capture.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-fit items-center gap-1 text-sm text-[var(--primary)] hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            Ver la receta original
          </a>
        )}
      </div>

      {capture.imageUrl && (
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[var(--outline-variant)]">
          <Image
            src={capture.imageUrl}
            alt={capture.name ?? 'Foto del plato'}
            fill
            sizes="(min-width: 768px) 768px, 100vw"
            className="object-cover"
          />
        </div>
      )}

      {capture.status === 'ERROR' && (
        <div className="space-y-3 rounded-xl bg-[var(--error-container)] p-4 text-sm text-[var(--on-error-container)]">
          <p>{capture.errorMessage ?? 'No se pudo procesar la receta.'}</p>
          {capture.canRetry ? (
            <button
              type="button"
              onClick={handleRetry}
              disabled={retry.isPending}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 font-medium underline-offset-2 hover:underline disabled:opacity-50"
            >
              {retry.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {retry.isPending ? 'Reintentando...' : 'Reintentar'}
            </button>
          ) : (
            <p>Vuelve a la lista y captúrala de nuevo.</p>
          )}
        </div>
      )}

      {/* El texto pegado no se pierde si la captura falla: se puede recuperar. */}
      {capture.status === 'ERROR' && capture.sourceText && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className={SECTION_TITLE}>Texto que pegaste</h2>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(capture.sourceText ?? '');
                addNotification({ type: 'success', title: 'Texto copiado', message: 'Ya puedes pegarlo de nuevo.' });
              }}
              className="flex items-center gap-1 rounded-lg border border-[var(--outline-variant)] px-3 py-1 text-xs text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </button>
          </div>
          <p className="max-h-64 overflow-y-auto whitespace-pre-line rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3 text-sm text-[var(--on-surface)]">
            {capture.sourceText}
          </p>
        </div>
      )}

      {capture.status === 'PASANDO' && (
        <div className="space-y-3 rounded-xl bg-[var(--surface-container-high)] p-4 text-sm text-[var(--on-surface)]">
          <p className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Pasando a Recetas...
          </p>
          {/* Si el paso se interrumpió (reinicio del servidor), repetirlo lo
              retoma sin duplicar la receta; si sigue en curso el servidor lo dice. */}
          {canPromote && (
            <button
              type="button"
              onClick={handlePromote}
              disabled={promote.isPending}
              className="text-xs text-[var(--primary)] hover:underline disabled:opacity-50"
            >
              ¿Lleva mucho así? Reintentar
            </button>
          )}
        </div>
      )}

      {capture.ingredients.length > 0 && (
        <div className="space-y-2">
          <h2 className={SECTION_TITLE}>Ingredientes ({capture.ingredients.length})</h2>
          {editable && (
            <p className="text-xs text-[var(--on-surface-variant)]">
              Vincula cada ingrediente a uno de tus artículos. Los vinculados pasarán a la receta con su coste y sus
              alérgenos; el resto quedará anotado para que lo añadas después.
            </p>
          )}
          <ul className="space-y-2">
            {capture.ingredients.map((ingredient) => (
              <CaptureIngredientRow
                key={ingredient.id}
                ingredient={ingredient}
                editable={editable}
                saving={updateIngredient.isPending}
                onChangeProduct={(productId) => handleChangeProduct(ingredient.id, productId)}
              />
            ))}
          </ul>
        </div>
      )}

      {steps.length > 0 && (
        <div className="space-y-2">
          <h2 className={SECTION_TITLE}>Elaboración</h2>
          <ol className="space-y-2">
            {steps.map((step, index) => (
              <li
                key={index}
                className="flex gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3"
              >
                <span className="text-sm font-semibold text-[var(--on-surface-variant)]">{index + 1}</span>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm text-[var(--on-surface)]">{step.description}</p>
                  {(step.equipment || step.time || step.temperature) && (
                    <p className="text-xs text-[var(--on-surface-variant)]">
                      {[step.equipment, step.time, step.temperature].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {editable && (
        <div className="space-y-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
          <p className="text-sm text-[var(--on-surface)]">
            {lines} ingrediente(s) pasarán como líneas de la receta
            {toNotes > 0 ? ` y ${toNotes} quedarán anotados como pendientes.` : '.'}
          </p>
          {toNotes > 0 && (
            <p className="text-xs text-[var(--on-surface-variant)]">
              Con ingredientes pendientes la receta se crea inactiva: sus alérgenos y su coste están incompletos hasta
              que los añadas. Mientras esté inactiva solo la ven administradores y propietarios.
            </p>
          )}
          {canPromote ? (
            <button
              type="button"
              onClick={handlePromote}
              disabled={promote.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {promote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {promote.isPending ? 'Pasando a Recetas...' : 'Pasar a Recetas'}
            </button>
          ) : (
            <p className="text-xs text-[var(--on-surface-variant)]">
              No tienes permiso para crear recetas. Pide a un administrador que la pase a Recetas.
            </p>
          )}
        </div>
      )}

      {capture.status === 'PASADA' &&
        (capture.recipeId ? (
          <button
            type="button"
            onClick={() => router.push(`/dashboard/recipes?recipe=${encodeURIComponent(capture.recipeId ?? '')}`)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]"
          >
            Abrir la receta
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <p className="rounded-xl bg-[var(--surface-container-high)] p-4 text-sm text-[var(--on-surface-variant)]">
            La receta creada a partir de esta captura se eliminó.
          </p>
        ))}
    </div>
  );
}
