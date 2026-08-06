/**
 * Conversión de unidades métricas independiente de
 * `EscandallosService.performUnitConversion` — esa tabla solo reconoce
 * abreviaturas (kg/g/l/ml) y falla con los nombres completos en español
 * ("kilo", "litro") que algunos tenants usan como símbolo de `UnitOfMeasure`.
 * Aquí se normalizan ambos vocabularios antes de convertir.
 */
const MASS_GRAMS: Record<string, number> = {
  mg: 0.001,
  g: 1,
  gramo: 1,
  gramos: 1,
  kg: 1000,
  kilo: 1000,
  kilogramo: 1000,
  kilogramos: 1000,
};

const VOLUME_ML: Record<string, number> = {
  ml: 1,
  mililitro: 1,
  mililitros: 1,
  cl: 10,
  dl: 100,
  l: 1000,
  litro: 1000,
  litros: 1000,
};

const COUNT_UNITS: Record<string, number> = {
  ud: 1,
  und: 1,
  u: 1,
  unidad: 1,
  unidades: 1,
};

const FAMILIES = [MASS_GRAMS, VOLUME_ML, COUNT_UNITS];

function normalize(unit: string): string {
  return unit.trim().toLowerCase();
}

/**
 * Convierte `quantity` de `fromUnit` a `toUnit`. Devuelve `null` si las
 * unidades no pertenecen a la misma familia (masa/volumen/conteo) o no se
 * reconoce alguna — el llamador decide qué hacer ante la imposibilidad de
 * convertir (no asumir 1:1 silenciosamente).
 */
export function convertQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string,
): number | null {
  const from = normalize(fromUnit);
  const to = normalize(toUnit);

  if (from === to) {
    return quantity;
  }

  for (const family of FAMILIES) {
    if (from in family && to in family) {
      return (quantity * family[from]) / family[to];
    }
  }

  return null;
}
