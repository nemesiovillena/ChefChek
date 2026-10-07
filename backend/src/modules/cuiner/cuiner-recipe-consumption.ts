import { getUnitToReferenceFactor } from "../../common/utils/product-costing.util";

/**
 * Consumo de stock que provoca vender platos: descompone recetas (con sus
 * sub-recetas) hasta artículos y lo expresa en FORMATOS DE COMPRA, la misma
 * unidad en la que el albarán suma stock (Stock.quantity += cantidad de la
 * línea). Función pura: el servicio carga los datos y escribe los movimientos.
 *
 * Reglas, espejo del escandallo (RecipesService.calculateSubRecipeCost):
 *  - Una venta = una ración → fracción de la receta = 1 / raciones.
 *  - Sub-receta en raciones/porciones → fracción = cantidad / raciones.
 *  - Sub-receta en kg/L/cl/g/ml/ud → cantidad en unidad de rendimiento
 *    (kg y L ×1000, cl ×10) / rendimiento total (raciones × peso ración).
 *  - Ingrediente → cantidad × factor a la unidad de referencia del artículo
 *    (getUnitToReferenceFactor) / unitSize = formatos de compra.
 */

export interface ConsumptionProduct {
  id: string;
  name: string;
  referenceUnit: string;
  unitSize: number;
  tracksInventory: boolean;
}

export interface ConsumptionRecipe {
  id: string;
  name: string;
  portions: number;
  portionSize: number;
  ingredients: { productId: string; quantity: number; unit: string }[];
  subRecipes: { subRecipeId: string; quantity: number; unit: string }[];
}

/** Profundidad máxima de anidamiento: corta ciclos y datos corruptos. */
const MAX_DEPTH = 6;

const PORTION_UNITS = new Set([
  "ración",
  "raciones",
  "racion",
  "porción",
  "porciones",
  "porcion",
]);
const TO_YIELD_UNIT: Record<string, number> = { kg: 1000, l: 1000, cl: 10 };

/** Fracción de la sub-receta completa que consume una línea de sub-receta. */
export function subRecipeFraction(
  quantity: number,
  unit: string,
  sub: Pick<ConsumptionRecipe, "portions" | "portionSize">,
): number {
  const normalized = (unit || "").trim().toLowerCase();
  if (PORTION_UNITS.has(normalized)) {
    return sub.portions > 0 ? quantity / sub.portions : quantity;
  }
  const totalYield = sub.portions * sub.portionSize;
  if (!(totalYield > 0)) {
    return 0;
  }
  return (quantity * (TO_YIELD_UNIT[normalized] ?? 1)) / totalYield;
}

/**
 * Formatos de compra de cada artículo que consume vender `servings` raciones
 * de la receta. Los artículos sin control de stock (tracksInventory=false) o
 * desconocidos se ignoran. Las sub-recetas inexistentes se anotan en `missing`.
 */
export function explodeRecipe(
  recipeId: string,
  servings: number,
  recipes: Map<string, ConsumptionRecipe>,
  products: Map<string, ConsumptionProduct>,
): { formats: Map<string, number>; missing: string[] } {
  const formats = new Map<string, number>();
  const missing: string[] = [];

  const walk = (id: string, fraction: number, depth: number) => {
    const recipe = recipes.get(id);
    if (!recipe) {
      missing.push(id);
      return;
    }
    if (depth > MAX_DEPTH) {
      missing.push(`${recipe.name} (anidamiento > ${MAX_DEPTH})`);
      return;
    }
    for (const ing of recipe.ingredients) {
      const product = products.get(ing.productId);
      if (!product || !product.tracksInventory) {
        continue;
      }
      const refQty =
        ing.quantity *
        fraction *
        getUnitToReferenceFactor(ing.unit, product.referenceUnit);
      const unitSize = product.unitSize > 0 ? product.unitSize : 1;
      formats.set(
        product.id,
        (formats.get(product.id) ?? 0) + refQty / unitSize,
      );
    }
    for (const sub of recipe.subRecipes) {
      const subRecipe = recipes.get(sub.subRecipeId);
      if (!subRecipe) {
        missing.push(sub.subRecipeId);
        continue;
      }
      walk(
        sub.subRecipeId,
        fraction * subRecipeFraction(sub.quantity, sub.unit, subRecipe),
        depth + 1,
      );
    }
  };

  const root = recipes.get(recipeId);
  const portions = root && root.portions > 0 ? root.portions : 1;
  walk(recipeId, servings / portions, 0);
  return { formats, missing };
}

/**
 * Formatos que consume vender `units` unidades de un artículo de venta
 * directa (p. ej. una botella): 1 unidad vendida = 1 ud de referencia.
 */
export function directProductFormats(
  units: number,
  product: ConsumptionProduct,
): number {
  const unitSize = product.unitSize > 0 ? product.unitSize : 1;
  return (
    (units * getUnitToReferenceFactor("ud", product.referenceUnit)) / unitSize
  );
}
