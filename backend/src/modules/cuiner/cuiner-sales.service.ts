import { Injectable } from "@nestjs/common";
import { CuinerSaleStatus } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import { UploadSalesDto } from "./dto/cuiner.dto";

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

  async countByStatus(tenantId: string) {
    const groups = await this.prisma.cuinerSaleLine.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { _all: true },
    });
    return Object.fromEntries(groups.map((g) => [g.status, g._count._all]));
  }
}
