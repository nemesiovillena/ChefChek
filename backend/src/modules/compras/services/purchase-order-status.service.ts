import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PurchaseOrderStatus } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { NotificationsService } from "../../core/notifications.service";
import {
  formatShortfallMessage,
  isOrderLineCovered,
  ShortfallItem,
} from "../utils/order-shortfall.util";

/**
 * Estados desde los que un ADMIN puede forzar la vuelta a BORRADOR (fuera de
 * VALID_TRANSITIONS). Cubre el caso de un pedido marcado ENVIADO/RECIBIDO por
 * error sin que haya habido envío o recepción real.
 */
const REVERTIBLE_STATUSES: PurchaseOrderStatus[] = [
  PurchaseOrderStatus.ENVIADO,
  PurchaseOrderStatus.RECIBIDO_PARCIAL,
  PurchaseOrderStatus.RECIBIDO,
  PurchaseOrderStatus.CANCELADO,
];

/**
 * Máquina de estados del pedido de compra.
 * ENVIADO lo fija normalmente el flujo de envío (Sprint 2), pero se permite
 * marcarlo a mano (envío por teléfono/registro manual).
 */
const VALID_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  BORRADOR: [
    PurchaseOrderStatus.PENDIENTE_ENVIO,
    PurchaseOrderStatus.ENVIADO,
    PurchaseOrderStatus.CANCELADO,
  ],
  PENDIENTE_ENVIO: [
    PurchaseOrderStatus.BORRADOR,
    PurchaseOrderStatus.ENVIADO,
    PurchaseOrderStatus.CANCELADO,
  ],
  ENVIADO: [
    PurchaseOrderStatus.RECIBIDO_PARCIAL,
    PurchaseOrderStatus.RECIBIDO,
    PurchaseOrderStatus.CANCELADO,
  ],
  RECIBIDO_PARCIAL: [PurchaseOrderStatus.RECIBIDO],
  RECIBIDO: [],
  CANCELADO: [],
};

