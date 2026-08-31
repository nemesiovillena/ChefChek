import { StorageCondition } from "../constants/storage-condition.constant";

/**
 * Config de conservación efectiva de una entidad (receta o artículo) más los
 * overrides puntuales de la etiqueta. Precedencia: override > config entidad.
 */
export interface ConservationInput {
  storageCondition?: StorageCondition | null;
  storageTempMin?: number | null;
  storageTempMax?: number | null;
  /** Días de vida útil tras elaboración (receta) o tras manipulación (artículo). */
  shelfLifeDays?: number | null;
  /** Días de vida útil si el producto se congela. */
  shelfLifeFrozenDays?: number | null;
}

export interface ResolvedConservation {
  storageCondition: StorageCondition | null;
  storageTempMin: number | null;
  storageTempMax: number | null;
  shelfLifeDays: number | null;
  shelfLifeFrozenDays: number | null;
}

function pick<T>(
  override: T | null | undefined,
  base: T | null | undefined,
): T | null {
  return override ?? base ?? null;
}

export function resolveConservation(
  base: ConservationInput,
  override: ConservationInput,
): ResolvedConservation {
  return {
    storageCondition: pick(override.storageCondition, base.storageCondition),
    storageTempMin: pick(override.storageTempMin, base.storageTempMin),
    storageTempMax: pick(override.storageTempMax, base.storageTempMax),
    shelfLifeDays: pick(override.shelfLifeDays, base.shelfLifeDays),
    shelfLifeFrozenDays: pick(
      override.shelfLifeFrozenDays,
      base.shelfLifeFrozenDays,
    ),
  };
}

const TIMEZONE = "Europe/Madrid";

/** Día natural (año/mes/día) de un instante en la zona Europe/Madrid. */
function madridCalendarDay(date: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/**
 * Fecha de consumo preferente: el DÍA NATURAL en Europe/Madrid resultante de
 * sumar `shelfLifeDays` días a la fecha (en Madrid) de `from`. La etiqueta solo
 * imprime la fecha (sin hora), así que se materializa como mediodía UTC de ese
 * día — instante que cae en el mismo día natural en Madrid con o sin horario de
 * verano, y no depende de la zona horaria del servidor.
 *
 * Ej. elaborado el 31/08 a las 18:00 con "2 días" → consumo preferente 02/09.
 */
export function computeUseByDate(from: Date, shelfLifeDays: number): Date {
  const { y, m, d } = madridCalendarDay(from);
  // Date.UTC + días en ms sobre las 12:00 UTC: seguro para cambios de mes/año.
  return new Date(
    Date.UTC(y, m - 1, d, 12, 0, 0, 0) + shelfLifeDays * 86_400_000,
  );
}
