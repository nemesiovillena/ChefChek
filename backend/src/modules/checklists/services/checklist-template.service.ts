import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  ChecklistConsumerModule,
  CreateChecklistTemplateDto,
  UpdateChecklistTemplateDto,
} from "../dto/checklist-template.dto";

/**
 * Plantillas (el "Plan") del motor de checklist compartido. Vive en
 * `ChecklistsModule`; cada módulo consumidor (`sicted`, y en el futuro
 * `appcc`) filtra siempre por `usedByModules` para no ver ni editar lo que
 * no le corresponde, aunque la fila sea la misma para ambos.
 */
@Injectable()
export class ChecklistTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista plantillas no archivadas visibles para `module`. */
  async list(tenantId: string, module: ChecklistConsumerModule, area?: string) {
    return this.prisma.checklistTemplate.findMany({
      where: {
        tenantId,
        usedByModules: { has: module },
        archivedAt: null,
        ...(area ? { area } : {}),
      },
      include: { items: { orderBy: { position: "asc" } } },
      orderBy: [{ area: "asc" }, { name: "asc" }],
    });
  }

  /** 404 si no existe o si `module` no está en `usedByModules` (aunque exista para otro módulo). */
  async getOneVisible(
    tenantId: string,
    module: ChecklistConsumerModule,
    id: string,
  ) {
    const template = await this.prisma.checklistTemplate.findFirst({
      where: { id, tenantId, usedByModules: { has: module } },
      include: { items: { orderBy: { position: "asc" } } },
    });
    if (!template) {
      throw new NotFoundException("Plantilla no encontrada");
    }
    return template;
  }

  async create(
    tenantId: string,
    module: ChecklistConsumerModule,
    userId: string,
    dto: CreateChecklistTemplateDto,
  ) {
    return this.prisma.checklistTemplate.create({
      data: {
        tenantId,
        name: dto.name,
        externalCode: dto.externalCode,
        usedByModules: [module],
        kind: dto.kind,
        mode: dto.mode,
        area: dto.area,
        frequency: dto.frequency,
        weekday: dto.weekday,
        dayOfMonth: dto.dayOfMonth,
        responsiblePosition: dto.responsiblePosition,
        requiresSupervisor: dto.requiresSupervisor ?? dto.mode === "INSPECTION",
        practiceRef: dto.practiceRef,
        createdBy: userId,
        items: {
          create: dto.items.map((item, index) => ({
            tenantId,
            position: index,
            label: item.label,
            itemFrequency: item.itemFrequency,
            procedure: item.procedure,
            products: item.products ?? [],
            dosage: item.dosage,
            epi: item.epi,
            isRequired: item.isRequired ?? true,
            expectedRangeMin: item.expectedRangeMin,
            expectedRangeMax: item.expectedRangeMax,
          })),
        },
      },
      include: { items: { orderBy: { position: "asc" } } },
    });
  }

  /** PATCH: reemplazo completo de campos + ítems; sube `version`. */
  async update(
    tenantId: string,
    module: ChecklistConsumerModule,
    id: string,
    dto: UpdateChecklistTemplateDto,
  ) {
    const existing = await this.getOneVisible(tenantId, module, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.checklistTemplateItem.deleteMany({ where: { templateId: id } });
      return tx.checklistTemplate.update({
        where: { id },
        data: {
          name: dto.name,
          externalCode: dto.externalCode,
          kind: dto.kind,
          mode: dto.mode,
          area: dto.area,
          frequency: dto.frequency,
          weekday: dto.weekday,
          dayOfMonth: dto.dayOfMonth,
          responsiblePosition: dto.responsiblePosition,
          requiresSupervisor:
            dto.requiresSupervisor ?? dto.mode === "INSPECTION",
          practiceRef: dto.practiceRef,
          version: existing.version + 1,
          items: {
            create: dto.items.map((item, index) => ({
              tenantId,
              position: index,
              label: item.label,
              itemFrequency: item.itemFrequency,
              procedure: item.procedure,
              products: item.products ?? [],
              dosage: item.dosage,
              epi: item.epi,
              isRequired: item.isRequired ?? true,
              expectedRangeMin: item.expectedRangeMin,
              expectedRangeMax: item.expectedRangeMax,
            })),
          },
        },
        include: { items: { orderBy: { position: "asc" } } },
      });
    });
  }

  async archive(tenantId: string, module: ChecklistConsumerModule, id: string) {
    await this.getOneVisible(tenantId, module, id);
    return this.prisma.checklistTemplate.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  /**
   * Siembra idempotente por `(tenantId, externalCode)`: si ya existe una
   * plantilla con ese código (p. ej. sembrada antes para otro módulo), le
   * añade `module` a `usedByModules` en vez de duplicar la fila — así un
   * checklist compartido (limpieza, temperatura) queda como una sola fila
   * aunque lo siembren `sicted` y `appcc` por separado. Sin `externalCode`
   * se crea siempre nueva (no hay forma segura de deduplicar por nombre).
   */
  async seedStarter(
    tenantId: string,
    module: ChecklistConsumerModule,
    userId: string,
    dto: CreateChecklistTemplateDto,
  ) {
    if (dto.externalCode) {
      const existing = await this.prisma.checklistTemplate.findFirst({
        where: { tenantId, externalCode: dto.externalCode, archivedAt: null },
        include: { items: { orderBy: { position: "asc" } } },
      });
      if (existing) {
        if (existing.usedByModules.includes(module)) {
          return existing; // ya sembrada para este módulo, no-op.
        }
        return this.prisma.checklistTemplate.update({
          where: { id: existing.id },
          data: { usedByModules: { push: module } },
          include: { items: { orderBy: { position: "asc" } } },
        });
      }
    }
    return this.create(tenantId, module, userId, dto);
  }
}
