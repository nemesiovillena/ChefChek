import { PrismaService } from "../../../common/services/prisma.service";
import { ToolDefinition } from "./tool-definition.interface";
import { periodStart } from "./period.util";

/**
 * "¿Quién me ha subido precios este mes/semana?" — usa ProductPriceHistory
 * (NO SupplierPriceHistory, que solo guarda un precio medio sin antes/después,
 * ver plan.md Validation Log). El middleware de soft-delete de PrismaService
 * ya excluye productos/proveedores borrados en `findMany` normal.
 */
export function createPriceIncreasesTool(
  prisma: PrismaService,
): ToolDefinition {
  return {
    name: "get_price_increases",
    description:
      "Lista qué proveedores han subido el precio de qué artículos en la última semana o mes, con el % de subida.",
    parameters: {
      type: "object",
      properties: {
        period: {
          type: "string",
          description: "Periodo a consultar",
          enum: ["week", "month"],
        },
        supplierId: {
          type: "string",
          description: "Limitar a un proveedor concreto (opcional)",
        },
      },
      required: ["period"],
    },
    handler: async (tenantId, params) => {
      const from = periodStart(params.period);
      const rows = await prisma.productPriceHistory.findMany({
        where: {
          tenantId,
          recordedAt: { gte: from },
          ...(params.supplierId ? { supplierId: params.supplierId } : {}),
        },
        include: {
          product: { select: { name: true } },
          supplier: { select: { id: true, name: true } },
        },
        orderBy: { recordedAt: "desc" },
      });

      const increases = rows.filter((r) => r.newPrice > r.previousPrice);
      return increases.map((r) => ({
        productName: r.product.name,
        supplierName: r.supplier?.name ?? "Sin proveedor",
        previousPrice: r.previousPrice,
        newPrice: r.newPrice,
        increasePercent:
          r.previousPrice > 0
            ? Math.round(
                ((r.newPrice - r.previousPrice) / r.previousPrice) * 1000,
              ) / 10
            : null,
        recordedAt: r.recordedAt.toISOString(),
      }));
    },
  };
}
