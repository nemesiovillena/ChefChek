import {
  calculateProductCostPerUnit,
  calculateSubRecipeCost,
} from "../../common/utils/product-costing.util";

/** Lo que hace falta de un artículo para costearlo (precio actual). */
export interface LiveCostProduct {
  purchasePrice: number;
  unitSize: number;
  referenceUnit: string;
  discountPercentage: number | null;
  wastePercentage: number | null;
}

/** Receta con sus líneas y el coste guardado, que solo es el último recurso. */
export interface LiveCostRecipe {
  portions: number;
  portionSize: number;
  storedTotalCost: number;
  storedTotalCostPerUnit: number;
  ingredients: { productId: string; quantity: number; unit: string }[];
  subRecipes: { subRecipeId: string; quantity: number; unit: string }[];
}

/** Coste de una receta con la forma que piden las recetas padre. */
export interface LiveCost {
  totalCost: number;
  totalCostPerUnit: number;
  portions: number;
}

/**
 * Coste por unidad de rendimiento (€/g, €/ml o €/ud producido): lo que usan
 * las recetas padre para costear esta receta como sub-receta.
 */
export function costPerYieldUnit(
  totalCost: number,
  portions: number,
  portionSize: number,
): number {
  const totalYield = (portions || 1) * (portionSize || 0);
  if (totalYield > 0) {
    return totalCost / totalYield;
  }
  return portions > 0 ? totalCost / portions : totalCost;
}

/**
 * Coste actual de cada receta con los precios de hoy de sus artículos,
 * bajando por las sub-recetas (también con precios de hoy), en vez de fiarse
 * del totalCost guardado, que solo se escribe al guardar la receta y se queda
 * viejo cuando cambian los precios de compra.
 *
 * Solo se usa el coste guardado de una receta cuando no se puede calcular:
 * un artículo o sub-receta que ya no existe, o un ciclo de sub-recetas.
 */
export function computeLiveCosts(
  recipes: Map<string, LiveCostRecipe>,
  products: Map<string, LiveCostProduct>,
): Map<string, LiveCost> {
  const result = new Map<string, LiveCost>();
  const visiting = new Set<string>();

  const stored = (r: LiveCostRecipe): LiveCost => ({
    totalCost: r.storedTotalCost,
    totalCostPerUnit: r.storedTotalCostPerUnit,
    portions: r.portions,
  });

  const costOf = (id: string): LiveCost | null => {
    const done = result.get(id);
    if (done) {
      return done;
    }
    const recipe = recipes.get(id);
    if (!recipe) {
      return null;
    }
    if (visiting.has(id)) {
      return stored(recipe);
    }
    visiting.add(id);
    let total = 0;
    let known = true;
    for (const ing of recipe.ingredients) {
      const product = products.get(ing.productId);
      if (!product) {
        known = false;
        break;
      }
      total += ing.quantity * calculateProductCostPerUnit(product, ing.unit);
    }
    if (known) {
      for (const sub of recipe.subRecipes) {
        const subCost = costOf(sub.subRecipeId);
        if (!subCost) {
          known = false;
          break;
        }
        total += calculateSubRecipeCost(sub.quantity, sub.unit, subCost);
      }
    }
    visiting.delete(id);
    const cost = known
      ? {
          totalCost: total,
          totalCostPerUnit: costPerYieldUnit(
            total,
            recipe.portions,
            recipe.portionSize,
          ),
          portions: recipe.portions,
        }
      : stored(recipe);
    result.set(id, cost);
    return cost;
  };

  for (const id of recipes.keys()) {
    costOf(id);
  }
  return result;
}
