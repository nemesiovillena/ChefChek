import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { deriveLotPrefix } from "../util/lot-prefix.util";

/**
 * Genera el nº de lote de un plato elaborado: `PREFIJO-DDMMAA-NN`.
 * - PREFIJO: 3-4 letras del nombre de la receta (ver `deriveLotPrefix`).
 * - DDMMAA: fecha (día-mes-año, 2 dígitos cada uno) en zona Europe/Madrid.
 * - NN: secuencia diaria por tenant, empieza en 01, sin reciclar huecos.
 *
 * La secuencia se calcula con `MAX(...)` por SQL crudo (no `findFirst`) para no
 * tropezar con soft-deletes/anulaciones, y se reintenta ante colisión con la
 * restricción `@@unique([tenantId, lotNumber])`.
 */
@Injectable()
export class LotNumberService {
  private static readonly MAX_RETRIES = 5;

  constructor(private readonly prisma: PrismaService) {}

  /** `DDMMAA` en Europe/Madrid. */
  formatDatePart(date: Date): string {
    const parts = new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    return `${get("day")}${get("month")}${get("year")}`;
  }

  /**
   * Devuelve un nº de lote libre para (tenant, receta, fecha). El caller debe
   * usarlo dentro de la misma operación que crea el `FoodLabel`; si otra sesión
   * se adelanta, la creación fallará por unicidad y se debe reintentar llamando
   * de nuevo a este método (ver `nextAvailable`).
   */
  async generateElaboratedLot(
    tenantId: string,
    recipeName: string,
    date: Date,
    attempt = 0,
  ): Promise<string> {
    const prefix = deriveLotPrefix(recipeName);
    const datePart = this.formatDatePart(date);

    // Solo se escanean lotes generados por ESTE servicio para ESTE día:
    // labelType ELABORATED (los HANDLED llevan nº de lote de proveedor en texto
    // libre y podrían colar dígitos gigantes o dashes que rompan el CAST /
    // inflen la secuencia), patrón exacto `PREFIJO-DDMMAA-NN` con secuencia de
    // 1-6 dígitos, y `::BIGINT` para no desbordar. `voidedAt` no se filtra a
    // propósito: un lote anulado ya consumió su número y no debe reciclarse.
    const rows = await this.prisma.$queryRaw<Array<{ max: bigint | null }>>`
      SELECT MAX(split_part("lotNumber", '-', 3)::BIGINT) AS max
      FROM "food_labels"
      WHERE "tenantId" = ${tenantId}
        AND "labelType" = 'ELABORATED'
        AND "lotNumber" ~ ${"^[A-Z0-9]{1,4}-" + datePart + "-[0-9]{1,6}$"}
    `;

    const currentMax =
      rows[0]?.max !== null && rows[0]?.max !== undefined
        ? Number(rows[0].max)
        : 0;
    const nextSeq = currentMax + 1 + attempt;
    const seq = String(nextSeq).padStart(2, "0");
    return `${prefix}-${datePart}-${seq}`;
  }

  get maxRetries(): number {
    return LotNumberService.MAX_RETRIES;
  }
}
