import type { ServingMeasure } from './cuiner-types';

/**
 * Ayudas puras para elegir la medida de servicio de un plato de venta
 * directa. Las categorías de unidad replican las del backend
 * (product-costing.util UNIT_ALIASES): solo se ofrecen medidas que se
 * pueden pasar a la unidad de referencia del artículo.
 */

type UnitCategory = 'peso' | 'volumen' | 'unidad';

const UNIT_CATEGORY: Record<string, UnitCategory> = {
  kg: 'peso',
  kilo: 'peso',
  kilos: 'peso',
  kilogramo: 'peso',
  kilogramos: 'peso',
  g: 'peso',
  gr: 'peso',
  gramo: 'peso',
  gramos: 'peso',
  l: 'volumen',
  litro: 'volumen',
  litros: 'volumen',
  ml: 'volumen',
  cl: 'volumen',
  ud: 'unidad',
  und: 'unidad',
  u: 'unidad',
  unida: 'unidad',
  unidad: 'unidad',
  unidades: 'unidad',
  units: 'unidad',
};

export function unitCategory(unit: string | null | undefined): UnitCategory | null {
  return UNIT_CATEGORY[(unit ?? '').trim().toLowerCase()] ?? null;
}

/** Medidas que encajan con la unidad en que se cuenta el artículo. */
/**
 * Medidas que encajan con el artículo: las de su misma magnitud y, si se
 * cuenta en kilos o litros y tiene peso medio por pieza, también las de
 * unidades (una zamburiña = su peso medio). Igual que el servidor.
 */
export function measuresForProduct(
  measures: ServingMeasure[],
  referenceUnit: string,
  avgUnitWeight?: number | null,
): ServingMeasure[] {
  const ref = unitCategory(referenceUnit);
  if (!ref) return [];
  const byPieces = ref !== 'unidad' && (avgUnitWeight ?? 0) > 0;
  return measures.filter((m) => {
    const category = unitCategory(m.unit);
    return category === ref || (byPieces && category === 'unidad');
  });
}

/** ¿Hay medidas por unidades que este artículo no puede usar por no tener peso medio por pieza? */
export function needsAvgUnitWeight(
  measures: ServingMeasure[],
  referenceUnit: string,
  avgUnitWeight?: number | null,
): boolean {
  const ref = unitCategory(referenceUnit);
  return (
    !!ref &&
    ref !== 'unidad' &&
    !((avgUnitWeight ?? 0) > 0) &&
    measures.some((m) => unitCategory(m.unit) === 'unidad')
  );
}

/** Mayúsculas sin tildes (la Ñ se conserva: CAÑA ≠ CANA). */
function fold(text: string): string {
  return text
    .toUpperCase()
    .replace(/Ñ/g, '\u0000')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0000/g, 'Ñ');
}

/** ¿Aparece la palabra clave como palabra(s) completa(s) en el nombre? */
function containsWord(name: string, keyword: string): boolean {
  const words = ` ${fold(name)
    .replace(/[^A-ZÑ0-9]+/g, ' ')
    .trim()} `;
  const key = fold(keyword)
    .replace(/[^A-ZÑ0-9]+/g, ' ')
    .trim();
  return key.length > 0 && words.includes(` ${key} `);
}

const WINE_HINT =
  /\b(VINO|VINOS|CAVA|CHAMPAGNE|CHAMPAN|VERDEJO|RIOJA|RIBERA|ALBARIÑO|TINTO|BLANCO|ROSADO|CRIANZA|RESERVA|MOSCATEL|FINO|MANZANILLA|VERMUT|VERMOUTH)\b/;

/**
 * Medida que delata el nombre del plato del TPV: gana la palabra clave más
 * larga («CAÑA DOBLE» antes que «CAÑA»). Si varias medidas comparten la
 * palabra (COPA → licor o vino), decide si el artículo parece un vino.
 */
export function suggestMeasure(dishName: string, candidates: ServingMeasure[], productHint: string): ServingMeasure | null {
  let bestLength = 0;
  let best: ServingMeasure[] = [];
  for (const measure of candidates) {
    for (const keyword of measure.keywords) {
      if (!containsWord(dishName, keyword)) continue;
      const length = fold(keyword).length;
      if (length > bestLength) {
        bestLength = length;
        best = [measure];
      } else if (length === bestLength && !best.includes(measure)) {
        best.push(measure);
      }
    }
  }
  if (best.length <= 1) return best[0] ?? null;
  const isWine = WINE_HINT.test(fold(`${productHint} ${dishName}`));
  const byWine = best.find((m) => /VINO/.test(fold(m.name)) === isWine);
  return byWine ?? best[0];
}

/** «4 cl», «7 g», «1,5 l». */
export function formatMeasure(measure: Pick<ServingMeasure, 'quantity' | 'unit'>): string {
  return `${measure.quantity.toLocaleString('es-ES')} ${measure.unit}`;
}
