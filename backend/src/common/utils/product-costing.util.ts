/**
 * Cálculo de coste de artículos compartido entre recetas y fichas técnicas.
 * El precio rector del escandallo es el precio de referencia del artículo
 * (purchasePrice ÷ unitSize → €/kg, €/L o €/ud, igual que getReferencePrice
 * en el frontend). La cantidad de la receta es el PESO NETO (lo que va al
 * plato, ya limpio), así que el coste se corrige por la merma del artículo:
 * para tener 400 g limpios con un 15 % de merma hay que comprar 400 ÷ 0,85.
 * Una sola merma por artículo (Product.wastePercentage).
 */

/**
 * Fracción aprovechable del artículo (1 − merma). Merma fuera de (0, 100)
 * se trata como sin merma para no dividir por 0 ni dar costes negativos.
 */
export function wasteYieldFactor(
  wastePercentage: number | null | undefined,
): number {
  const waste = Number(wastePercentage ?? 0);
  return waste > 0 && waste < 100 ? (100 - waste) / 100 : 1;
}

/**
 * Alias de unidades por categoría (peso/volumen/unidad), con su factor hacia
 * la unidad base de la categoría (kg, l, ud). La unidad de referencia del
 * artículo es texto libre (catálogo "Unidades de Medida" personalizable por
 * tenant: p.ej. symbol "kilo"/"litro"), así que la conversión no puede
 * depender de una única clave fija — debe reconocer alias equivalentes.
 */
type UnitCategory = "peso" | "volumen" | "unidad";

const UNIT_ALIASES: {
  [alias: string]: { category: UnitCategory; toBase: number };
} = {
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
  unida: { category: "unidad", toBase: 1 },
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
 * Precio neto legado del artículo: compra − merma, más margen. Compartido
 * por artículos y recetas (la receta puede fijar la merma del artículo).
 */
export function calculateNetPrice(
  purchasePrice: number,
  wastePercentage: number,
  profitMargin: number,
): number {
  const priceAfterWaste =
    purchasePrice - (purchasePrice * wastePercentage) / 100;
  const netPrice = priceAfterWaste * (1 + profitMargin / 100);
  return Math.round(netPrice * 100) / 100;
}

/**
 * Metadatos de una unidad (categoría de magnitud y factor hacia la base de
 * su categoría: kg / l / ud). null si no se reconoce ("Caja 6und", texto
 * libre del formato de compra…). Fuente única: UNIT_ALIASES.
 */
export function getUnitMeta(
  unit: string | null | undefined,
): { category: "peso" | "volumen" | "unidad"; toBase: number } | null {
  return UNIT_ALIASES[(unit || "").trim().toLowerCase()] ?? null;
}

/**
 * Símbolo de unidad para mostrar al usuario. El formulario de recetas
 * guarda "units" para unidades sueltas; el resto de la app usa "ud".
 */
export function formatUnitSymbol(unit: string): string {
  return unit.trim().toLowerCase() === "units" ? "ud" : unit;
}

/**
 * Costo del ingrediente por unidad NETA usada en la receta (€/g, €/ml o €/ud):
 * precio de referencia ÷ (1 − merma), porque la cantidad es peso limpio.
 *
 * El descuento fijo del proveedor (`discountPercentage`) se aplica sobre el
 * precio de referencia bruto: el coste efectivo es el bruto × (1 − dto/100).
 * Si `applyDiscountToCost` (albarán) ya ha horneado el neto en `purchasePrice`,
 * `discountPercentage` debe ser 0 para no descontar dos veces — el mutex UI lo
 * garantiza a nivel de uso.
 */
export function calculateProductCostPerUnit(
  product: {
    purchasePrice: number;
    unitSize: number;
    referenceUnit: string;
    discountPercentage?: number | null;
    wastePercentage?: number | null;
  },
  ingredientUnit: string,
): number {
  const unitSize = product.unitSize > 0 ? product.unitSize : 1;
  const discountFactor = 1 - Number(product.discountPercentage ?? 0) / 100;
  const referencePrice = (product.purchasePrice / unitSize) * discountFactor;

  return (
    (referencePrice / wasteYieldFactor(product.wastePercentage)) *
    getUnitToReferenceFactor(ingredientUnit, product.referenceUnit)
  );
}

/**
 * Costo de usar una sub-receta según la unidad de la cantidad:
 * - raciones/porciones → cantidad × costo por ración de la sub-receta
 * - kg/L → convertidos a unidad de rendimiento (g/ml) antes de multiplicar
 * - g/ml/ud (u otra unidad) → cantidad × costo por unidad de rendimiento
 *
 * Compartido entre recetas (escandallo) y fichas técnicas para que el coste
 * de una subreceta sea el mismo en ambos sitios.
 */
export function calculateSubRecipeCost(
  quantity: number,
  unit: string,
  subRecipeData: {
    totalCost: number;
    totalCostPerUnit: number;
    portions: number;
  },
): number {
  const normalized = (unit || "").trim().toLowerCase();

  if (
    [
      "ración",
      "raciones",
      "racion",
      "porción",
      "porciones",
      "porcion",
    ].includes(normalized)
  ) {
    const costPerPortion =
      subRecipeData.portions > 0
        ? subRecipeData.totalCost / subRecipeData.portions
        : subRecipeData.totalCost;
    return quantity * costPerPortion;
  }

  const toYieldUnitFactor: { [key: string]: number } = {
    kg: 1000,
    l: 1000,
    cl: 10,
  };
  const factor = toYieldUnitFactor[normalized] ?? 1;
  return quantity * factor * subRecipeData.totalCostPerUnit;
}
