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
import { ChecklistClosureCalendarService } from "./checklist-closure-calendar.service";
import {
  ClosureCalendar,
  isClosedDay,
} from "../util/checklist-closure-calendar.util";
import {
  CHECKLIST_FREQUENCIES,
  ChecklistFrequency,
  computePeriodKey,
  frequencyOfPeriodKey,
  isPeriodElapsed,
  periodEndFromKey,
  periodStartFromKey,
} from "../util/checklist-period.util";
import {
  buildChecklistRunSnapshot,
  ChecklistRunSnapshot,
} from "../util/checklist-run-snapshot.util";
import { ACTIVE_CHECKLIST_ITEMS } from "../constants/checklist-active-items";

/** Motivo con que se justifican en bloque las hojas vencidas de días de cierre. */
export const CLOSED_DAY_JUSTIFICATION = "Local cerrado ese día";

/**
 * Hojas (el "Registro") del motor de checklist compartido: generación
 * idempotente por periodo, marcas append-only, supervisión. Vive en
 * `ChecklistsModule`; el filtro por `usedByModules` lo aplica siempre a
 * través de `ChecklistTemplateService.getOneVisible` / listado de plantillas.
 */
@Injectable()
export class ChecklistRunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly closureCalendar: ChecklistClosureCalendarService,
  ) {}

  /**
   * Crea (upsert idempotente) la hoja del periodo en curso de cada plantilla
   * del tenant visible a `module`. Cualquier día del periodo vale: la semanal
   * cuenta desde el lunes, la mensual desde el día 1… aunque el local abra
   * otro día o la plantilla se cree a mitad de periodo. Llamado por el cron
   * diario y de forma "lazy" desde `GET runs/today`.
   *
   * En un día de cierre del local no se genera nada: la diaria no toca, y la
   * de un periodo más largo se creará el primer día que se abra (si el
   * periodo entero es de cierre, nunca).
   */
  async ensureRunsForToday(
    tenantId: string,
    module: ChecklistConsumerModule,
    now: Date = new Date(),
  ): Promise<void> {
    const calendar = await this.closureCalendar.load(tenantId);
    if (isClosedDay(computePeriodKey(now, "DAILY"), calendar)) {
      return;
    }
    const templates = await this.prisma.checklistTemplate.findMany({
      where: { tenantId, usedByModules: { has: module }, archivedAt: null },
      include: { items: ACTIVE_CHECKLIST_ITEMS },
    });

    for (const template of templates) {
      const frequency = template.frequency as ChecklistFrequency;
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
          snapshot: buildChecklistRunSnapshot(template) as any,
        },
        update: {}, // ya existe: no-op, idempotente.
      });
    }
  }

  /**
   * Hojas para trabajar hoy: las de los periodos en curso (día, semana, mes,
   * trimestre, año). Las diarias salen siempre; las de periodos más largos
   * solo mientras sigan pendientes o si se completaron hoy — hecha la
   * semanal, no vuelve a aparecer el resto de la semana.
   */
  async listCurrentRuns(
    tenantId: string,
    module: ChecklistConsumerModule,
    now: Date = new Date(),
  ) {
    const todayKey = computePeriodKey(now, "DAILY");
    const runs = await this.listRuns(tenantId, module, {
      periodKeys: CHECKLIST_FREQUENCIES.map((f) => computePeriodKey(now, f)),
    });
    return runs.filter(
      (run) =>
        run.template.frequency === "DAILY" ||
        run.status === "OPEN" ||
        (run.closedAt !== null &&
          computePeriodKey(run.closedAt, "DAILY") === todayKey),
    );
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
      periodKeys?: string[];
      /** Hojas cerradas (hechas o vencidas) desde este instante. */
      closedFrom?: Date;
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
        ...(filters.periodKeys
          ? { periodKey: { in: filters.periodKeys } }
          : {}),
        ...(filters.closedFrom
          ? { closedAt: { gte: filters.closedFrom } }
          : {}),
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
        template: {
          select: {
            id: true,
            name: true,
            area: true,
            mode: true,
            frequency: true,
          },
        },
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
        template: {
          select: {
            id: true,
            name: true,
            area: true,
            mode: true,
            frequency: true,
          },
        },
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
    }
    // Todas las marcas de un envío las firma la misma persona (el "Quién" de la hoja).
    if (new Set(entries.map((e) => e.performedByUserId)).size > 1) {
      throw new BadRequestException(
        "Todas las marcas de un envío deben ser de la misma persona",
      );
    }
    const performer = await this.resolvePerformer(
      tenantId,
      sessionUserId,
      entries[0]?.performedByUserId,
    );

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
        performedByUserId: performer.id,
        performedByName: performer.name,
        sessionUserId,
      })),
    });

    await this.maybeCompleteRun(runId, tenantId);
    return this.getRun(tenantId, module, runId);
  }

  /**
   * Quién firma el registro. Una cuenta personal (móvil) firma siempre con su
   * propio nombre, aunque el cliente mande otro. Una cuenta compartida (el
   * ordenador de cocina) no es una persona: obliga a elegir un usuario del
   * tenant que no sea a su vez una cuenta compartida. El nombre se toma
   * siempre de la base de datos, nunca del cliente.
   */
  private async resolvePerformer(
    tenantId: string,
    sessionUserId: string,
    requestedUserId: string | undefined,
  ): Promise<{ id: string; name: string }> {
    const sessionUser = await this.prisma.user.findFirst({
      where: { id: sessionUserId },
      select: { id: true, name: true, isSharedAccount: true },
    });
    if (sessionUser && !sessionUser.isSharedAccount) {
      return { id: sessionUser.id, name: sessionUser.name };
    }
    if (!requestedUserId) {
      throw new BadRequestException(
        "Desde una cuenta compartida hay que elegir quién lo hace",
      );
    }
    const performer = await this.prisma.user.findFirst({
      where: {
        id: requestedUserId,
        tenantId,
        isActive: true,
        isSharedAccount: false,
      },
      select: { id: true, name: true },
    });
    if (!performer) {
      throw new BadRequestException(
        "La persona elegida no es un usuario activo de este restaurante",
      );
    }
    return performer;
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
    // Una hoja vencida sin completar solo se cierra dejando constancia del porqué.
    if (run.status === "INCOMPLETE" && !dto.supervisorNote?.trim()) {
      throw new BadRequestException(
        "Para justificar una hoja incompleta hay que indicar el motivo",
      );
    }
    const supervisor = await this.resolvePerformer(
      tenantId,
      supervisedByUserId,
      dto.supervisorUserId,
    );
    return this.prisma.checklistRun.update({
      where: { id: runId },
      data: {
        supervisedAt: new Date(),
        supervisedByUserId,
        supervisorName: supervisor.name,
        supervisorNote: dto.supervisorNote,
      },
    });
  }

  /**
   * Cierra hojas OPEN de periodos ya terminados como INCOMPLETE. Devuelve las
   * cerradas (para alertar). El periodo se lee de la propia hoja, no de la
   * plantilla: si a la plantilla le cambiaron la frecuencia, sus hojas
   * antiguas siguen cerrándose con la frecuencia con que se generaron.
   */
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
      const frequency = frequencyOfPeriodKey(run.periodKey);
      if (isPeriodElapsed(run.periodKey, frequency, now)) {
        await this.prisma.checklistRun.update({
          where: { id: run.id },
          data: { status: "INCOMPLETE", closedAt: now },
        });
        closed.push(run);
      }
    }
    return closed;
  }

  /**
   * Hojas vencidas sin justificar cuyo periodo entero fue de cierre del local
   * (la diaria de un día de descanso, la semanal de una semana de vacaciones):
   * se generaron antes de declararse el cierre.
   */
  async listOverdueClosedDayRuns(
    tenantId: string,
    module: ChecklistConsumerModule,
  ) {
    const calendar = await this.closureCalendar.load(tenantId);
    const runs = await this.prisma.checklistRun.findMany({
      where: {
        tenantId,
        status: "INCOMPLETE",
        supervisedAt: null,
        template: { usedByModules: { has: module } },
      },
      select: { id: true, periodKey: true },
    });
    return runs.filter((run) =>
      this.isPeriodFullyClosed(run.periodKey, calendar),
    );
  }

  private isPeriodFullyClosed(
    periodKey: string,
    calendar: ClosureCalendar,
  ): boolean {
    const frequency = frequencyOfPeriodKey(periodKey);
    const end = periodEndFromKey(periodKey, frequency).getTime();
    for (
      let day = periodStartFromKey(periodKey, frequency);
      day.getTime() < end;
      day = new Date(day.getTime() + 86_400_000)
    ) {
      if (!isClosedDay(computePeriodKey(day, "DAILY"), calendar)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Justifica de una vez las hojas vencidas de días de cierre. Siguen
   * INCOMPLETE y quedan selladas, igual que al justificar una a una.
   */
  async justifyClosedDayRuns(
    tenantId: string,
    module: ChecklistConsumerModule,
    supervisedByUserId: string,
    supervisorUserId?: string,
  ): Promise<{ justified: number }> {
    const runs = await this.listOverdueClosedDayRuns(tenantId, module);
    if (runs.length === 0) {
      return { justified: 0 };
    }
    const supervisor = await this.resolvePerformer(
      tenantId,
      supervisedByUserId,
      supervisorUserId,
    );
    const { count } = await this.prisma.checklistRun.updateMany({
      where: { id: { in: runs.map((r) => r.id) }, supervisedAt: null },
      data: {
        supervisedAt: new Date(),
        supervisedByUserId,
        supervisorName: supervisor.name,
        supervisorNote: CLOSED_DAY_JUSTIFICATION,
      },
    });
    return { justified: count };
  }

  /** Personas activas del tenant, para el selector "¿quién lo hizo?". */
  /** Personas que pueden firmar registros: excluye las cuentas compartidas. */
  async listPerformers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId, isActive: true, isSharedAccount: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }
}
