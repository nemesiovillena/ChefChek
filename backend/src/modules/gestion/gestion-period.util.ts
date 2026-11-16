import { BadRequestException } from "@nestjs/common";

/** Rango de días de caja, ambos incluidos, en formato AAAA-MM-DD. */
export interface DateRange {
  from: string;
  to: string;
}

export type CompareMode = "previous" | "year";
export type Bucket = "day" | "week" | "month";

const DAY_MS = 86_400_000;
/** Diez años de histórico como mucho en una sola consulta. */
const MAX_RANGE_DAYS = 3_700;

const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (time: number) => new Date(time).toISOString().slice(0, 10);

export function addDays(iso: string, days: number): string {
  return toIso(toTime(iso) + days * DAY_MS);
}

/** Días del rango, contando el primero y el último. */
export function rangeDays(range: DateRange): number {
  return Math.round((toTime(range.to) - toTime(range.from)) / DAY_MS) + 1;
}

export function assertRange(range: DateRange): void {
  if (Number.isNaN(toTime(range.from)) || Number.isNaN(toTime(range.to))) {
    throw new BadRequestException("Fechas no válidas");
  }
  if (range.from > range.to) {
    throw new BadRequestException(
      "La fecha de inicio es posterior a la de fin",
    );
  }
  if (rangeDays(range) > MAX_RANGE_DAYS) {
    throw new BadRequestException("El rango no puede pasar de diez años");
  }
}

/**
 * Periodo con el que comparar:
 * - previous: los mismos días justo antes.
 * - year: un año antes desplazado 364 días, para comparar lunes con lunes
 *   (en hostelería pesa más el día de la semana que la fecha exacta).
 */
export function comparisonRange(
  range: DateRange,
  mode: CompareMode,
): DateRange {
  if (mode === "year") {
    return { from: addDays(range.from, -364), to: addDays(range.to, -364) };
  }
  const days = rangeDays(range);
  return { from: addDays(range.from, -days), to: addDays(range.from, -1) };
}

/** Troceo de la gráfica: días hasta dos meses, semanas hasta un año, si no meses. */
export function bucketFor(range: DateRange): Bucket {
  const days = rangeDays(range);
  if (days <= 62) {
    return "day";
  }
  return days <= 366 ? "week" : "month";
}

/** Variación en % entre dos cifras; null si no hay base con la que comparar. */
export function deltaPercent(current: number, previous: number): number | null {
  if (!previous) {
    return null;
  }
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

/** Primer día del tramo (lunes de la semana, día 1 del mes) de una fecha. */
export function bucketStart(iso: string, bucket: Bucket): string {
  if (bucket === "month") {
    return `${iso.slice(0, 7)}-01`;
  }
  if (bucket === "week") {
    const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = domingo
    return addDays(iso, -((weekday + 6) % 7));
  }
  return iso;
}

/**
 * Tramo del periodo actual que corresponde a un tramo del periodo de
 * comparación, para dibujar las dos series una sobre otra (el lunes con el
 * lunes, marzo con marzo).
 */
export function alignedKey(
  key: string,
  mode: CompareMode,
  range: DateRange,
  bucket: Bucket,
): string {
  if (bucket === "month" && mode === "year") {
    return `${Number(key.slice(0, 4)) + 1}${key.slice(4)}`;
  }
  const offset = mode === "year" ? 364 : rangeDays(range);
  return bucketStart(addDays(key, offset), bucket);
}

/** Inicio de cada tramo que toca el rango, en orden (también los que no tienen ventas). */
export function bucketKeys(range: DateRange, bucket: Bucket): string[] {
  const keys: string[] = [];
  let key = bucketStart(range.from, bucket);
  while (key <= range.to) {
    keys.push(key);
    if (bucket === "month") {
      const [y, m] = key.split("-").map(Number);
      key =
        m === 12
          ? `${y + 1}-01-01`
          : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    } else {
      key = addDays(key, bucket === "week" ? 7 : 1);
    }
  }
  return keys;
}

/**
 * Equivalencia tramo de comparación → tramo actual. Año anterior: desplazar
 * (364 días = mismas semanas; mismo mes). Periodo anterior: por posición
 * (primer tramo con primer tramo), porque desplazar N días no cae en lunes ni
 * en día 1. Lo que no tiene pareja queda fuera.
 */
export function comparisonAlignment(
  range: DateRange,
  compare: DateRange,
  mode: CompareMode,
  bucket: Bucket,
): Map<string, string> {
  const current = bucketKeys(range, bucket);
  const previous = bucketKeys(compare, bucket);
  const map = new Map<string, string>();
  if (mode === "year") {
    const inCurrent = new Set(current);
    for (const key of previous) {
      const aligned = alignedKey(key, mode, range, bucket);
      if (inCurrent.has(aligned)) {
        map.set(key, aligned);
      }
    }
    return map;
  }
  previous.forEach((key, i) => {
    if (i < current.length) {
      map.set(key, current[i]);
    }
  });
  return map;
}
