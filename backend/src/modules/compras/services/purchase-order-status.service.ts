import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PurchaseOrderStatus } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";

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
  constructor(private readonly prisma: PrismaService) {}

  async transition(
    tenantId: string,
    orderId: string,
    newStatus: PurchaseOrderStatus,
    userId?: string,
    reason?: string,
  ) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id: orderId, tenantId },
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
    return updated;
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
