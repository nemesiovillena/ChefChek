import { Injectable } from "@nestjs/common";
import { CuinerSaleStatus } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import {
  SaleLineDto,
  UploadSalesDto,
  UploadSalesHistoryDto,
} from "./dto/cuiner.dto";

/** Importes de la línea tal como los manda el conector (nulos si es antiguo). */
const amountsOf = (line: SaleLineDto) => ({
  base: line.base ?? null,
  impuesto: line.impuesto ?? null,
  invitacion: line.invitacion ?? false,
});

/**
 * Recepción de las líneas de venta del TPV de Cuiner. Guarda cada línea una
 * sola vez (clave idVentasCab + linea) y avanza el cursor del conector. El
 * descuento de stock por receta se aplica en un paso posterior a partir de las
 * líneas PENDIENTE.
 */
@Injectable()
export class CuinerSalesService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(tenantId: string, dto: UploadSalesDto) {
    const rows = dto.lines.map((line) => ({
      tenantId,
      idVentasCab: line.idVentasCab,
      linea: line.linea,
      fecha: new Date(line.fecha),
      tipo: line.tipo,
      producto: line.producto,
      unidades: line.unidades,
      ...amountsOf(line),
      anulada: line.anulada,
      // Las anuladas se guardan para auditoría pero nunca descuentan.
      status: line.anulada
        ? CuinerSaleStatus.IGNORADA
        : CuinerSaleStatus.PENDIENTE,
    }));

    const [created] = await this.prisma.$transaction([
      this.prisma.cuinerSaleLine.createMany({
        data: rows,
        skipDuplicates: true,
      }),
      // El cursor solo avanza: un lote repetido o atrasado no lo hace retroceder.
      this.prisma.cuinerConfig.updateMany({
        where: { tenantId, lastVentasCabId: { lt: dto.cursor } },
        data: { lastVentasCabId: dto.cursor },
      }),
    ]);

    const config = await this.prisma.cuinerConfig.findUniqueOrThrow({
      where: { tenantId },
      select: { lastVentasCabId: true },
    });
    return {
      received: rows.length,
      inserted: created.count,
      lastVentasCabId: config.lastVentasCabId,
    };
  }

  /**
   * Histórico para informes: tickets anteriores al conector. Las líneas
   * nuevas entran como HISTORICO y nunca descuentan stock. Las que ya estaban
   * (recibidas antes de que el conector enviara importes) solo se completan
   * con sus importes: su estado de stock no cambia.
   */
  async ingestHistory(tenantId: string, dto: UploadSalesHistoryDto) {
    const ids = [...new Set(dto.lines.map((l) => l.idVentasCab))];
    const existing = ids.length
      ? await this.prisma.cuinerSaleLine.findMany({
          where: { tenantId, idVentasCab: { in: ids } },
          select: { idVentasCab: true, linea: true },
        })
      : [];
    const known = new Set(existing.map((e) => `${e.idVentasCab}-${e.linea}`));
    const fresh = dto.lines.filter(
      (l) => !known.has(`${l.idVentasCab}-${l.linea}`),
    );
    const stale = dto.lines.filter((l) =>
      known.has(`${l.idVentasCab}-${l.linea}`),
    );

    const [created] = await this.prisma.$transaction([
      this.prisma.cuinerSaleLine.createMany({
        data: fresh.map((line) => ({
          tenantId,
          idVentasCab: line.idVentasCab,
          linea: line.linea,
          fecha: new Date(line.fecha),
          tipo: line.tipo,
          producto: line.producto,
          unidades: line.unidades,
          ...amountsOf(line),
          anulada: line.anulada,
          status: CuinerSaleStatus.HISTORICO,
        })),
        skipDuplicates: true,
      }),
      ...stale.map((line) =>
        this.prisma.cuinerSaleLine.updateMany({
          where: { tenantId, idVentasCab: line.idVentasCab, linea: line.linea },
          data: amountsOf(line),
        }),
      ),
      // El tope del histórico solo baja: un lote repetido no lo hace subir.
      this.prisma.cuinerConfig.updateMany({
        where: {
          tenantId,
          OR: [{ historyCursor: null }, { historyCursor: { gt: dto.cursor } }],
        },
        data: { historyCursor: dto.cursor },
      }),
      ...(dto.done
        ? [
            this.prisma.cuinerConfig.updateMany({
              where: { tenantId },
              data: { historyDone: true },
            }),
          ]
        : []),
    ]);

    return {
      received: dto.lines.length,
      inserted: created.count,
      completed: stale.length,
    };
  }

  async countByStatus(tenantId: string) {
    const groups = await this.prisma.cuinerSaleLine.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { _all: true },
    });
    return Object.fromEntries(groups.map((g) => [g.status, g._count._all]));
  }
}
