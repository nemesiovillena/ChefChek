'use client';

import { TriangleAlert } from 'lucide-react';

/** Artículo que ha estado en el formulario, con los alérgenos que aporta. */
export interface KnownIngredientAllergens {
  name: string;
  allergens: number[];
}

interface RemovedAllergen {
  allergenId: number;
  productNames: string[];
}

/**
 * Alérgenos aún marcados que venían de un artículo ya quitado de la receta y
 * que ningún ingrediente actual aporta. No se desmarcan solos: pueden seguir
 * siendo ciertos (contaminación cruzada o una sub-receta), decide la persona.
 */
export function findRemovedIngredientAllergens(
  known: Map<string, KnownIngredientAllergens>,
  currentProductIds: string[],
  selectedAllergenIds: number[],
): RemovedAllergen[] {
  const current = new Set(currentProductIds);
  const stillProvided = new Set(
    currentProductIds.flatMap((id) => known.get(id)?.allergens ?? []),
  );
  const removedProducts = [...known.entries()]
    .filter(([id]) => !current.has(id))
    .map(([, product]) => product);

  return selectedAllergenIds
    .filter((id) => !stillProvided.has(id))
    .map((allergenId) => ({
      allergenId,
      productNames: removedProducts
        .filter((product) => product.allergens.includes(allergenId))
        .map((product) => product.name),
    }))
    .filter((item) => item.productNames.length > 0);
}

interface RecipeRemovedAllergensNoticeProps {
  items: RemovedAllergen[];
  allergenName: (id: number) => string;
  onUncheck: (id: number) => void;
}

export default function RecipeRemovedAllergensNotice({ items, allergenName, onUncheck }: RecipeRemovedAllergensNoticeProps) {
  if (items.length === 0) return null;

  return (
    <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <p className="flex items-center gap-2 font-medium">
        <TriangleAlert className="h-4 w-4 shrink-0" />
        Revisa los alérgenos
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map(({ allergenId, productNames }) => (
          <li key={allergenId} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Has quitado {productNames.join(', ')} ({allergenName(allergenId)}). ¿La receta aún lo lleva?
            </span>
            <button
              type="button"
              onClick={() => onUncheck(allergenId)}
              className="min-h-9 rounded-lg border border-amber-400 px-3 py-1 text-xs font-medium hover:bg-amber-100 dark:border-amber-600 dark:hover:bg-amber-900"
            >
              Ya no lo lleva
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