@Injectable()
export class PurchaseOrderStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async transition(
    tenantId: string,
    orderId: string,
    newStatus: PurchaseOrderStatus,
    userId?: string,
    reason?: string,
  ) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id: orderId, tenantId },
      include: { supplier: { select: { name: true } } },
    });
    if (!order) {
      throw new NotFoundException("Pedido no encontrado");
    }

    const allowed = VALID_TRANSITIONS[order.status];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Transición no válida: ${order.status} → ${newStatus}. ` +
          `Permitidas: ${allowed.join(", ") || "ninguna"}`,
      );
    }

    // Marcar la recepción a mano exige albarán vinculado: es quien aporta las
    // cantidades/precios reales al confirmarse (conciliación). Sin él, un
    // "Recibido" directo dejaba el pedido cerrado sin datos y el albarán, al
    // subirse después, ya no podía vincularse (solo se admite/sugiere el
    // vínculo con pedidos ENVIADO/RECIBIDO_PARCIAL). La conciliación siempre
    // llega aquí con su propio albarán vinculado, así que no se ve afectada;
    // y el cierre RECIBIDO_PARCIAL → RECIBIDO tampoco (parte de PARCIAL).
    if (
      order.status === PurchaseOrderStatus.ENVIADO &&
      (newStatus === PurchaseOrderStatus.RECIBIDO ||
        newStatus === PurchaseOrderStatus.RECIBIDO_PARCIAL)
    ) {
      const linkedAlbaranes = await this.prisma.albaran.count({
        where: { purchaseOrderId: orderId },
      });
      if (linkedAlbaranes === 0) {
        throw new BadRequestException(
          "No se puede marcar la recepción sin albarán vinculado: " +
            "sube y vincula primero el albarán del proveedor.",
        );
      }
    }

    const isManualSend =
      newStatus === PurchaseOrderStatus.ENVIADO && !order.sentAt;

    const [updated] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          ...(isManualSend ? { sentAt: new Date(), sentBy: userId } : {}),
        },
      }),
      this.prisma.purchaseOrderEvent.create({
        data: {
          orderId,
          type: "STATUS_CHANGED",
          userId,
          payload: reason
            ? { from: order.status, to: newStatus, reason }
            : { from: order.status, to: newStatus },
        },
      }),
    ]);

    // Aviso inmediato en la campana: no esperar a los 3 días de
    // StalePartialOrderAlertService, el usuario quiere verlo en cuanto pasa.
    if (newStatus === PurchaseOrderStatus.RECIBIDO_PARCIAL) {
      await this.notifyPartialReception(tenantId, orderId);
    }

    return updated;
  }

  /**
   * Aviso de faltas en la campana, con los artículos que faltan.
   * - Sin `missing`: se calcula de lo recibido en las líneas del pedido
   *   (confirmación del albarán o recepción parcial).
   * - Con `missing`: lo que no venía en el albarán al recibir la mercancía.
   * No repite un aviso idéntico del mismo pedido (el de la recepción y el de
   * la confirmación coinciden cuando lo que falta es lo mismo).
   */
  async notifyPartialReception(
    tenantId: string,
    orderId: string,
    missing?: ShortfallItem[],
    title = "Recepción parcial",
  ) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id: orderId, tenantId },
      select: {
        orderNumber: true,
        supplier: { select: { name: true } },
        lines: {
          orderBy: { sortOrder: "asc" },
          select: {
            quantity: true,
            unit: true,
            receivedQuantity: true,
            receivedSourceUnit: true,
            product: { select: { name: true } },
          },
        },
      },
    });
    if (!order) {
      return;
    }
    const items =
      missing ??
      order.lines
        .filter((l) => !isOrderLineCovered(l))
        .map((l) => ({
          name: l.product.name,
          quantity: l.quantity,
          unit: l.unit,
          received: l.receivedQuantity,
        }));
    const message =
      items.length > 0
        ? formatShortfallMessage(order.orderNumber, order.supplier.name, items)
        : `${order.orderNumber} (${order.supplier.name}) se ha recibido parcialmente. ` +
          "Revisa qué falta o cierra el pedido si el proveedor no completará el envío.";

    const alreadySent = await this.prisma.alert.findFirst({
      where: {
        tenantId,
        type: "PARTIAL_ORDER_RECEIVED",
        entityId: orderId,
        message,
      },
      select: { id: true },
    });
    if (alreadySent) {
      return;
    }
    await this.notificationsService.createNotification(tenantId, {
      type: "PARTIAL_ORDER_RECEIVED",
      severity: "WARNING",
      title,
      message,
      entityType: "PURCHASE_ORDER",
      entityId: orderId,
    });
  }

  /**
   * RECIBIDO → ENVIADO, solo para el sistema: deshace el «recibido» que puso
   * un albarán que luego se borró o desvinculó sin confirmarse. Fuera de
   * VALID_TRANSITIONS a propósito: RECIBIDO no tiene salida para el usuario.
   */
  async reopenAsSent(tenantId: string, orderId: string, reason: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id: orderId, tenantId, status: PurchaseOrderStatus.RECIBIDO },
      select: { id: true },
    });
    if (!order) {
      return;
    }
    await this.prisma.$transaction([
      this.prisma.purchaseOrder.update({
        where: { id: orderId },
        data: { status: PurchaseOrderStatus.ENVIADO },
      }),
      this.prisma.purchaseOrderEvent.create({
        data: {
          orderId,
          type: "STATUS_CHANGED",
          payload: {
            from: PurchaseOrderStatus.RECIBIDO,
            to: PurchaseOrderStatus.ENVIADO,
            reason,
          },
        },
      }),
    ]);
  }

  /**
   * Corrección administrativa: fuerza la vuelta a BORRADOR desde un estado
   * que normalmente no tiene salida (ENVIADO/RECIBIDO_PARCIAL/RECIBIDO/
   * CANCELADO). Bloquea si ya hubo recepción real (albarán vinculado o
   * receivedQuantity registrada) para no perder datos de stock.
   */
  async revertToDraft(
    tenantId: string,
    orderId: string,
    userId: string | undefined,
    reason: string,
  ) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id: orderId, tenantId },
    });
    if (!order) {
      throw new NotFoundException("Pedido no encontrado");
    }

    if (!REVERTIBLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        `No aplica revertir desde ${order.status}. Usa la transición normal.`,
      );
    }

    const [albaranesVinculados, lineaRecibida] = await Promise.all([
      this.prisma.albaran.count({ where: { purchaseOrderId: orderId } }),
      this.prisma.purchaseOrderLine.findFirst({
        where: { orderId, receivedQuantity: { not: null } },
      }),
    ]);

    if (albaranesVinculados > 0 || lineaRecibida) {
      throw new ConflictException(
        "No se puede revertir: el pedido tiene recepción o albarán vinculado. Requiere corrección manual.",
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.update({
        where: { id: orderId },
        data: {
          status: PurchaseOrderStatus.BORRADOR,
          sentAt: null,
          sentVia: null,
          sentBy: null,
        },
      }),
      this.prisma.purchaseOrderEvent.create({
        data: {
          orderId,
          type: "STATUS_CHANGED",
          channel: "ADMIN_REVERT",
          userId,
          payload: {
            from: order.status,
            to: PurchaseOrderStatus.BORRADOR,
            reason,
          },
        },
      }),
    ]);
    return updated;
  }
}
