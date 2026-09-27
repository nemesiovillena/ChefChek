import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { SICTED_PRACTICE_CATALOG_SEED } from "../constants/sicted-practice-catalog-seed";
import { UpdateSictedPracticeDto } from "../dto/sicted-practice-catalog.dto";
import { sortByPracticeCode } from "../util/sicted-practice-code.util";

/**
 * Catálogo de buenas prácticas (BP1-BP6, manual real "Restaurantes y
 * empresas turísticas de catering") — editable/ampliable por el tenant, no
 * es evidencia (a diferencia del resto de fase 9). Sembrado idempotente vía
 * botón explícito "Cargar catálogo" (confirmado, no automático al activar
 * el módulo), mismo patrón que las plantillas de ejemplo de fase 2.
 */
@Injectable()
export class SictedPracticeCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, includeArchived = false) {
    const practices = await this.prisma.sictedPractice.findMany({
      where: { tenantId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: { bpSection: "asc" },
    });
    return sortByPracticeCode(practices);
  }

  async getOneVisible(tenantId: string, id: string) {
    const practice = await this.prisma.sictedPractice.findFirst({
      where: { id, tenantId },
    });
    if (!practice) {
      throw new NotFoundException("Práctica no encontrada");
    }
    return practice;
  }

  /** Idempotente: `skipDuplicates` por `(tenantId, code)` — reimportar no duplica ni pisa ediciones del tenant. */
  async seedCatalog(tenantId: string) {
    await this.prisma.sictedPractice.createMany({
      data: SICTED_PRACTICE_CATALOG_SEED.map((p) => ({ tenantId, ...p })),
      skipDuplicates: true,
    });
    return this.list(tenantId);
  }

  async update(tenantId: string, id: string, dto: UpdateSictedPracticeDto) {
    await this.getOneVisible(tenantId, id);
    return this.prisma.sictedPractice.update({
      where: { id },
      data: { title: dto.title, isMandatory: dto.isMandatory },
    });
  }

  async archive(tenantId: string, id: string) {
    await this.getOneVisible(tenantId, id);
    return this.prisma.sictedPractice.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }
}
