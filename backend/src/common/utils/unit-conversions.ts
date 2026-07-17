/**
 * Standard unit conversion utilities for ChefChek.
 * Replaces the old hardcoded 3-tier conversion maps (UC→UA→UR)
 * with simple metric conversions to/from reference units (kg, L, und).
 */

/** Supported reference units */
export const REFERENCE_UNITS = ["kg", "L", "und"] as const;
export type ReferenceUnit = (typeof REFERENCE_UNITS)[number];

/**
 * Standard metric conversion factors.
 * Maps (fromUnit → toUnit) = factor.
 * To convert a quantity: result = quantity × factor
 */
const CONVERSION_MAP: Record<string, Record<string, number>> = {
  // Mass → kg
  g: { kg: 0.001, g: 1 },
  mg: { kg: 0.000001, g: 0.001, mg: 1 },
  kg: { kg: 1, g: 1000, mg: 1000000 },

  // Volume → L
  ml: { L: 0.001, ml: 1 },
  cl: { L: 0.01, ml: 10, cl: 1 },
  L: { L: 1, ml: 1000, cl: 100 },

  // Count → und
  und: { und: 1 },
  uds: { und: 1 },
  ud: { und: 1 },
  unidades: { und: 1 },
  unidad: { und: 1 },

  // Imperial (rare in Spanish kitchens, but included for completeness)
  lb: { kg: 0.453592 },
  oz: { kg: 0.0283495, g: 28.3495 },
  gal: { L: 3.78541 },
};

/**
 * Get conversion factor from one unit to another.
 * Returns the multiplier: result = quantity × factor
 * Returns 1 if no conversion found (same unit or unknown).
 */
export function standardConversion(fromUnit: string, toUnit: string): number {
  if (!fromUnit || !toUnit) {
    return 1;
  }
  const from = fromUnit.trim().toLowerCase();
  const to = toUnit.trim().toLowerCase();
  if (from === to) {
    return 1;
  }

  const map = CONVERSION_MAP[from];
  if (map && map[to] !== undefined) {
    return map[to];
  }

  // Fallback: try reverse (1/factor)
  const reverseMap = CONVERSION_MAP[to];
  if (reverseMap && reverseMap[from] !== undefined) {
    return 1 / reverseMap[from];
  }

  return 1;
}

/** Calculate reference price: price per reference unit */
export function getReferencePrice(
  purchasePrice: number,
  unitSize: number,
): number {
  if (!unitSize || unitSize === 0) {
    return purchasePrice;
  }
  return purchasePrice / unitSize;
}

/** Tolerancia relativa para considerar dos precios de referencia "iguales" al
 * comparar €/kg entre dos compras. Absorbe el ruido de redondeo que aparece al
 * dividir precio/cantidad introducidos con precisión limitada (p.ej. cantidad
 * redondeada a kg enteros) — sin esto, dos compras con el mismo precio real
 * por kg pueden diferir en la última cifra decimal y disparar una fila de
 * historial/badge falsos (la misma clase de bug que esta función corrige). */
const REFERENCE_PRICE_EPSILON = 0.005; // 0.5%

/** ¿Cambió de verdad el precio por unidad de referencia entre dos compras? */
export function referencePriceChanged(
  previousPrice: number,
  previousUnitSize: number,
  newPrice: number,
  newUnitSize: number,
): boolean {
  const prevRef = getReferencePrice(previousPrice, previousUnitSize);
  const newRef = getReferencePrice(newPrice, newUnitSize);
  if (prevRef === 0) {
    return newRef !== 0;
  }
  return (
    Math.abs(newRef - prevRef) / Math.abs(prevRef) > REFERENCE_PRICE_EPSILON
  );
}

/** Format reference price for display: "€5.00/kg" */
export function formatRefPrice(price: number, unit: string): string {
  return `€${price.toFixed(2)}/${unit}`;
}

/** Infer reference unit from a unit string (for migration/import) */
export function inferReferenceUnit(unit: string): ReferenceUnit {
  if (!unit) {
    return "und";
  }
  const u = unit.toLowerCase().trim();
  if (
    [
      "kg",
      "kilo",
      "kilogramo",
      "kilogramos",
      "g",
      "gramo",
      "gramos",
      "mg",
      "miligramo",
    ].includes(u)
  ) {
    return "kg";
  }
  if (
    [
      "l",
      "litro",
      "litros",
      "ml",
      "mililitro",
      "mililitros",
      "cl",
      "centilitro",
    ].includes(u)
  ) {
    return "L";
  }
  return "und";
}
