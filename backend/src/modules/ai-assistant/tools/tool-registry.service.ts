import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { PurchaseAnalyticsService } from "../../compras/services/purchase-analytics.service";
import { PriceAgreementService } from "../../compras/services/price-agreement.service";
import { ProductsService } from "../../products/products.service";
import { RecipesService } from "../../recipes/recipes.service";
import { WarehousesService } from "../../almacenes/almacenes.service";
import { ToolDefinition } from "./tool-definition.interface";
import { createPriceIncreasesTool } from "./price-increases.tool";
import { createTopPurchasedProductsTool } from "./top-purchased-products.tool";
import { createPurchaseSpendTools } from "./purchase-spend.tool";
import { createPriceHistoryTool } from "./price-history.tool";
import { createPendingPriceDeviationsTool } from "./pending-price-deviations.tool";
import { createRecipeCostTool } from "./recipe-cost.tool";
import { createStockTools } from "./stock.tool";

/**
 * Registro central de tools que el asistente Chefchek puede invocar.
 * `tenantId` SIEMPRE lo inyecta `executeTool`, nunca viene del LLM — el
 * JSON schema de cada tool (ver `getToolSchemas`) no incluye `tenantId`.
 */
@Injectable()
export class ToolRegistryService {
  private readonly tools: ToolDefinition[];

  constructor(
    prisma: PrismaService,
    purchaseAnalytics: PurchaseAnalyticsService,
    priceAgreement: PriceAgreementService,
    productsService: ProductsService,
    recipesService: RecipesService,
    warehouses: WarehousesService,
  ) {
    this.tools = [
      createPriceIncreasesTool(prisma),
      createTopPurchasedProductsTool(purchaseAnalytics),
      ...createPurchaseSpendTools(purchaseAnalytics),
      createPriceHistoryTool(prisma, productsService),
      createPendingPriceDeviationsTool(priceAgreement),
      createRecipeCostTool(recipesService),
      ...createStockTools(warehouses, productsService),
    ];
  }

  getToolSchemas(): Array<
    Pick<ToolDefinition, "name" | "description" | "parameters">
  > {
    return this.tools.map(({ name, description, parameters }) => ({
      name,
      description,
      parameters,
    }));
  }

  async executeTool(
    tenantId: string,
    name: string,
    params: Record<string, any>,
  ): Promise<unknown> {
    const tool = this.tools.find((t) => t.name === name);
    if (!tool) {
      throw new BadRequestException(`Tool desconocida: "${name}"`);
    }
    return tool.handler(tenantId, params ?? {});
  }
}
