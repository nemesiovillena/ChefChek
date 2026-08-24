import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";

/** Números secuenciales de lote por tenant: LOTE-0001, LOTE-0002... */
@Injectable()
export class WorkBatchNumberService {
  constructor(private readonly prisma: PrismaService) {}

  async generateBatchNumber(tenantId: string): Promise<string> {
    // SQL crudo a propósito: el soft-delete (deletedAt) oculta lotes borrados a
    // findFirst/findMany pero siguen ocupando el número; el MAX debe calcularse
    // sobre TODAS las filas o se generan números duplicados (mismo patrón que
    // PurchaseOrderNumberService).
    const rows = await this.prisma.$queryRaw<{ max: number | null }[]>`
      SELECT MAX(CAST(substring("batchNumber" FROM '^LOTE-(\\d+)$') AS int)) AS max
      FROM work_batches
      WHERE "tenantId" = ${tenantId}
    `;

    const nextSeq = (rows[0]?.max ?? 0) + 1;
    return `LOTE-${String(nextSeq).padStart(4, "0")}`;
  }
}
