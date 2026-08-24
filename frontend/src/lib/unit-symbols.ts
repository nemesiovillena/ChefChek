/**
 * Distintas partes de la app guardan la unidad de referencia con variantes
 * no normalizadas (kilo, litro, ud, unida...) además de los símbolos cortos
 * canónicos (kg, L, und). Esto mapea cualquier variante conocida al símbolo
 * corto, para selects/etiquetas que solo manejan esas 3 opciones fijas.
 */
export function normalizeUnitSymbol(unit: string): 'kg' | 'L' | 'und' | null {
  const u = unit.toLowerCase();
  if (u === 'kg' || u === 'kilo' || u === 'kilogramo' || u === 'kilogramos') return 'kg';
  if (u === 'l' || u === 'litro' || u === 'litros') return 'L';
  if (u === 'und' || u === 'ud' || u === 'unida' || u === 'unidad' || u === 'unidades') return 'und';
  return null;
}
