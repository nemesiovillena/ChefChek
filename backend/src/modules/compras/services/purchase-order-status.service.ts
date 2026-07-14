import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PurchaseOrderStatus } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";

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
          payload: { from: order.status, to: newStatus },
        },
      }),
    ]);
    return updated;
  }
}
