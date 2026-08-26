import { PriceAgreementService } from "../../compras/services/price-agreement.service";
import { ToolDefinition } from "./tool-definition.interface";

/** Desviaciones de precio pactado vs recibido aún sin revisar (status PENDIENTE). */
export function createPendingPriceDeviationsTool(
  priceAgreement: PriceAgreementService,
): ToolDefinition {
  return {
    name: "get_pending_price_deviations",
    description:
      "Artículos donde el precio recibido en un albarán/pedido se desvía del precio pactado con el proveedor, y aún no se ha revisado.",
    parameters: { type: "object", properties: {} },
    handler: async (tenantId) => {
      const deviations = await priceAgreement.findAll(tenantId, {
        status: "PENDIENTE" as any,
      });
      return deviations.map((d) => ({
        productName: d.offer.product.name,
        supplierName: d.offer.supplier.name,
        agreedPrice: d.agreedPrice,
        receivedPrice: d.receivedPrice,
        deviationPercent: d.deviationPercent,
        documento:
          d.albaran?.internalNumber ?? d.purchaseOrder?.orderNumber ?? null,
      }));
    },
  };
}
