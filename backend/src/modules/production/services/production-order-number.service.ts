import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";

/** Números secuenciales de orden de producción por tenant: PO-0001, PO-0002... */
@Injectable()
export class ProductionOrderNumberService {
  constructor(private readonly prisma: PrismaService) {}

  async generateOrderNumber(tenantId: string): Promise<string> {
    // SQL crudo a propósito, mismo motivo que WorkBatchNumberService: el
    // soft-delete (deletedAt) no debe permitir que el MAX ignore filas borradas.
    const rows = await this.prisma.$queryRaw<{ max: number | null }[]>`
      SELECT MAX(CAST(substring("orderNumber" FROM '^PO-(\\d+)$') AS int)) AS max
      FROM production_orders
      WHERE "tenantId" = ${tenantId}
    `;

    const nextSeq = (rows[0]?.max ?? 0) + 1;
    return `PO-${String(nextSeq).padStart(4, "0")}`;
  }
}
