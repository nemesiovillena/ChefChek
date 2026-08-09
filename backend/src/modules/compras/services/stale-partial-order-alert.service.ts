import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PurchaseOrderStatus } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { NotificationsService } from "../../core/notifications.service";

/** Días sin actividad en RECIBIDO_PARCIAL antes de considerarlo estancado. */
const STALE_PARTIAL_ORDER_DAYS = 3;

/**
 * Alerta pedidos en RECIBIDO_PARCIAL que llevan STALE_PARTIAL_ORDER_DAYS sin
 * actividad (sin nueva recepción conciliada) — el caso del proveedor que
 * nunca envía el resto. Dedup vía `staleAlertSentAt`, reseteado a null por
 * OrderReconciliationService en cuanto vuelve a haber recepción.
 */
@Injectable()
export class StalePartialOrderAlertService {
  private readonly logger = new Logger(StalePartialOrderAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkStaleOrders(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - STALE_PARTIAL_ORDER_DAYS);

    const staleOrders = await this.prisma.purchaseOrder.findMany({
      where: {
        status: PurchaseOrderStatus.RECIBIDO_PARCIAL,
        staleAlertSentAt: null,
        updatedAt: { lte: cutoff },
        deletedAt: null,
      },
      include: { supplier: { select: { name: true } } },
    });

    for (const order of staleOrders) {
      try {
        await this.notificationsService.createNotification(order.tenantId, {
          type: "STALE_PARTIAL_ORDER",
          severity: "WARNING",
          title: "Pedido parcial sin novedad",
          message: `${order.orderNumber} (${order.supplier.name}) lleva ${STALE_PARTIAL_ORDER_DAYS}+ días en Recibido parcial sin recepción nueva. Revisa si hay que cerrarlo o reclamar al proveedor.`,
        });
        await this.prisma.purchaseOrder.update({
          where: { id: order.id },
          data: { staleAlertSentAt: new Date() },
        });
      } catch (error) {
        // Un fallo en un pedido no debe tumbar el resto del tick.
        this.logger.error(
          `Fallo notificando pedido estancado ${order.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }
}
