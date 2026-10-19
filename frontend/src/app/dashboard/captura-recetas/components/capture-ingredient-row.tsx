'use client';

import { X } from 'lucide-react';
import ProductCombobox from '@/app/dashboard/recipes/components/product-combobox';
import {
  CAPTURE_UNITS,
  type CaptureIngredientChanges,
  type RecipeCaptureIngredient,
} from '@/lib/recipe-capture-types';

/** Un ingrediente pasará como línea de la receta si el servidor no le ve ningún motivo para ir a notas. */
export function willBeRecipeLine(ingredient: RecipeCaptureIngredient): boolean {
  return ingredient.pendingReason === null;
}

/** Aviso de por qué irá a notas y qué hacer para que pase como línea. */
function pendingMessage(ingredient: RecipeCaptureIngredient): string | null {
  switch (ingredient.pendingReason) {
    case 'sin-articulo':
      return 'Sin artículo: irá a notas';
    case 'sin-cantidad':
      return 'Falta la cantidad: indícala o irá a notas';
    case 'unidad-incompatible':
      return `El artículo va por ${ingredient.matchedProduct?.referenceUnit ?? '?'}: cambia la unidad (p. ej. g o ml) o irá a notas`;
    default:
      return null;
  }
}

const FIELD =
  'rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2 py-1 text-base text-[var(--on-surface)] md:text-sm disabled:opacity-50';

interface CaptureIngredientRowProps {
  ingredient: RecipeCaptureIngredient;
  /** false en capturas ya pasadas: solo lectura. */
  editable: boolean;
  saving: boolean;
  onChange: (changes: CaptureIngredientChanges) => void;
}

/** Ingrediente capturado: línea original, artículo vinculado y cantidad/unidad corregibles. */
export function CaptureIngredientRow({ ingredient, editable, saving, onChange }: CaptureIngredientRowProps) {
  const product =
    ingredient.matchedProduct && !ingredient.matchedProduct.deletedAt ? ingredient.matchedProduct : null;
  const suggested = product && ingredient.matchConfidence !== null;
  const weakSuggestion = suggested && (ingredient.matchConfidence ?? 0) < 1;
  const pending = pendingMessage(ingredient);

  // Se guarda al salir del campo y solo si cambió: sin una petición por tecla.
  const commitQuantity = (input: HTMLInputElement) => {
    const text = input.value.trim();
    const value = text === '' ? null : Number(text.replace(',', '.'));
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      // No válida: se vuelve a mostrar la guardada en vez de dejar algo que no se guardó.
      input.value = ingredient.quantity?.toLocaleString('es-ES') ?? '';
      return;
    }
    if (value !== ingredient.quantity) onChange({ quantity: value });
  };

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
              onSelect={(selected) => onChange({ matchedProductId: selected.id })}
            />
            {product && (
              <button
                type="button"
                onClick={() => onChange({ matchedProductId: null })}
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
        <div className="flex flex-wrap items-center gap-2">
          {/* key: si el servidor cambia el valor, el campo se rehace con él. */}
          <input
            key={`q-${ingredient.quantity ?? ''}`}
            type="text"
            inputMode="decimal"
            defaultValue={ingredient.quantity?.toLocaleString('es-ES') ?? ''}
            onBlur={(e) => commitQuantity(e.currentTarget)}
            disabled={saving}
            placeholder="Cantidad"
            aria-label={`Cantidad de ${ingredient.name}`}
            className={`${FIELD} w-24`}
          />
          <select
            value={ingredient.unit ?? ''}
            onChange={(e) => onChange({ unit: e.target.value || null })}
            disabled={saving}
            aria-label={`Unidad de ${ingredient.name}`}
            className={FIELD}
          >
            <option value="">Unidad</option>
            {CAPTURE_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </div>
      )}

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
          {pending && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              {pending}
            </span>
          )}
        </div>
      )}
    </li>
  );
}
