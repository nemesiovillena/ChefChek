import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../../common/services/prisma.service";
import { PurchaseListService } from "./purchase-list.service";
import { NotificationsService } from "../../core/notifications.service";
import {
  CreatePurchaseScheduleDto,
  SchedulePurchaseOrderDto,
  UpdatePurchaseScheduleDto,
} from "../dto/purchase-schedule.dto";

const TIMEZONE = "Europe/Madrid";

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface MadridClockParts {
  dayOfWeek: number;
  hhmm: string;
  dateKey: string;
}

/** Descompone un instante en día/hora/fecha locales de Europe/Madrid (sin dependencias externas). */
export function toMadridParts(date: Date): MadridClockParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // Intl puede devolver "24" a medianoche en formato 24h
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    dayOfWeek: WEEKDAY_INDEX[get("weekday")],
    hhmm: `${hour}:${get("minute")}`,
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

export interface ScheduleClockInput {
  daysOfWeek: number[];
  timeOfDay: string;
  enabled: boolean;
  lastRunAt: Date | null;
}

/** BORRADOR generado por el cron de una programación, aún sin enviar. */
export interface SchedulePendingDraft {
  orderId: string;
  generatedAt: Date;
}

/**
 * Estado "HOY" de una programación para el listado: cuándo correrá, si corre
 * hoy, si ya corrió hoy y si tiene un pedido pendiente de enviar. Todo en
 * reloj Europe/Madrid (el mismo que el cron) para que la UI nunca contradiga
 * al backend.
 */
export interface ScheduleStatus {
  nextRunAt: { dateKey: string; timeOfDay: string } | null;
  runsToday: boolean;
  ranToday: boolean;
  pendingDraft: {
    orderId: string;
    generatedAt: string;
    generatedToday: boolean;
  } | null;
}

const INCLUDE = {
  supplier: { select: { id: true, name: true } },
  list: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
};

