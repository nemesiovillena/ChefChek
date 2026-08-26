import { WarehousesService } from "../../almacenes/almacenes.service";
import { StockQueryDto } from "../../almacenes/dto/almacenes.dto";
import { ProductsService } from "../../products/products.service";
import { ToolDefinition } from "./tool-definition.interface";

/** Stock bajo y stock de un producto concreto — envuelven WarehousesService.getStock. */
export function createStockTools(
  warehouses: WarehousesService,
  productsService: ProductsService,
): ToolDefinition[] {
  return [
    {
      name: "get_low_stock_products",
      description:
        "Artículos por debajo de su stock mínimo (necesitan reposición).",
      parameters: {
        type: "object",
        properties: {
          warehouseId: {
            type: "string",
            description: "Limitar a un almacén concreto (opcional)",
          },
        },
      },
      handler: async (tenantId, params) => {
        const query = new StockQueryDto();
        query.warehouseId = params.warehouseId;
        query.includeLowStock = true;
        const stocks = await warehouses.getStock(tenantId, query);
        return stocks.map((s: any) => ({
          productName: s.product?.name,
          warehouseName: s.warehouse?.name ?? "Sin almacén",
          quantity: s.quantity,
          minimumStock: s.minimumStock,
        }));
      },
    },
    {
      name: "get_product_stock",
      description:
        "Stock actual de un artículo concreto, buscado por nombre, por almacén.",
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
        const query = new StockQueryDto();
        query.productId = matches[0].id;
        const stocks = await warehouses.getStock(tenantId, query);
        return {
          productName: matches[0].name,
          stockByWarehouse: stocks.map((s: any) => ({
            warehouseName: s.warehouse?.name ?? "Sin almacén",
            quantity: s.quantity,
            availableQuantity: s.availableQuantity,
          })),
        };
      },
    },
  ];
}
