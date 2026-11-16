import { Prisma } from "@prisma/client";
import type { DateRange } from "./gestion-period.util";

export const NO_FAMILY_LABEL = "Sin familia";

/** Familia de primer nivel («CARNES-VACUNO» → «CARNES»): con la que compite un plato. */
export const groupOf = (family: string | null) =>
  family?.split("-")[0]?.trim() || NO_FAMILY_LABEL;

export const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Línea cobrada: no anulada y con importe. Las líneas sin importe son tickets
 * que el conector recibió antes de enviar importes y que Cuiner renumeró al
 * reimportar la cinta: ya no existen allí y contarlas inflaría tickets y
 * unidades. Se informan aparte como «sin importe».
 */
export const CHARGED = Prisma.sql`s.anulada = false AND s.base IS NOT NULL`;

/**
 * Filtro de ventas del tenant en un rango de días de caja. La fecha se guarda
 * a las 00:00 del día de caja: de las 00:00 del primer día a las 00:00 del día
 * siguiente al último, para aprovechar el índice (tenantId, fecha).
 */
export function inRange(tenantId: string, range: DateRange): Prisma.Sql {
  return Prisma.sql`s."tenantId" = ${tenantId}
    AND s.fecha >= ${range.from}::date
    AND s.fecha < (${range.to}::date + 1)`;
}