@Injectable()
export class PurchaseScheduleService {
  private readonly logger = new Logger(PurchaseScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly purchaseListService: PurchaseListService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * ¿Toca generar el pedido de esta programación ahora? Pura y testeable con
   * un reloj inyectado. No decide el claim de concurrencia (ver runTick).
   */
  static shouldRun(schedule: ScheduleClockInput, now: Date): boolean {
    if (!schedule.enabled) {
      return false;
    }
    const { dayOfWeek, hhmm, dateKey } = toMadridParts(now);
    if (!schedule.daysOfWeek.includes(dayOfWeek)) {
      return false;
    }
    if (hhmm < schedule.timeOfDay) {
      return false;
    }
    if (
      schedule.lastRunAt &&
      toMadridParts(schedule.lastRunAt).dateKey === dateKey
    ) {
      return false; // ya generado hoy
    }
    return true;
  }

  /**
   * Próxima fecha/hora (Europe/Madrid) en que esta programación generará un
   * pedido, o null si nunca correrá (deshabilitada o sin días marcados).
   * Pura y testeable con un reloj inyectado, hermana de shouldRun.
   */
  static getNextRunAt(
    schedule: ScheduleClockInput,
    now: Date,
  ): { dateKey: string; timeOfDay: string } | null {
    if (!schedule.enabled || schedule.daysOfWeek.length === 0) {
      return null;
    }
    const DAY_MS = 24 * 60 * 60 * 1000;
    for (let offset = 0; offset <= 7; offset++) {
      const parts = toMadridParts(new Date(now.getTime() + offset * DAY_MS));
      if (!schedule.daysOfWeek.includes(parts.dayOfWeek)) {
        continue;
      }
      if (offset === 0) {
        if (parts.hhmm >= schedule.timeOfDay) {
          continue; // la hora de hoy ya pasó
        }
        if (
          schedule.lastRunAt &&
          toMadridParts(schedule.lastRunAt).dateKey === parts.dateKey
        ) {
          continue; // ya generado hoy
        }
      }
      return { dateKey: parts.dateKey, timeOfDay: schedule.timeOfDay };
    }
    return null;
  }

  /**
   * Estado HOY de una programación para el listado (ver ScheduleStatus).
   * Pura y testeable con un reloj inyectado, hermana de shouldRun/getNextRunAt.
   */
  static describeSchedule(
    schedule: ScheduleClockInput,
    draft: SchedulePendingDraft | null,
    now: Date,
  ): ScheduleStatus {
    const today = toMadridParts(now).dateKey;
    const next = PurchaseScheduleService.getNextRunAt(schedule, now);
    return {
      nextRunAt: next,
      runsToday: next?.dateKey === today,
      ranToday:
        !!schedule.lastRunAt &&
        toMadridParts(schedule.lastRunAt).dateKey === today,
      pendingDraft: draft && {
        orderId: draft.orderId,
        generatedAt: draft.generatedAt.toISOString(),
        // "Generado hoy" se decide por el día DEL DRAFT, no por lastRunAt:
        // un borrador acumulado de otro día no debe vestirse de hoy.
        generatedToday: toMadridParts(draft.generatedAt).dateKey === today,
      },
    };
  }

  async findAll(tenantId: string) {
    const schedules = await this.prisma.purchaseSchedule.findMany({
      where: { tenantId },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    if (schedules.length === 0) {
      return [];
    }

    // Pedidos BORRADOR generados por el cron, aún sin enviar, para señalizar
    // en cada programación cuál tiene algo pendiente de enviar HOY. El vínculo
    // programación→pedido vive en el payload del evento SCHEDULED_GENERATION
    // (mismo mecanismo que usa el dashboard para anunciarlos).
    const drafts = await this.prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        status: "BORRADOR",
        events: { some: { type: "SCHEDULED_GENERATION" } },
      },
      // Orden explícito para que el último set() del Map sea el borrador más
      // reciente, sin depender del orden de retorno por defecto de la BD.
      orderBy: { createdAt: "asc" },
      include: {
        events: {
          where: { type: "SCHEDULED_GENERATION" },
          select: { payload: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    const draftBySchedule = new Map<string, SchedulePendingDraft>();
    for (const draft of drafts) {
      const scheduleId = (
        draft.events[0]?.payload as { scheduleId?: string } | undefined
      )?.scheduleId;
      if (scheduleId) {
        // Si una misma programación acumula varios borradores sin enviar,
        // gana el más reciente del listado: basta señalizar que hay pendiente.
        draftBySchedule.set(scheduleId, {
          orderId: draft.id,
          generatedAt: draft.createdAt,
        });
      }
    }

    const now = new Date();
    return schedules.map((schedule) => ({
      ...schedule,
      ...PurchaseScheduleService.describeSchedule(
        schedule,
        draftBySchedule.get(schedule.id) ?? null,
        now,
      ),
    }));
  }

  async findOne(tenantId: string, id: string) {
    const schedule = await this.prisma.purchaseSchedule.findFirst({
      where: { id, tenantId },
      include: INCLUDE,
    });
    if (!schedule) {
      throw new NotFoundException("Programación no encontrada");
    }
    return schedule;
  }

  async create(
    tenantId: string,
    userId: string | undefined,
    dto: CreatePurchaseScheduleDto,
  ) {
    await this.assertSupplierOwned(tenantId, dto.supplierId);
    await this.assertListOwned(tenantId, dto.listId);
    if (dto.locationId) {
      await this.assertLocationOwned(tenantId, dto.locationId);
    }
    return this.prisma.purchaseSchedule.create({
      data: {
        tenantId,
        supplierId: dto.supplierId,
        listId: dto.listId,
        locationId: dto.locationId,
        daysOfWeek: dto.daysOfWeek,
        timeOfDay: dto.timeOfDay,
        enabled: dto.enabled ?? true,
        createdBy: userId,
      },
      include: INCLUDE,
    });
  }

  /**
   * Programa pedidos recurrentes usando un pedido existente como plantilla:
   * copia sus artículos de catálogo (y los artículos fuera de catálogo) a una
   * lista de compra nueva y crea la programación sobre esa lista. A partir de
   * ahí es una programación normal: el cron genera un BORRADOR + notificación
   * en cada día/hora, nunca envía nada.
   */
  async createFromOrder(
    tenantId: string,
    userId: string | undefined,
    orderId: string,
    dto: SchedulePurchaseOrderDto,
  ) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id: orderId, tenantId },
      include: { lines: { select: { productId: true, quantity: true } } },
    });
    if (!order) {
      throw new NotFoundException("Pedido no encontrado");
    }
    if (order.lines.length === 0) {
      throw new BadRequestException(
        "El pedido no tiene artículos de catálogo que programar.",
      );
    }

    // PurchaseListItem es único por [listId, productId]: se suman las
    // cantidades si el pedido repite un artículo en varias líneas.
    const quantityByProduct = new Map<string, number>();
    for (const line of order.lines) {
      quantityByProduct.set(
        line.productId,
        (quantityByProduct.get(line.productId) ?? 0) + line.quantity,
      );
    }

    const list = await this.prisma.purchaseList.create({
      data: {
        tenantId,
        name: dto.listName?.trim() || `Pedido ${order.orderNumber}`,
        supplierId: order.supplierId,
        locationId: order.locationId,
        additionalItems: order.additionalItems?.trim() || null,
        items: {
          create: [...quantityByProduct.entries()].map(
            ([productId, quantity], index) => ({
              productId,
              defaultQuantity: quantity,
              sortOrder: index,
            }),
          ),
        },
      },
    });

    return this.prisma.purchaseSchedule.create({
      data: {
        tenantId,
        supplierId: order.supplierId,
        listId: list.id,
        locationId: order.locationId,
        daysOfWeek: dto.daysOfWeek,
        timeOfDay: dto.timeOfDay,
        enabled: true,
        createdBy: userId,
      },
      include: INCLUDE,
    });
  }

  async update(tenantId: string, id: string, dto: UpdatePurchaseScheduleDto) {
    await this.findOne(tenantId, id);
    if (dto.locationId) {
      await this.assertLocationOwned(tenantId, dto.locationId);
    }
    return this.prisma.purchaseSchedule.update({
      where: { id },
      data: {
        locationId: dto.locationId,
        daysOfWeek: dto.daysOfWeek,
        timeOfDay: dto.timeOfDay,
        enabled: dto.enabled,
      },
      include: INCLUDE,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.purchaseSchedule.delete({ where: { id } });
  }

  /**
   * Cron cada 5 min: recorre programaciones activas y genera el pedido
   * BORRADOR de las que tocan ahora. Nunca envía nada al proveedor.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async runTick(): Promise<void> {
    const now = new Date();
    const schedules = await this.prisma.purchaseSchedule.findMany({
      where: { enabled: true },
    });
    for (const schedule of schedules) {
      if (!PurchaseScheduleService.shouldRun(schedule, now)) {
        continue;
      }
      await this.tryGenerate(schedule, now);
    }
  }

  /**
   * Reclama la programación con un compare-and-swap sobre `lastRunAt`: si
   * otro tick concurrente ya la reclamó (o cambió entre la lectura y aquí),
   * `count` sale en 0 y no se duplica el pedido.
   */
  private async tryGenerate(
    schedule: {
      id: string;
      tenantId: string;
      listId: string;
      locationId: string | null;
      lastRunAt: Date | null;
    },
    now: Date,
  ): Promise<void> {
    const claim = await this.prisma.purchaseSchedule.updateMany({
      where: { id: schedule.id, lastRunAt: schedule.lastRunAt },
      data: { lastRunAt: now },
    });
    if (claim.count === 0) {
      return;
    }

    try {
      const order = await this.purchaseListService.generateOrder(
        schedule.tenantId,
        schedule.listId,
        undefined,
        { locationId: schedule.locationId ?? undefined },
      );
      await this.prisma.purchaseOrderEvent.create({
        data: {
          orderId: order.id,
          type: "SCHEDULED_GENERATION",
          payload: { scheduleId: schedule.id },
        },
      });
      await this.notificationsService.createNotification(schedule.tenantId, {
        type: "SCHEDULED_ORDER_GENERATED",
        severity: "INFO",
        title: "Pedido programado generado",
        message: `Pedido ${order.orderNumber} generado para ${order.supplier.name} — revisar y enviar.`,
        entityType: "PURCHASE_ORDER",
        entityId: order.id,
      });
    } catch (error) {
      // Un fallo en una programación no debe tumbar el resto del tick.
      this.logger.error(
        `Fallo generando pedido de la programación ${schedule.id}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async assertSupplierOwned(tenantId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });
    if (!supplier) {
      throw new NotFoundException("Proveedor no encontrado");
    }
  }

  private async assertListOwned(tenantId: string, listId: string) {
    const list = await this.prisma.purchaseList.findFirst({
      where: { id: listId, tenantId },
    });
    if (!list) {
      throw new NotFoundException("Lista de compra no encontrada");
    }
  }

  private async assertLocationOwned(tenantId: string, locationId: string) {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, tenantId },
    });
    if (!location) {
      throw new NotFoundException("Local no encontrado");
    }
  }
}
