'use client';

import { X } from 'lucide-react';
import ProductCombobox from '@/app/dashboard/recipes/components/product-combobox';
import type { RecipeCaptureIngredient } from '@/lib/recipe-capture-types';

/**
 * Un ingrediente pasará como línea de la receta solo si tiene artículo vigente
 * y cantidad. (El servidor añade una comprobación más al pasar: que la unidad
 * sea compatible con la del artículo.)
 */
export function willBeRecipeLine(ingredient: RecipeCaptureIngredient): boolean {
  return (
    !!ingredient.matchedProduct &&
    !ingredient.matchedProduct.deletedAt &&
    !!ingredient.quantity &&
    !!ingredient.unit
  );
}

interface CaptureIngredientRowProps {
  ingredient: RecipeCaptureIngredient;
  /** false en capturas ya pasadas: solo lectura. */
  editable: boolean;
  saving: boolean;
  onChangeProduct: (productId: string | null) => void;
}

/** Ingrediente capturado: línea original, cantidad normalizada y artículo vinculado. */
export function CaptureIngredientRow({ ingredient, editable, saving, onChangeProduct }: CaptureIngredientRowProps) {
  const product =
    ingredient.matchedProduct && !ingredient.matchedProduct.deletedAt ? ingredient.matchedProduct : null;
  const suggested = product && ingredient.matchConfidence !== null;
  const weakSuggestion = suggested && (ingredient.matchConfidence ?? 0) < 1;
  const toNotes = !willBeRecipeLine(ingredient);

  return (
    <li className="space-y-2 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium text-[var(--on-surface)]">{ingredient.rawText}</p>
        <p className="text-xs text-[var(--on-surface-variant)]">
          {ingredient.quantity !== null && ingredient.unit
            ? `${ingredient.quantity.toLocaleString('es-ES')} ${ingredient.unit} · ${ingredient.name}`
            : `Sin cantidad · ${ingredient.name}`}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {editable ? (
          <>
            <ProductCombobox
              value={product?.id ?? ''}
              label={product?.name}
              placeholder="Vincular a un artículo..."
              onSelect={(selected) => onChangeProduct(selected.id)}
            />
            {product && (
              <button
                type="button"
                onClick={() => onChangeProduct(null)}
                disabled={saving}
                aria-label={`Quitar el artículo de ${ingredient.name}`}
                className="rounded-lg p-2 text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--on-surface-variant)]">{product ? product.name : 'Sin artículo'}</p>
        )}
      </div>

      {editable && (
        <div className="flex flex-wrap gap-2 text-xs">
          {suggested && (
            <span
              className={`rounded-full px-2 py-0.5 ${
                weakSuggestion
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                  : 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]'
              }`}
            >
              {weakSuggestion ? 'Sugerido: revisa que sea el artículo correcto' : 'Sugerido automáticamente'}
            </span>
          )}
          {toNotes && (
            <span className="rounded-full bg-[var(--surface-container-high)] px-2 py-0.5 text-[var(--on-surface-variant)]">
              {product ? 'Sin cantidad: irá a notas' : 'Sin artículo: irá a notas'}
            </span>
          )}
        </div>
      )}
    </li>
  );
}
