import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { NotificationsService } from "../../core/notifications.service";
import { PortionCuinerSyncDto } from "../dto/portion-cuiner-sync.dto";
import { roundPortions } from "../util/portion-fifo.util";
import { PortionLedgerService } from "./portion-ledger.service";
import {
  counterLoadSource,
  PortionSettingsService,
} from "./portion-settings.service";

/**
 * Enlace en vivo con el Contador de platos de Cuiner (PostgreSQL del TPV).
 * El conector del servidor de Cuiner, cada minuto:
 *  1. pide lo pendiente (getPending) y escribe en Cuiner las cargas de ChefChek;
 *  2. lee el historial nuevo y lo que marca cada plato, y lo manda (ingest).
 * ChefChek aplica el historial y compara: si no cuadra, avisa una vez.
 */
@Injectable()
export class PortionCuinerSyncService {
  private readonly logger = new Logger(PortionCuinerSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: PortionLedgerService,
    private readonly notifications: NotificationsService,
    private readonly settings: PortionSettingsService,
  ) {}

  async getPending(tenantId: string) {
    if (!(await this.ledger.isEnabled(tenantId))) {
      return { active: false, cursor: null, counters: [] };
    }
    const [config, counters, pushes] = await Promise.all([
      this.prisma.cuinerConfig.findUnique({
        where: { tenantId },
        select: { portionCursor: true },
      }),
      this.prisma.portionCounter.findMany({
        where: { tenantId, active: true, dishes: { some: { tipo: "P" } } },
        select: {
          id: true,
          name: true,
          dishes: {
            where: { tipo: "P" },
            select: { producto: true, portionsPerSale: true, perPiece: true },
          },
        },
      }),
      this.prisma.portionCuinerPush.findMany({
        where: { tenantId, sentAt: null, error: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, counterId: true, quantity: true },
      }),
    ]);
    return {
      active: true,
      cursor: config?.portionCursor ?? null,
      counters: counters.map((c) => {
        const own = pushes.filter((p) => p.counterId === c.id);
        return {
          id: c.id,
          name: c.name,
          dishes: c.dishes,
          pushIds: own.map((p) => p.id),
          pushQuantity: roundPortions(own.reduce((t, p) => t + p.quantity, 0)),
        };
      }),
    };
  }

  async ingest(tenantId: string, dto: PortionCuinerSyncDto) {
    if (!(await this.ledger.isEnabled(tenantId))) {
      return { cursor: null };
    }
    if (dto.baseline !== undefined) {
      // Primer enlace: se empieza en lo último de Cuiner, sin repasar el pasado.
      await this.prisma.cuinerConfig.updateMany({
        where: { tenantId, portionCursor: null },
        data: { portionCursor: dto.baseline },
      });
    }
    for (const result of dto.pushResults ?? []) {
      await this.recordPushResult(tenantId, result);
    }
    let cursor: number | null = null;
    if (dto.cursorFrom !== undefined && dto.cursorTo !== undefined) {
      ({ cursor } = await this.ledger.applyCuinerRegistro(
        tenantId,
        dto.cursorFrom,
        dto.cursorTo,
        dto.rows ?? [],
      ));
    }
    // Solo se compara con una foto tomada justo después del último historial
    // aplicado; si quedaba historial por mandar, la foto va por delante.
    if (dto.snapshot && dto.complete && cursor === dto.cursorTo) {
      await this.compare(tenantId, dto.snapshot);
    }
    const config = await this.prisma.cuinerConfig.findUnique({
      where: { tenantId },
      select: { portionCursor: true },
    });
    return { cursor: config?.portionCursor ?? null };
  }

  private async recordPushResult(
    tenantId: string,
    result: NonNullable<PortionCuinerSyncDto["pushResults"]>[number],
  ) {
    const where = { tenantId, id: { in: result.ids }, sentAt: null };
    if (result.ok) {
      await this.prisma.portionCuinerPush.updateMany({
        where,
        data: { sentAt: new Date(), plato: result.plato ?? null },
      });
      return;
    }
    const error = (result.error ?? "Error desconocido").slice(0, 500);
    const updated = await this.prisma.portionCuinerPush.updateMany({
      where: { ...where, error: null },
      data: { error },
    });
    if (!updated.count) {
      return;
    }
    const counter = await this.prisma.portionCounter.findFirst({
      where: { tenantId, id: result.counterId },
      select: { id: true, name: true },
    });
    if (counter) {
      await this.notifications.createNotification(tenantId, {
        type: "PORTIONS_MISMATCH",
        title: `No se pudo cargar en Cuiner: ${counter.name}`,
        message: `${error} Cárgalo a mano en el Contador de platos de Cuiner.`,
        severity: "HIGH",
        entityType: "portion-counter",
        entityId: counter.id,
      });
    }
  }

