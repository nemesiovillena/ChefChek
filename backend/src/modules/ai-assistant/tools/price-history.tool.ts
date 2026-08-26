import { PrismaService } from "../../../common/services/prisma.service";
import { ProductsService } from "../../products/products.service";
import { ToolDefinition } from "./tool-definition.interface";

/** "¿Cómo ha ido el precio de X?" — resuelve el producto por nombre (fuzzy) y devuelve su histórico. */
export function createPriceHistoryTool(
  prisma: PrismaService,
  productsService: ProductsService,
): ToolDefinition {
  return {
    name: "get_price_history",
    description:
      "Histórico de precio de un artículo concreto, buscado por nombre.",
    parameters: {
      type: "object",
      properties: {
        productName: {
          type: "string",
          description: "Nombre (o parte del nombre) del artículo",
        },
      },
      required: ["productName"],
    },
    handler: async (tenantId, params) => {
      const matches = await productsService.findNameMatches(
        tenantId,
        params.productName,
      );
      if (matches.length === 0) {
        return {
          error: `No encuentro ningún artículo llamado "${params.productName}".`,
        };
      }
      const product = matches[0];
      const history = await prisma.productPriceHistory.findMany({
        where: { tenantId, productId: product.id },
        include: { supplier: { select: { name: true } } },
        orderBy: { recordedAt: "desc" },
        take: 20,
      });
      return {
        productName: product.name,
        history: history.map((h) => ({
          previousPrice: h.previousPrice,
          newPrice: h.newPrice,
          supplierName: h.supplier?.name ?? "Sin proveedor",
          recordedAt: h.recordedAt.toISOString(),
        })),
      };
    },
  };
}
