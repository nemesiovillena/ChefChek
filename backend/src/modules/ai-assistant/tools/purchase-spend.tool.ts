import { PurchaseAnalyticsService } from "../../compras/services/purchase-analytics.service";
import { ToolDefinition } from "./tool-definition.interface";
import { periodStart } from "./period.util";

/** Envuelve PurchaseAnalyticsService.topSpend/bySupplier (ya implementados) para el LLM. */
export function createPurchaseSpendTools(
  purchaseAnalytics: PurchaseAnalyticsService,
): ToolDefinition[] {
  return [
    {
      name: "get_top_spend_products",
      description:
        "Top de artículos por gasto real (€) en un periodo, con % individual y acumulado.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            description:
              "Periodo a consultar (opcional, por defecto todo el histórico)",
            enum: ["week", "month"],
          },
        },
      },
      handler: async (tenantId, params) => {
        const dateFrom = params.period
          ? periodStart(params.period).toISOString()
          : undefined;
        return purchaseAnalytics.topSpend(tenantId, { dateFrom });
      },
    },
    {
      name: "get_supplier_spend",
      description:
        "Gasto total, nº de pedidos, ticket medio y plazo medio de entrega por proveedor en un periodo.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            description:
              "Periodo a consultar (opcional, por defecto todo el histórico)",
            enum: ["week", "month"],
          },
        },
      },
      handler: async (tenantId, params) => {
        const dateFrom = params.period
          ? periodStart(params.period).toISOString()
          : undefined;
        return purchaseAnalytics.bySupplier(tenantId, { dateFrom });
      },
    },
  ];
}
