import { Injectable, Logger } from "@nestjs/common";
import { LineStatus, PurchaseOrderStatus } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { PurchaseOrderStatusService } from "./purchase-order-status.service";

const SUGGESTION_WINDOW_DAYS = 7;

/**
 * Concilia un albarán con el pedido de compra que recibe (si está vinculado):
 * vuelca cantidad/precio recibido a las líneas del pedido y transiciona su
 * estado a RECIBIDO/RECIBIDO_PARCIAL. Se invoca tras asentar el stock del
 * albarán (albaran-status.service.ts), nunca antes — y es un no-op total si
 * el albarán no tiene purchaseOrderId (flujo de albarán sin pedido intacto).
 */
@Injectable()
export class OrderReconciliationService {
  private readonly logger = new Logger(OrderReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly statusService: PurchaseOrderStatusService,
  ) {}

  /** Pedidos ENVIADOS/RECIBIDO_PARCIAL del proveedor, recientes, para sugerir vínculo. */
  async suggestOrders(
    tenantId: string,
    supplierId: string,
    referenceDate?: Date,
  ) {
    const ref = referenceDate ?? new Date();
    const from = new Date(ref);
    from.setDate(from.getDate() - SUGGESTION_WINDOW_DAYS);
    const to = new Date(ref);
    to.setDate(to.getDate() + SUGGESTION_WINDOW_DAYS);

    return this.prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        supplierId,
        status: {
          in: [
            PurchaseOrderStatus.ENVIADO,
            PurchaseOrderStatus.RECIBIDO_PARCIAL,
          ],
        },
        sentAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        sentAt: true,
        expectedTotal: true,
      },
      orderBy: { sentAt: "desc" },
    });
  }

  /**
   * Vuelca lo recibido en este albarán a las líneas del pedido vinculado y
   * recalcula el estado del pedido. No-op si el albarán no tiene
   * purchaseOrderId o si ninguna línea confirmada tiene contrapartida en el
   * pedido (producto no pedido originalmente).
   */
  async reconcileFromAlbaran(albaranId: string, tenantId: string) {
    const albaran = await this.prisma.albaran.findFirst({
      where: { id: albaranId, tenantId },
      include: { lines: true },
    });
    if (!albaran?.purchaseOrderId) {
      return;
    }

    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id: albaran.purchaseOrderId, tenantId },
      include: { lines: true },
    });
    if (!order) {
      this.logger.warn(
        `Albarán ${albaranId}: pedido vinculado ${albaran.purchaseOrderId} no encontrado`,
      );
      return;
    }

    // Acumular por producto (varias líneas del albarán pueden matchear el
    // mismo producto pedido) antes de tocar la BD.
    const receivedByProduct = new Map<
      string,
      { quantity: number; price: number }
    >();
    for (const line of albaran.lines) {
      if (line.lineStatus !== LineStatus.CONFIRMADO || !line.matchedProductId) {
        continue;
      }
      const acc = receivedByProduct.get(line.matchedProductId) ?? {
        quantity: 0,
        price: line.unitPrice,
      };
      acc.quantity += line.quantity;
      acc.price = line.unitPrice; // última entrega manda como precio recibido
      receivedByProduct.set(line.matchedProductId, acc);
    }
    if (receivedByProduct.size === 0) {
      return;
    }

    const updates = order.lines
      .filter((l) => receivedByProduct.has(l.productId))
      .map((l) => {
        const received = receivedByProduct.get(l.productId)!;
        return {
          id: l.id,
          receivedQuantity: (l.receivedQuantity ?? 0) + received.quantity,
          receivedPrice: received.price,
        };
      });
    if (updates.length === 0) {
      this.logger.log(
        `Albarán ${albaranId}: ninguna línea coincide con artículos del pedido ${order.orderNumber}`,
      );
      return;
    }

    await this.prisma.$transaction(
      updates.map((u) =>
        this.prisma.purchaseOrderLine.update({
          where: { id: u.id },
          data: {
            receivedQuantity: u.receivedQuantity,
            receivedPrice: u.receivedPrice,
          },
        }),
      ),
    );

    const refreshedLines = await this.prisma.purchaseOrderLine.findMany({
      where: { orderId: order.id },
    });
    const receivedTotal = refreshedLines.reduce(
      (sum, l) => sum + (l.receivedQuantity ?? 0) * (l.receivedPrice ?? 0),
      0,
    );
    const allCovered = refreshedLines.every(
      (l) => (l.receivedQuantity ?? 0) >= l.quantity,
    );
    const anyReceived = refreshedLines.some(
      (l) => (l.receivedQuantity ?? 0) > 0,
    );
    const newStatus = allCovered
      ? PurchaseOrderStatus.RECIBIDO
      : anyReceived
        ? PurchaseOrderStatus.RECIBIDO_PARCIAL
        : order.status;

    await this.prisma.purchaseOrder.update({
      where: { id: order.id },
      data: { receivedTotal },
    });

    if (newStatus !== order.status) {
      await this.statusService.transition(
        tenantId,
        order.id,
        newStatus,
        undefined, // transición del sistema, no de un usuario
      );
    }

    this.logger.log(
      `Albarán ${albaranId}: conciliado con pedido ${order.orderNumber} → ${newStatus}`,
    );
  }
}
