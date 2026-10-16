import type { Albaran, AlbaranLine } from '@/lib/api-albaran';

/** Margen de redondeo admitido, el mismo que usa el envío a Cuiner. */
const TOTAL_MISMATCH_TOLERANCE = 0.05;

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Total del albarán recalculado desde sus líneas, con la misma cuenta que el
 * envío a Cuiner (backend: cuiner-albaran-payload.ts): base de línea = neto
 * del papel si trae descuento, si no cantidad × precio; cuota por tipo de IVA
 * sobre la base ya redondeada. Las líneas rechazadas no cuentan.
 */
export function computeTotalFromLines(lines: AlbaranLine[]): number {
  const baseByVat = new Map<number, number>();
  for (const line of lines) {
    if (line.lineStatus === 'RECHAZADO') continue;
    const gross = round2(line.quantity * line.unitPrice);
    const net = line.totalPrice !== null ? round2(line.totalPrice) : null;
    const base = net !== null && net < gross ? net : gross;
    baseByVat.set(line.vatPercent, (baseByVat.get(line.vatPercent) ?? 0) + base);
  }
  let total = 0;
  for (const [vat, base] of baseByVat) {
    const roundedBase = round2(base);
    total += roundedBase + round2((roundedBase * vat) / 100);
  }
  return round2(total);
}

/**
 * Descuadre entre el total del papel y el que sale de las líneas. null si
 * cuadra o si no hay total del papel con el que comparar.
 */
export function getTotalMismatch(
  albaran: Pick<Albaran, 'total' | 'lines'>,
): { computed: number; paper: number } | null {
  const lines = albaran.lines ?? [];
  if (!(albaran.total > 0) || lines.length === 0) return null;
  const computed = computeTotalFromLines(lines);
  return Math.abs(computed - albaran.total) > TOTAL_MISMATCH_TOLERANCE
    ? { computed, paper: albaran.total }
    : null;
}

/**
 * Albarán leído por OCR en el que no apareció ningún total en el papel. En un
 * albarán de varias hojas el total suele ir en la última, así que es la señal
 * de que falta alguna hoja (y sin total no hay descuadre que avisar).
 * Los albaranes manuales no tienen ocrRawData y no aplican.
 */
export function isPaperTotalMissing(
  albaran: Pick<Albaran, 'ocrRawData' | 'lines'>,
): boolean {
  if (!albaran.ocrRawData || (albaran.lines ?? []).length === 0) return false;
  return !(Number(albaran.ocrRawData.total_amount) > 0);
}
