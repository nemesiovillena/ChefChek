import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";

/** Generates auto-incrementing internal albaran numbers per tenant */
@Injectable()
export class AlbaranNumberService {
  private readonly logger = new Logger(AlbaranNumberService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Generate next internal number for a tenant: ALB-0001, ALB-0002, etc. */
  async generateInternalNumber(tenantId: string): Promise<string> {
    // SQL crudo a propósito: el middleware de soft-delete oculta los albaranes
    // borrados a findFirst/findMany, pero esos registros siguen ocupando el
    // índice único (tenantId, internalNumber), así que el máximo debe
    // calcularse sobre TODAS las filas o se generan números duplicados.
    // Solo cuenta el formato propio ALB-NNNN; formatos legacy con sufijo
    // (p. ej. ALB-2026-001) no participan en la secuencia.
    const rows = await this.prisma.$queryRaw<{ max: number | null }[]>`
      SELECT MAX(CAST(substring("internalNumber" FROM '^ALB-(\\d+)$') AS int)) AS max
      FROM albaranes
      WHERE "tenantId" = ${tenantId}
    `;

    const nextSeq = (rows[0]?.max ?? 0) + 1;
    const internalNumber = `ALB-${String(nextSeq).padStart(4, "0")}`;
    this.logger.debug(
      `Generated internal number: ${internalNumber} for tenant ${tenantId}`,
    );
    return internalNumber;
  }
}
