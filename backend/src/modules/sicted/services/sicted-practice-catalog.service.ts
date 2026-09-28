import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  SICTED_CATALOG_2026_VERSION,
  SICTED_PRACTICE_CATALOG_2026_SEED,
} from "../constants/sicted-practice-catalog-2026-seed";
import { UpdateSictedPracticeDto } from "../dto/sicted-practice-catalog.dto";
import { sortByPracticeCode } from "../util/sicted-practice-code.util";
import { SictedSettingsService } from "./sicted-settings.service";

/**
 * Catálogo de buenas prácticas SICTED 2026 ("Restaurantes y empresas de
 * catering": capítulo × eje × módulo, obligatoria / de mejora) —
 * editable/ampliable por el tenant, no es evidencia. Sembrado idempotente vía
 * botón explícito "Cargar catálogo" (nunca automático al activar el módulo).
 */
@Injectable()
export class SictedPracticeCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SictedSettingsService,
  ) {}

  async list(tenantId: string, includeArchived = false) {
    const practices = await this.prisma.sictedPractice.findMany({
      where: { tenantId, ...(includeArchived ? {} : { archivedAt: null }) },
    });
    return sortByPracticeCode(practices);
  }

  /**
   * Prácticas que aplican al negocio: todas las de oficio/intersectoriales
   * activas + las complementarias cuyos módulos están activados en
   * Configuración → SICTED.
   */
  async listApplicable(tenantId: string) {
    const [practices, enabledModules] = await Promise.all([
      this.list(tenantId),
      this.settings.enabledComplementaryModules(tenantId),
    ]);
    const enabled = new Set(enabledModules);
    return practices.filter(
      (p) =>
        p.chapter !== "COMPLEMENTARIO" ||
        (p.moduleCode !== null && enabled.has(p.moduleCode)),
    );
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

  /**
   * Carga el catálogo 2026. Idempotente (`skipDuplicates` por `(tenantId,
   * code)`: reimportar no duplica ni pisa ediciones del tenant). Las
   * prácticas de catálogos anteriores se archivan, nunca se borran: sus
   * autoevaluaciones conservan el historial.
   */
  async seedCatalog(tenantId: string) {
    await this.prisma.$transaction([
      this.prisma.sictedPractice.updateMany({
        where: {
          tenantId,
          archivedAt: null,
          manualVersion: { not: SICTED_CATALOG_2026_VERSION },
        },
        data: { archivedAt: new Date() },
      }),
      this.prisma.sictedPractice.createMany({
        data: SICTED_PRACTICE_CATALOG_2026_SEED.map((p) => ({
          tenantId,
          ...p,
          manualVersion: SICTED_CATALOG_2026_VERSION,
        })),
        skipDuplicates: true,
      }),
    ]);
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
