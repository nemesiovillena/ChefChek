/**
 * Cálculo de coste de artículos compartido entre recetas y fichas técnicas.
 * El precio rector del escandallo es el precio de referencia del artículo
 * (purchasePrice ÷ unitSize → €/kg, €/L o €/ud, igual que getReferencePrice
 * en el frontend), corregido por mermas con yieldFactor (fracción aprovechable).
 */

/**
 * Factor para pasar de la unidad usada en la receta (g, ml, ud…)
 * a la unidad de referencia del artículo (kg, L, ud).
 * Si la unidad no se reconoce se asume que ya está en unidad de referencia.
 */
export function getUnitToReferenceFactor(
  ingredientUnit: string,
  referenceUnit: string,
): number {
  const unit = (ingredientUnit || "").trim().toLowerCase();
  const ref = (referenceUnit || "").trim().toLowerCase();

  const conversionMap: { [key: string]: { [key: string]: number } } = {
    kg: { g: 0.001, gr: 0.001, kg: 1 },
    l: { ml: 0.001, cl: 0.01, l: 1 },
    ud: { ud: 1, u: 1, unidad: 1, unidades: 1 },
  };

  return conversionMap[ref]?.[unit] ?? 1;
}

/**
 * Costo del ingrediente por unidad usada en la receta (€/g, €/ml o €/ud).
 */
export function calculateProductCostPerUnit(
  product: {
    purchasePrice: number;
    unitSize: number;
    yieldFactor?: number | null;
    referenceUnit: string;
  },
  ingredientUnit: string,
): number {
  const unitSize = product.unitSize > 0 ? product.unitSize : 1;
  const yieldFactor =
    product.yieldFactor && product.yieldFactor > 0 ? product.yieldFactor : 1;
  const referencePrice = product.purchasePrice / unitSize / yieldFactor;

  return (
    referencePrice *
    getUnitToReferenceFactor(ingredientUnit, product.referenceUnit)
  );
}
