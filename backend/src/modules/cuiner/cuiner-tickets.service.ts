import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import { UploadTicketsDto } from "./dto/cuiner.dto";

/**
 * Cabeceras de ticket y cobros que manda el conector para Gestión (mesa,
 * comensales, turno, horas, camarero, forma de pago). Solo informes: no toca
 * ventas ni stock. Idempotente: reenviar un lote deja el mismo resultado.
 */
@Injectable()
export class CuinerTicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(
    tenantId: string,
    dto: UploadTicketsDto,
  ): Promise<{ ticketCursor: number; tickets: number; payments: number }> {
    // Un id repetido en el lote rompería el upsert en bloque: gana el último.
    const tickets = [
      ...new Map(dto.tickets.map((t) => [t.idVentasCab, t])).values(),
    ];
    const payments = [
      ...new Map(
        dto.payments.map((p) => [`${p.idVentasCab}:${p.linea}`, p]),
      ).values(),
    ];
    const ids = [
      ...new Set([
        ...tickets.map((t) => t.idVentasCab),
        ...payments.map((p) => p.idVentasCab),
      ]),
    ];
    await this.prisma.$transaction(async (tx) => {
      if (tickets.length > 0) {
        // Upsert en bloque: un ticket reimportado en Cuiner trae datos nuevos.
        const values = tickets.map(
          (t) =>
            Prisma.sql`(${`ct_${tenantId}_${t.idVentasCab}`}, ${tenantId}, ${t.idVentasCab}, ${t.fecha}::date,
              ${t.mesa ?? null}, ${t.comensales ?? null}, ${t.turno ?? null}, ${t.openedAt ?? null},
              ${t.closedAt ?? null}, ${t.camarero ?? null}, ${t.total ?? null}, ${t.invitacion},
              ${t.consumoPersonal}, now())`,
        );
        await tx.$executeRaw`
          INSERT INTO cuiner_tickets ("id", "tenantId", "idVentasCab", "fecha", "mesa", "comensales",
            "turno", "openedAt", "closedAt", "camarero", "total", "invitacion", "consumoPersonal", "updatedAt")
          VALUES ${Prisma.join(values)}
          ON CONFLICT ("tenantId", "idVentasCab") DO UPDATE SET
            "fecha" = EXCLUDED."fecha", "mesa" = EXCLUDED."mesa", "comensales" = EXCLUDED."comensales",
            "turno" = EXCLUDED."turno", "openedAt" = EXCLUDED."openedAt", "closedAt" = EXCLUDED."closedAt",
            "camarero" = EXCLUDED."camarero", "total" = EXCLUDED."total",
            "invitacion" = EXCLUDED."invitacion", "consumoPersonal" = EXCLUDED."consumoPersonal",
            "updatedAt" = now()`;
      }
      // Los cobros de los tickets del lote se reemplazan enteros.
      if (ids.length > 0) {
        await tx.cuinerTicketPayment.deleteMany({
          where: { tenantId, idVentasCab: { in: ids } },
        });
      }
      if (payments.length > 0) {
        await tx.cuinerTicketPayment.createMany({
          data: payments.map((p) => ({
            tenantId,
            idVentasCab: p.idVentasCab,
            linea: p.linea,
            formaPago: p.formaPago.trim() || "EFECTIVO",
            importe: p.importe,
            anulada: p.anulada,
          })),
          skipDuplicates: true,
        });
      }
      await tx.cuinerConfig.update({
        where: { tenantId },
        data: { ticketCursor: dto.cursor },
      });
    });
    return {
      ticketCursor: dto.cursor,
      tickets: tickets.length,
      payments: payments.length,
    };
  }
}
