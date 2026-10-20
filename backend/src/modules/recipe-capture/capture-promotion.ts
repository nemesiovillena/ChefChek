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

/** Por qué un ingrediente no puede ser línea de la receta; null si puede. */
export type PendingReason =
  | "sin-articulo"
  | "sin-cantidad"
  | "unidad-incompatible";

/** Sufijo que acompaña al texto del ingrediente en las notas de la receta. */
const REASON_SUFFIX: Record<PendingReason, string> = {
  "sin-articulo": "",
  "sin-cantidad": " (sin cantidad)",
  "unidad-incompatible": " (unidad no compatible con el artículo)",
};

/**
 * Misma regla que aplica el paso a Recetas: la pantalla de revisión la usa
 * para avisar antes de pasar, así nunca dice "vinculado" de algo que acabará
 * en notas.
 */
export function getPendingReason(
  ingredient: Pick<
    PromotableIngredient,
    "quantity" | "unit" | "matchedProduct"
  >,
): PendingReason | null {
  const product = ingredient.matchedProduct;
  if (!product || product.deletedAt) {
    return "sin-articulo";
  }
  if (!ingredient.quantity || ingredient.quantity <= 0 || !ingredient.unit) {
    return "sin-cantidad";
  }
  // El coste convierte entre unidades de la misma magnitud; si no coinciden
  // (ml contra un artículo en kg) usa factor 1 sin avisar y el coste sale
  // absurdo. Mejor dejarlo en notas que crear una línea con coste falso.
  const unit = getUnitMeta(ingredient.unit);
  const reference = getUnitMeta(product.referenceUnit);
  if (!unit || !reference || unit.category !== reference.category) {
    return "unidad-incompatible";
  }
  return null;
}

export function splitIngredientsForRecipe(
  ingredients: PromotableIngredient[],
): PromotionSplit {
  const lines: RecipeLine[] = [];
  const pending: string[] = [];

  for (const ingredient of ingredients) {
    const reason = getPendingReason(ingredient);
    if (reason) {
      pending.push(`${ingredient.rawText}${REASON_SUFFIX[reason]}`);
      continue;
    }
    lines.push({
      productId: ingredient.matchedProduct!.id,
      quantity: ingredient.quantity!,
      // El editor de recetas guarda las unidades sueltas como "units".
      unit: ingredient.unit === "ud" ? "units" : ingredient.unit!,
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

/** Gramos por unidad de peso/volumen (densidad 1), igual que el estimado del formulario de Recetas. */
const GRAMS_PER_UNIT: Record<string, number> = {
  kg: 1000,
  g: 1,
  l: 1000,
  ml: 1,
  cl: 10,
};

/**
 * Peso total elaborado (g) estimado sumando las líneas con unidad de peso o
 * volumen; las de "units" no tienen peso conocido y no cuentan. Sin él la
 * receta nacía con 1 g por ración y su precio €/kg salía cientos de veces
 * mayor. null si ninguna línea aporta peso.
 */
export function estimateYieldWeightGrams(lines: RecipeLine[]): number | null {
  const grams = lines.reduce((total, line) => {
    const factor = GRAMS_PER_UNIT[line.unit.trim().toLowerCase()];
    return factor ? total + line.quantity * factor : total;
  }, 0);
  return grams > 0 ? Math.round(grams * 100) / 100 : null;
}
