import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { ACTIVE_CHECKLIST_ITEMS } from "../constants/checklist-active-items";
import { buildChecklistRunSnapshot } from "../util/checklist-run-snapshot.util";
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
      include: { items: ACTIVE_CHECKLIST_ITEMS },
      orderBy: [{ sortOrder: "asc" }, { area: "asc" }, { name: "asc" }],
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
      include: { items: ACTIVE_CHECKLIST_ITEMS },
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
    const sortOrder = await nextSortOrder(this.prisma, tenantId);
    return this.prisma.checklistTemplate.create({
      data: buildCreateData(tenantId, module, userId, dto, sortOrder),
      include: { items: ACTIVE_CHECKLIST_ITEMS },
    });
  }

  /**
   * Guarda el orden del listado del Plan: `sortOrder` = índice en `ids`.
   * Exige la lista completa de plantillas activas del módulo, para que no
   * queden huecos ni empates con plantillas que el cliente no vio.
   */
  async reorder(
    tenantId: string,
    module: ChecklistConsumerModule,
    ids: string[],
  ) {
    const active = await this.prisma.checklistTemplate.findMany({
      where: { tenantId, usedByModules: { has: module }, archivedAt: null },
      select: { id: true },
    });
    const activeIds = new Set(active.map((t) => t.id));
    if (
      new Set(ids).size !== ids.length ||
      ids.length !== activeIds.size ||
      !ids.every((id) => activeIds.has(id))
    ) {
      throw new BadRequestException(
        "El Plan ha cambiado mientras ordenabas. Recarga e inténtalo de nuevo.",
      );
    }
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.checklistTemplate.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return { success: true };
  }

  /**
   * Alta en bloque de plantillas exportadas desde otro tenant. Omite las que
   * ya existen en este Plan con el mismo nombre (sin distinguir mayúsculas ni
   * tildes) y las repetidas dentro del propio archivo, para que reimportar el
   * mismo archivo no duplique hojas. Todo o nada: una transacción.
   */
  async importMany(
    tenantId: string,
    module: ChecklistConsumerModule,
    userId: string,
    templates: CreateChecklistTemplateDto[],
  ) {
    const existing = await this.list(tenantId, module);
    const seen = new Set(existing.map((t) => normalizeName(t.name)));
    const toCreate: CreateChecklistTemplateDto[] = [];
    const skipped: string[] = [];
    for (const dto of templates) {
      const key = normalizeName(dto.name);
      if (seen.has(key)) {
        skipped.push(dto.name);
        continue;
      }
      seen.add(key);
      toCreate.push(dto);
    }

    const created = await this.prisma.$transaction(
      async (tx) => {
        const rows: { id: string; name: string }[] = [];
        let sortOrder = await nextSortOrder(tx, tenantId);
        for (const dto of toCreate) {
          rows.push(
            await tx.checklistTemplate.create({
              data: buildCreateData(tenantId, module, userId, dto, sortOrder++),
              select: { id: true, name: true },
            }),
          );
        }
        return rows;
      },
      { timeout: 30_000 },
    );
    return { created, skipped };
  }

  /** PATCH: reemplazo completo de campos + ítems; sube `version`. */
  /**
   * Edita el Plan conservando la identidad de los ítems: los que siguen
   * (por `id`) se actualizan en su sitio, los nuevos se crean y los quitados
   * se borran solo si nunca se marcaron — si tienen marcas se retiran
   * (`removedAt`), porque sus marcas son evidencia inalterable y el borrado
   * en cascada las arrastraría. Antes se borraban y recreaban todos: las
   * hojas ya generadas quedaban apuntando a ítems inexistentes y marcarlas
   * fallaba (FK `checklist_entries_itemId_fkey`).
   *
   * Las hojas abiertas del Plan que aún no tienen ninguna marca renuevan su
   * foto para usar el Plan nuevo; las ya trabajadas conservan la suya.
   */
  async update(
    tenantId: string,
    module: ChecklistConsumerModule,
    id: string,
    dto: UpdateChecklistTemplateDto,
  ) {
    const existing = await this.getOneVisible(tenantId, module, id);
    const existingIds = new Set(existing.items.map((i) => i.id));
    const keptIds = new Set(
      dto.items
        .map((i) => i.id)
        .filter(
          (itemId): itemId is string => !!itemId && existingIds.has(itemId),
        ),
    );
    const removedIds = existing.items
      .filter((i) => !keptIds.has(i.id))
      .map((i) => i.id);

    return this.prisma.$transaction(async (tx) => {
      if (removedIds.length > 0) {
        const marked = await tx.checklistEntry.findMany({
          where: { itemId: { in: removedIds } },
          select: { itemId: true },
          distinct: ["itemId"],
        });
        const markedIds = marked.map((m) => m.itemId);
        await tx.checklistTemplateItem.updateMany({
          where: { id: { in: markedIds } },
          data: { removedAt: new Date() },
        });
        await tx.checklistTemplateItem.deleteMany({
          where: {
            id: { in: removedIds.filter((r) => !markedIds.includes(r)) },
          },
        });
      }

      for (const [index, item] of dto.items.entries()) {
        const data = {
          position: index,
          label: item.label,
          itemFrequency: item.itemFrequency ?? null,
          procedure: item.procedure ?? null,
          products: item.products ?? [],
          dosage: item.dosage ?? null,
          epi: item.epi ?? null,
          isRequired: item.isRequired ?? true,
          expectedRangeMin: item.expectedRangeMin ?? null,
          expectedRangeMax: item.expectedRangeMax ?? null,
          defaultValue: item.defaultValue ?? null,
        };
        if (item.id && keptIds.has(item.id)) {
          await tx.checklistTemplateItem.update({
            where: { id: item.id },
            data,
          });
        } else {
          await tx.checklistTemplateItem.create({
            data: { ...data, tenantId, templateId: id },
          });
        }
      }

      const updated = await tx.checklistTemplate.update({
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
        },
        include: { items: ACTIVE_CHECKLIST_ITEMS },
      });

      const snapshot = buildChecklistRunSnapshot(updated) as any;
      await tx.checklistRun.updateMany({
        where: {
          templateId: id,
          status: "OPEN",
          supervisedAt: null,
          entries: { none: {} },
        },
        data: { snapshot },
      });

      return updated;
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
        include: { items: ACTIVE_CHECKLIST_ITEMS },
      });
      if (existing) {
        if (existing.usedByModules.includes(module)) {
          return existing; // ya sembrada para este módulo, no-op.
        }
        return this.prisma.checklistTemplate.update({
          where: { id: existing.id },
          data: { usedByModules: { push: module } },
          include: { items: ACTIVE_CHECKLIST_ITEMS },
        });
      }
    }
    return this.create(tenantId, module, userId, dto);
  }
}

/** Nombre comparable: sin tildes, minúsculas y espacios colapsados. */
function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Siguiente posición libre al final del Plan del tenant. */
async function nextSortOrder(
  client: Prisma.TransactionClient,
  tenantId: string,
) {
  const { _max } = await client.checklistTemplate.aggregate({
    where: { tenantId },
    _max: { sortOrder: true },
  });
  return (_max.sortOrder ?? -1) + 1;
}

function buildCreateData(
  tenantId: string,
  module: ChecklistConsumerModule,
  userId: string,
  dto: CreateChecklistTemplateDto,
  sortOrder: number,
) {
  return {
    tenantId,
    sortOrder,
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
        defaultValue: item.defaultValue,
      })),
    },
  };
}
