import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { ChecklistConsumerModule } from "../dto/checklist-template.dto";
import {
  ChecklistEntryInputDto,
  SuperviseChecklistRunDto,
} from "../dto/checklist-entry.dto";
import {
  ChecklistFrequency,
  computePeriodKey,
  isGenerationDay,
  periodEndFromKey,
  periodStartFromKey,
} from "../util/checklist-period.util";

interface ChecklistRunSnapshot {
  templateName: string;
  version: number;
  mode: string;
  requiresSupervisor: boolean;
  items: {
    id: string;
    label: string;
    isRequired: boolean;
    expectedRangeMin: number | null;
    expectedRangeMax: number | null;
  }[];
}

/**
 * Hojas (el "Registro") del motor de checklist compartido: generación
 * idempotente por periodo, marcas append-only, supervisión. Vive en
 * `ChecklistsModule`; el filtro por `usedByModules` lo aplica siempre a
 * través de `ChecklistTemplateService.getOneVisible` / listado de plantillas.
 */
@Injectable()
export class ChecklistRunService {
  constructor(private readonly prisma: PrismaService) {}

  private buildSnapshot(template: {
    name: string;
    version: number;
    mode: string;
    requiresSupervisor: boolean;
    items: {
      id: string;
      label: string;
      isRequired: boolean;
      expectedRangeMin: number | null;
      expectedRangeMax: number | null;
    }[];
  }): ChecklistRunSnapshot {
    return {
      templateName: template.name,
      version: template.version,
      mode: template.mode,
      requiresSupervisor: template.requiresSupervisor,
      items: template.items.map((i) => ({
        id: i.id,
        label: i.label,
        isRequired: i.isRequired,
        expectedRangeMin: i.expectedRangeMin,
        expectedRangeMax: i.expectedRangeMax,
      })),
    };
  }

  /**
   * Crea (upsert idempotente) las hojas del periodo actual para las
   * plantillas del tenant visibles a `module` cuya frecuencia toca generar
   * hoy. Llamado por el cron diario y de forma "lazy" desde `GET runs/today`.
   */
  async ensureRunsForToday(
    tenantId: string,
    module: ChecklistConsumerModule,
    now: Date = new Date(),
  ): Promise<void> {
    const templates = await this.prisma.checklistTemplate.findMany({
      where: { tenantId, usedByModules: { has: module }, archivedAt: null },
      include: { items: { orderBy: { position: "asc" } } },
    });

    for (const template of templates) {
      const frequency = template.frequency as ChecklistFrequency;
      if (
        !isGenerationDay(now, frequency, template.weekday, template.dayOfMonth)
      ) {
        continue;
      }
      const periodKey = computePeriodKey(now, frequency);
      const periodStart = periodStartFromKey(periodKey, frequency);
      await this.prisma.checklistRun.upsert({
        where: { templateId_periodKey: { templateId: template.id, periodKey } },
        create: {
          tenantId,
          templateId: template.id,
          periodKey,
          periodStart,
          status: "OPEN",
          snapshot: this.buildSnapshot(template) as any,
        },
        update: {}, // ya existe: no-op, idempotente.
      });
    }
  }

