import { PurchaseAnalyticsService } from "../../compras/services/purchase-analytics.service";
import { ToolDefinition } from "./tool-definition.interface";
import { periodStart } from "./period.util";

/**
 * "¿Qué producto se compró más la última semana?" — cantidad recibida y
 * conciliada (PurchaseOrderLine.receivedQuantity), mismo dominio que el
 * resto de PurchaseAnalyticsService (ver plan.md Validation Log).
 */
export function createTopPurchasedProductsTool(
  purchaseAnalytics: PurchaseAnalyticsService,
): ToolDefinition {
  return {
    name: "get_top_purchased_products",
    description:
      "Producto(s) más comprados por cantidad (unidades recibidas) en la última semana o mes.",
    parameters: {
      type: "object",
      properties: {
        period: {
          type: "string",
          description: "Periodo a consultar",
          enum: ["week", "month"],
        },
        limit: {
          type: "string",
          description: "Cuántos productos devolver (por defecto 5)",
        },
      },
      required: ["period"],
    },
    handler: async (tenantId, params) => {
      const from = periodStart(params.period);
      const limit = params.limit ? Number(params.limit) : 5;
      return purchaseAnalytics.topPurchasedByQuantity(
        tenantId,
        { dateFrom: from.toISOString() },
        Number.isFinite(limit) && limit > 0 ? limit : 5,
      );
    },
  };
}
