/**
 * Cálculo de coste de artículos compartido entre recetas y fichas técnicas.
 * El precio rector del escandallo es el precio de referencia del artículo
 * (purchasePrice ÷ unitSize → €/kg, €/L o €/ud, igual que getReferencePrice
 * en el frontend). La cantidad de la receta es el peso bruto (tal como se
 * compra/usa), así que NO se corrige por yieldFactor aquí: dividir por la
 * merma duplicaría su efecto, porque el peso bruto ya es la cantidad real
 * pagada. yieldFactor solo se usa para los campos informativos (Peso Neto,
 * Precio Real) en recipes.service.ts, nunca como base de coste.
 */

/**
 * Alias de unidades por categoría (peso/volumen/unidad), con su factor hacia
 * la unidad base de la categoría (kg, l, ud). La unidad de referencia del
 * artículo es texto libre (catálogo "Unidades de Medida" personalizable por
 * tenant: p.ej. symbol "kilo"/"litro"), así que la conversión no puede
 * depender de una única clave fija — debe reconocer alias equivalentes.
 */
const UNIT_ALIASES: { [alias: string]: { category: string; toBase: number } } =
  {
    kg: { category: "peso", toBase: 1 },
    kilo: { category: "peso", toBase: 1 },
    kilos: { category: "peso", toBase: 1 },
    kilogramo: { category: "peso", toBase: 1 },
    kilogramos: { category: "peso", toBase: 1 },
    g: { category: "peso", toBase: 0.001 },
    gr: { category: "peso", toBase: 0.001 },
    gramo: { category: "peso", toBase: 0.001 },
    gramos: { category: "peso", toBase: 0.001 },
    l: { category: "volumen", toBase: 1 },
    litro: { category: "volumen", toBase: 1 },
    litros: { category: "volumen", toBase: 1 },
    ml: { category: "volumen", toBase: 0.001 },
    cl: { category: "volumen", toBase: 0.01 },
    ud: { category: "unidad", toBase: 1 },
    und: { category: "unidad", toBase: 1 },
    u: { category: "unidad", toBase: 1 },
    unidad: { category: "unidad", toBase: 1 },
    unidades: { category: "unidad", toBase: 1 },
    units: { category: "unidad", toBase: 1 },
  };

/**
 * Factor para pasar de la unidad usada en la receta (g, ml, ud…)
 * a la unidad de referencia del artículo (kg, L, ud).
 * Si alguna de las dos unidades no se reconoce, o pertenecen a categorías
 * distintas (p.ej. peso vs volumen), se asume que ya está en unidad de
 * referencia (factor 1) — no hay forma segura de convertir entre categorías.
 */
export function getUnitToReferenceFactor(
  ingredientUnit: string,
  referenceUnit: string,
): number {
  const unit = UNIT_ALIASES[(ingredientUnit || "").trim().toLowerCase()];
  const ref = UNIT_ALIASES[(referenceUnit || "").trim().toLowerCase()];

  if (!unit || !ref || unit.category !== ref.category) {
    return 1;
  }

  return unit.toBase / ref.toBase;
}

/**
 * Costo del ingrediente por unidad usada en la receta (€/g, €/ml o €/ud).
 */
export function calculateProductCostPerUnit(
  product: {
    purchasePrice: number;
    unitSize: number;
    referenceUnit: string;
  },
  ingredientUnit: string,
): number {
  const unitSize = product.unitSize > 0 ? product.unitSize : 1;
  const referencePrice = product.purchasePrice / unitSize;

  return (
    referencePrice *
    getUnitToReferenceFactor(ingredientUnit, product.referenceUnit)
  );
}
