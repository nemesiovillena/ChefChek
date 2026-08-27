import { Injectable, Logger } from "@nestjs/common";
import { LineStatus, PurchaseOrderStatus } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { getUnitMeta } from "../../../common/utils/product-costing.util";
import {
  convertReceivedToOrderUnit,
  ReceptionConversionResult,
} from "../../../common/utils/reception-unit-conversion.util";
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

    const matchedProductIds = [
      ...new Set(
        albaran.lines
          .filter(
            (l) => l.lineStatus === LineStatus.CONFIRMADO && l.matchedProductId,
          )
          .map((l) => l.matchedProductId!),
      ),
    ];
    const products = await this.prisma.product.findMany({
      where: { id: { in: matchedProductIds }, tenantId },
      select: {
        id: true,
        unitsPerFormat: true,
        referenceUnit: true,
        avgUnitWeight: true,
      },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    // Acumular por producto (varias líneas del albarán pueden matchear el
    // mismo producto pedido) antes de tocar la BD, en la magnitud real del
    // albarán (kg/L/ud según facture el proveedor). El pedido pide en su
    // propia unidad ("20 ud" vs "7,4 kg servidos"): sin convertir, un cruce
    // de magnitudes se lee como incidencia grave cuando en realidad cuadra.
    // Una línea con unidad irreconocible arrastra el producto entero al
    // comportamiento histórico (uds ÷ unitsPerFormat).
    const receivedByProduct = new Map<
      string,
      {
        baseQty: number; // total en kg / l / ud de la categoría del albarán
        lastUnit: string | null; // última unidad cruda vista (re-expresa baseQty)
        lastToBase: number; // factor a base de esa unidad
        unitPrice: number; // € por unidad cruda; última entrega manda
        legacyQty: number | null; // suma cruda cuando hay unidades desconocidas
      }
    >();
    for (const line of albaran.lines) {
      if (line.lineStatus !== LineStatus.CONFIRMADO || !line.matchedProductId) {
        continue;
      }
      const acc = receivedByProduct.get(line.matchedProductId) ?? {
        baseQty: 0,
        lastUnit: null,
        lastToBase: 1,
        unitPrice: line.unitPrice,
        legacyQty: null,
      };
      const meta = getUnitMeta(line.unit);
      if (!meta) {
        acc.legacyQty = (acc.legacyQty ?? 0) + line.quantity;
      } else {
        acc.baseQty += line.quantity * meta.toBase;
        acc.lastUnit = line.unit;
        acc.lastToBase = meta.toBase;
      }
      acc.unitPrice = line.unitPrice;
      receivedByProduct.set(line.matchedProductId, acc);
    }
    if (receivedByProduct.size === 0) {
      return;
    }

    // Conversión a la unidad de cada línea de pedido + aprendizaje del peso
    // medio por unidad la primera vez que se cruza ud↔kg/L (ratio de precios).
    const learnedByProduct = new Map<string, number>();
    const updates = order.lines
      .filter((l) => receivedByProduct.has(l.productId))
      .map((l) => {
        // Producto fuera del catálogo visible (borrado lógico, otro tenant…):
        // sin formato conocido, comportamiento histórico plano.
        const product = productById.get(l.productId) ?? {
          unitsPerFormat: 1,
          referenceUnit: null as string | null,
          avgUnitWeight: null as number | null,
        };
        const acc = receivedByProduct.get(l.productId)!;
        const upf = Math.max(product.unitsPerFormat, 1);
        const legacy: ReceptionConversionResult = {
          quantity: (acc.legacyQty ?? acc.baseQty / acc.lastToBase) / upf,
          price: acc.unitPrice * upf,
          sourceQuantity: null,
          sourceUnit: null,
          crossCategory: false,
          learnedWeightPerUnit: null,
        };
        const conv =
          acc.legacyQty === null && acc.lastUnit !== null
            ? (convertReceivedToOrderUnit({
                orderUnit: l.unit ?? product.referenceUnit,
                receivedQuantity: acc.baseQty / acc.lastToBase,
                receivedUnit: acc.lastUnit,
                receivedUnitPrice: acc.unitPrice,
                expectedPrice: l.expectedPrice,
                unitsPerFormat: product.unitsPerFormat,
                avgUnitWeight: product.avgUnitWeight,
              }) ?? legacy)
            : legacy;
        if (
          conv.learnedWeightPerUnit !== null &&
          !learnedByProduct.has(l.productId)
        ) {
          learnedByProduct.set(l.productId, conv.learnedWeightPerUnit);
        }
        return {
          id: l.id,
          receivedQuantity: (l.receivedQuantity ?? 0) + conv.quantity,
          receivedPrice: conv.price,
          receivedSourceQuantity: conv.sourceQuantity,
          receivedSourceUnit: conv.sourceUnit,
        };
      });
    if (updates.length === 0) {
      this.logger.log(
        `Albarán ${albaranId}: ninguna línea coincide con artículos del pedido ${order.orderNumber}`,
      );
      return;
    }

    await this.prisma.$transaction([
      ...updates.map((u) =>
        this.prisma.purchaseOrderLine.update({
          where: { id: u.id },
          data: {
            receivedQuantity: u.receivedQuantity,
            receivedPrice: u.receivedPrice,
            receivedSourceQuantity: u.receivedSourceQuantity,
            receivedSourceUnit: u.receivedSourceUnit,
          },
        }),
      ),
      // Primera vez que se cruza ud↔kg/L: fija el puente para este artículo.
      // Nunca sobrescribe — el util solo deriva cuando avgUnitWeight es null.
      ...[...learnedByProduct].map(([productId, weight]) =>
        this.prisma.product.update({
          where: { id: productId },
          data: { avgUnitWeight: weight },
        }),
      ),
    ]);
    for (const [productId, weight] of learnedByProduct) {
      this.logger.log(
        `Albarán ${albaranId}: peso medio por unidad aprendido para ${productId} → ${weight}`,
      );
    }

    const refreshedLines = await this.prisma.purchaseOrderLine.findMany({
      where: { orderId: order.id },
    });
    const receivedTotal = refreshedLines.reduce(
      (sum, l) => sum + (l.receivedQuantity ?? 0) * (l.receivedPrice ?? 0),
      0,
    );
    // Cobertura con tolerancias: un cruce ud↔kg/L convertido con peso medio
    // aprendido arrastra el redondeo del peso (±10%), y lo pedido a peso
    // nunca llega al gramo exacto (±2%, mismo criterio que la recepción en
    // frontend). Unidades: exacto — no hay "0,3 uds" de sobra.
    const allCovered = refreshedLines.every((l) => {
      const received = l.receivedQuantity ?? 0;
      if (received >= l.quantity) {
        return true;
      }
      const orderMeta = getUnitMeta(l.unit);
      const sourceMeta = getUnitMeta(l.receivedSourceUnit);
      const crossed =
        !!orderMeta &&
        !!sourceMeta &&
        orderMeta.category !== sourceMeta.category;
      const tolerance = crossed
        ? l.quantity * 0.1
        : orderMeta && orderMeta.category !== "unidad"
          ? Math.max(l.quantity * 0.02, 0.01)
          : 0;
      return received >= l.quantity - tolerance;
    });
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
      // Nueva recepción = ya no está "abandonado": resetea el dedup de la
      // alerta de estancados (ver StalePartialOrderAlertService) para que
      // pueda volver a alertar si vuelve a quedarse sin novedad.
      data: { receivedTotal, staleAlertSentAt: null },
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
