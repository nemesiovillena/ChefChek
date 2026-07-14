import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";

/** Números secuenciales de pedido por tenant: PED-0001, PED-0002... */
@Injectable()
export class PurchaseOrderNumberService {
  constructor(private readonly prisma: PrismaService) {}

  async generateOrderNumber(tenantId: string): Promise<string> {
    // SQL crudo a propósito: el soft-delete oculta pedidos borrados a
    // findFirst/findMany pero siguen ocupando el índice único
    // (tenantId, orderNumber); el MAX debe calcularse sobre TODAS las filas
    // o se generan números duplicados (mismo bug ya sufrido en albaranes).
    const rows = await this.prisma.$queryRaw<{ max: number | null }[]>`
      SELECT MAX(CAST(substring("orderNumber" FROM '^PED-(\\d+)$') AS int)) AS max
      FROM purchase_orders
      WHERE "tenantId" = ${tenantId}
    `;

    const nextSeq = (rows[0]?.max ?? 0) + 1;
    return `PED-${String(nextSeq).padStart(4, "0")}`;
  }
}
