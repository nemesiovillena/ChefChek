import { getUnitMeta } from "../../common/utils/product-costing.util";

/**
 * Reparto de los ingredientes de una captura al pasarla a Recetas: cuáles
 * pueden ser una línea real de la receta y cuáles se quedan como texto en
 * notas para que el usuario los complete.
 */

export interface PromotableIngredient {
  rawText: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  matchedProduct: {
    id: string;
    referenceUnit: string;
    deletedAt: Date | null;
  } | null;
}

export interface RecipeLine {
  productId: string;
  quantity: number;
  unit: string;
  note?: string;
}

export interface PromotionSplit {
  lines: RecipeLine[];
  /** Una línea de texto por ingrediente que no pasa, con el motivo si lo hay. */
  pending: string[];
}

const MAX_NOTES_LENGTH = 5000;

export const PENDING_NOTES_HEADER =
  "Ingredientes pendientes de vincular (alérgenos incompletos):";

export function splitIngredientsForRecipe(
  ingredients: PromotableIngredient[],
): PromotionSplit {
  const lines: RecipeLine[] = [];
  const pending: string[] = [];

  for (const ingredient of ingredients) {
    const product = ingredient.matchedProduct;
    if (!product || product.deletedAt) {
      pending.push(ingredient.rawText);
      continue;
    }
    if (!ingredient.quantity || ingredient.quantity <= 0 || !ingredient.unit) {
      pending.push(`${ingredient.rawText} (sin cantidad)`);
      continue;
    }
    // El coste convierte entre unidades de la misma magnitud; si no coinciden
    // (ml contra un artículo en kg) usa factor 1 sin avisar y el coste sale
    // absurdo. Mejor dejarlo en notas que crear una línea con coste falso.
    const unit = getUnitMeta(ingredient.unit);
    const reference = getUnitMeta(product.referenceUnit);
    if (!unit || !reference || unit.category !== reference.category) {
      pending.push(
        `${ingredient.rawText} (unidad no compatible con el artículo)`,
      );
      continue;
    }
    lines.push({
      productId: product.id,
      quantity: ingredient.quantity,
      // El editor de recetas guarda las unidades sueltas como "units".
      unit: ingredient.unit === "ud" ? "units" : ingredient.unit,
      ...(ingredient.note ? { note: ingredient.note } : {}),
    });
  }

  return { lines, pending };
}

/** Texto de `Recipe.notes` con los ingredientes que no pasaron; null si pasaron todos. */
export function buildPendingNotes(pending: string[]): string | null {
  if (!pending.length) {
    return null;
  }
  const text = [
    PENDING_NOTES_HEADER,
    ...pending.map((line) => `- ${line}`),
  ].join("\n");
  // Recipe.notes admite 5000 caracteres: sin recorte, una captura con muchos
  // ingredientes largos no se podría pasar nunca.
  if (text.length <= MAX_NOTES_LENGTH) {
    return text;
  }
  const marker = "\n- (lista recortada: revisa la receta original)";
  return text.slice(0, MAX_NOTES_LENGTH - marker.length) + marker;
}
