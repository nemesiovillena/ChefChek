import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../../common/services/prisma.service";
import { PurchaseListService } from "./purchase-list.service";
import { NotificationsService } from "../../core/notifications.service";
import {
  CreatePurchaseScheduleDto,
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
function toMadridParts(date: Date): MadridClockParts {
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

  async findAll(tenantId: string) {
    return this.prisma.purchaseSchedule.findMany({
      where: { tenantId },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
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