  async listRuns(
    tenantId: string,
    module: ChecklistConsumerModule,
    filters: {
      from?: Date;
      to?: Date;
      templateId?: string;
      status?: string;
      area?: string;
    },
  ) {
    const runs = await this.prisma.checklistRun.findMany({
      where: {
        tenantId,
        template: {
          usedByModules: { has: module },
          ...(filters.area ? { area: filters.area } : {}),
        },
        ...(filters.templateId ? { templateId: filters.templateId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.from || filters.to
          ? {
              periodStart: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      },
      include: {
        template: { select: { id: true, name: true, area: true, mode: true } },
      },
      orderBy: { periodStart: "desc" },
      take: 200,
    });

    const markedByRun = await this.countMarkedItemsByRun(runs.map((r) => r.id));
    return runs.map((run) => ({
      ...run,
      entriesCount: markedByRun.get(run.id) ?? 0,
    }));
  }

  /**
   * Ítems DISTINTOS con al menos una marca, por hoja — no el nº de filas de
   * `checklist_entries` (una corrección añade una fila sin añadir un ítem
   * nuevo; contar filas infla el progreso "X/Y" por encima del total tras
   * cualquier corrección).
   */
  private async countMarkedItemsByRun(
    runIds: string[],
  ): Promise<Map<string, number>> {
    if (runIds.length === 0) {
      return new Map();
    }
    const pairs = await this.prisma.checklistEntry.groupBy({
      by: ["runId", "itemId"],
      where: { runId: { in: runIds } },
    });
    const counts = new Map<string, number>();
    for (const { runId } of pairs) {
      counts.set(runId, (counts.get(runId) ?? 0) + 1);
    }
    return counts;
  }

  async getRun(
    tenantId: string,
    module: ChecklistConsumerModule,
    runId: string,
  ) {
    const run = await this.prisma.checklistRun.findFirst({
      where: {
        id: runId,
        tenantId,
        template: { usedByModules: { has: module } },
      },
      include: {
        template: { select: { id: true, name: true, area: true, mode: true } },
        entries: { orderBy: { recordedAt: "asc" } },
      },
    });
    if (!run) {
      throw new NotFoundException("Hoja no encontrada");
    }
    return { ...run, currentByItem: this.currentEntriesByItem(run.entries) };
  }

  /** Última entrada por itemId (estado "vigente"); el histórico completo se conserva aparte. */
  private currentEntriesByItem<T extends { itemId: string; recordedAt: Date }>(
    entries: T[],
  ): Record<string, T> {
    const byItem: Record<string, T> = {};
    for (const entry of entries) {
      const prev = byItem[entry.itemId];
      if (!prev || entry.recordedAt >= prev.recordedAt) {
        byItem[entry.itemId] = entry;
      }
    }
    return byItem;
  }

  async addEntries(
    tenantId: string,
    module: ChecklistConsumerModule,
    runId: string,
    sessionUserId: string,
    entries: ChecklistEntryInputDto[],
  ) {
    const run = await this.prisma.checklistRun.findFirst({
      where: {
        id: runId,
        tenantId,
        template: { usedByModules: { has: module } },
      },
    });
    if (!run) {
      throw new NotFoundException("Hoja no encontrada");
    }
    if (run.supervisedAt) {
      throw new ConflictException(
        "La hoja ya está supervisada, no admite más marcas",
      );
    }
    const snapshot = run.snapshot as unknown as ChecklistRunSnapshot;
    const itemsById = new Map(snapshot.items.map((i) => [i.id, i]));

    for (const entry of entries) {
      const item = itemsById.get(entry.itemId);
      if (!item) {
        throw new BadRequestException(
          `El ítem ${entry.itemId} no pertenece a esta hoja`,
        );
      }
      this.validateEntryAgainstMode(snapshot.mode, entry, item);
      if (entry.performedByUserId) {
        const user = await this.prisma.user.findFirst({
          where: { id: entry.performedByUserId, tenantId },
        });
        if (!user) {
          throw new BadRequestException(
            `performedByUserId ${entry.performedByUserId} no pertenece a este tenant`,
          );
        }
      }
    }

    await this.prisma.checklistEntry.createMany({
      data: entries.map((entry) => ({
        tenantId,
        runId,
        itemId: entry.itemId,
        outcome: entry.outcome,
        reason: entry.reason,
        observation: entry.observation,
        value: entry.value,
        withinRange: this.computeWithinRange(
          entry.value,
          itemsById.get(entry.itemId)!,
        ),
        correctiveAction: entry.correctiveAction,
        note: entry.note,
        correctsEntryId: entry.correctsEntryId,
        performedByUserId: entry.performedByUserId,
        performedByName: entry.performedByName,
        sessionUserId,
      })),
    });

    await this.maybeCompleteRun(runId, tenantId);
    return this.getRun(tenantId, module, runId);
  }

  private validateEntryAgainstMode(
    mode: string,
    entry: ChecklistEntryInputDto,
    item: ChecklistRunSnapshot["items"][number],
  ): void {
    if (mode === "EXECUTION") {
      if (entry.outcome !== "DONE" && entry.outcome !== "NOT_DONE") {
        throw new BadRequestException(
          `Ítem ${item.label}: outcome debe ser DONE o NOT_DONE`,
        );
      }
      if (entry.outcome === "NOT_DONE" && !entry.reason) {
        throw new BadRequestException(
          `Ítem ${item.label}: "no realizado" exige motivo`,
        );
      }
    } else if (mode === "INSPECTION") {
      if (entry.outcome !== "OK" && entry.outcome !== "BAD") {
        throw new BadRequestException(
          `Ítem ${item.label}: outcome debe ser OK o BAD`,
        );
      }
      if (entry.outcome === "BAD" && !entry.observation) {
        throw new BadRequestException(
          `Ítem ${item.label}: "mal" exige observación`,
        );
      }
    } else if (mode === "MEASUREMENT") {
      if (entry.value === undefined || entry.value === null) {
        throw new BadRequestException(
          `Ítem ${item.label}: value es obligatorio`,
        );
      }
      const outOfRange =
        (item.expectedRangeMin !== null &&
          entry.value < item.expectedRangeMin) ||
        (item.expectedRangeMax !== null && entry.value > item.expectedRangeMax);
      if (outOfRange && !entry.correctiveAction) {
        throw new BadRequestException(
          `Ítem ${item.label}: valor fuera de rango exige acción correctiva`,
        );
      }
    }
  }

  /** Calculado por el servidor, nunca de confianza del cliente. */
  private computeWithinRange(
    value: number | undefined,
    item: ChecklistRunSnapshot["items"][number],
  ): boolean | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (item.expectedRangeMin === null && item.expectedRangeMax === null) {
      return null;
    }
    const aboveMin =
      item.expectedRangeMin === null || value >= item.expectedRangeMin;
    const belowMax =
      item.expectedRangeMax === null || value <= item.expectedRangeMax;
    return aboveMin && belowMax;
  }

  /** Si todos los ítems obligatorios ya tienen al menos una marca, cierra la hoja como COMPLETED. */
  private async maybeCompleteRun(
    runId: string,
    tenantId: string,
  ): Promise<void> {
    const run = await this.prisma.checklistRun.findFirst({
      where: { id: runId, tenantId },
      include: { entries: { select: { itemId: true } } },
    });
    if (!run || run.status !== "OPEN") {
      return;
    }
    const snapshot = run.snapshot as unknown as ChecklistRunSnapshot;
    const markedItemIds = new Set(run.entries.map((e) => e.itemId));
    const requiredItems = snapshot.items.filter((i) => i.isRequired);
    const allResolved = requiredItems.every((i) => markedItemIds.has(i.id));
    if (allResolved) {
      await this.prisma.checklistRun.update({
        where: { id: runId },
        data: { status: "COMPLETED", closedAt: new Date() },
      });
    }
  }

  async supervise(
    tenantId: string,
    module: ChecklistConsumerModule,
    runId: string,
    supervisedByUserId: string,
    dto: SuperviseChecklistRunDto,
  ) {
    const run = await this.prisma.checklistRun.findFirst({
      where: {
        id: runId,
        tenantId,
        template: { usedByModules: { has: module } },
      },
    });
    if (!run) {
      throw new NotFoundException("Hoja no encontrada");
    }
    if (run.supervisedAt) {
      throw new ConflictException("La hoja ya está supervisada");
    }
    if (run.status === "OPEN") {
      throw new ForbiddenException(
        "No se puede supervisar una hoja con ítems obligatorios sin resolver",
      );
    }
    return this.prisma.checklistRun.update({
      where: { id: runId },
      data: {
        supervisedAt: new Date(),
        supervisedByUserId,
        supervisorName: dto.supervisorName,
        supervisorNote: dto.supervisorNote,
      },
    });
  }

  /** Cierra hojas OPEN de periodos ya terminados como INCOMPLETE. Devuelve las cerradas (para alertar). */
  async closeElapsedRuns(tenantId: string, now: Date = new Date()) {
    const openRuns = await this.prisma.checklistRun.findMany({
      where: { tenantId, status: "OPEN", periodStart: { lt: now } },
      include: {
        template: {
          select: { frequency: true, name: true, usedByModules: true },
        },
      },
    });
    const closed: typeof openRuns = [];
    for (const run of openRuns) {
      const end = periodEndFromKey(
        run.periodKey,
        run.template.frequency as ChecklistFrequency,
      );
      if (end.getTime() <= now.getTime()) {
        await this.prisma.checklistRun.update({
          where: { id: run.id },
          data: { status: "INCOMPLETE", closedAt: now },
        });
        closed.push(run);
      }
    }
    return closed;
  }

  /** Personas activas del tenant, para el selector "¿quién lo hizo?". */
  async listPerformers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }
}