  /**
   * Compara cada contador con lo que marca Cuiner. Lo pendiente de escribir
   * en Cuiner no cuenta todavía. Avisa una vez por descuadre y se rearma
   * cuando vuelve a cuadrar.
   */
  private async compare(
    tenantId: string,
    snapshot: NonNullable<PortionCuinerSyncDto["snapshot"]>,
  ) {
    const byPlato = new Map(snapshot.map((s) => [s.plato, s]));
    const [counters, pending] = await Promise.all([
      this.prisma.portionCounter.findMany({
        where: { tenantId, active: true, dishes: { some: { tipo: "P" } } },
        select: {
          id: true,
          name: true,
          cuinerMismatchNotifiedAt: true,
          cuinerCheckedAt: true,
          dishes: { select: { tipo: true, producto: true, perPiece: true } },
        },
      }),
      this.prisma.portionCuinerPush.groupBy({
        by: ["counterId"],
        where: { tenantId, sentAt: null, error: null },
        _sum: { quantity: true },
      }),
    ]);
    const pendingBy = new Map(
      pending.map((p) => [p.counterId, p._sum.quantity ?? 0]),
    );
    const now = new Date();
    const settings = await this.settings.get(tenantId);

    for (const counter of counters) {
      const source = counterLoadSource(settings, counter.dishes);
      const values = counter.dishes
        .filter((d) => d.tipo === "P")
        .map((d) => {
          const s = byPlato.get(d.producto);
          if (!s) {
            return null;
          }
          return d.perPiece
            ? (s.piezas ?? s.quedan ?? null)
            : (s.quedan ?? null);
        })
        .filter((v): v is number => v !== null);
      const cuiner = values.length
        ? roundPortions(values.reduce((t, v) => t + v, 0))
        : null;
      const available = await this.ledger.available(this.prisma, counter.id);
      const expected = roundPortions(
        available - (pendingBy.get(counter.id) ?? 0),
      );
      let mismatch = cuiner !== null && Math.abs(expected - cuiner) > 0.001;
      if (mismatch && source === "TPV") {
        // Se carga en el TPV: manda Cuiner y ChefChek se iguala, sin aviso.
        await this.ledger.alignToCuiner(tenantId, counter.id, cuiner!);
        mismatch = false;
      } else if (mismatch && source === "BOTH" && !counter.cuinerCheckedAt) {
        // Primera vez que se ve en Cuiner (contador recién enlazado): lo que
        // ya marcaba Cuiner se toma tal cual, sin volver a escribirlo allí.
        // Lo pendiente de ChefChek se suma porque aún llegará a Cuiner.
        await this.ledger.alignToCuiner(
          tenantId,
          counter.id,
          cuiner! + (pendingBy.get(counter.id) ?? 0),
        );
        mismatch = false;
      } else if (source === "CHEFCHEK") {
        // Solo en ChefChek: Cuiner no se carga desde aquí; no es un descuadre.
        mismatch = false;
      }

      let notifiedAt = counter.cuinerMismatchNotifiedAt;
      if (mismatch && !notifiedAt) {
        notifiedAt = now;
        await this.notifications.createNotification(tenantId, {
          type: "PORTIONS_MISMATCH",
          title: `No cuadra con Cuiner: ${counter.name}`,
          message: `ChefChek tiene ${expected} y el Contador de platos de Cuiner ${cuiner}. Revisa el historial del contador.`,
          severity: "HIGH",
          entityType: "portion-counter",
          entityId: counter.id,
        });
        this.logger.warn(
          `Descuadre con Cuiner (${tenantId}) ${counter.name}: ChefChek ${expected}, Cuiner ${cuiner}`,
        );
      } else if (!mismatch) {
        notifiedAt = null;
      }
      await this.prisma.portionCounter.update({
        where: { id: counter.id },
        data: {
          cuinerAvailable: cuiner,
          // Solo cuenta como comprobado si Cuiner tiene contador para el plato:
          // así, el día que lo cree, ChefChek toma lo que marque.
          ...(cuiner !== null && { cuinerCheckedAt: now }),
          cuinerMismatchNotifiedAt: notifiedAt,
        },
      });
    }
  }
}
