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
import { createLotTraceabilityTool } from "./lot-traceability.tool";
import { LotService } from "../../albaranes/services/lot.service";

/**
 * Tools that surface monetary figures (€): recipe cost, purchase spend, price
 * history / increases, pending price deviations. Hidden and refused for roles
 * without the `recipes.cost` section.
 */
export const AI_COST_TOOL_NAMES: ReadonlySet<string> = new Set([
  "get_recipe_cost",
  "get_price_history",
  "get_price_increases",
  "get_top_spend_products",
  "get_supplier_spend",
  "get_pending_price_deviations",
]);

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
    lotService: LotService,
  ) {
    this.tools = [
      createPriceIncreasesTool(prisma),
      createTopPurchasedProductsTool(purchaseAnalytics),
      ...createPurchaseSpendTools(purchaseAnalytics),
      createPriceHistoryTool(prisma, productsService),
      createPendingPriceDeviationsTool(priceAgreement),
      createRecipeCostTool(recipesService),
      ...createStockTools(warehouses, productsService),
      createLotTraceabilityTool(lotService, productsService),
    ];
  }

  getToolSchemas(
    opts: { canViewCosts?: boolean } = {},
  ): Array<Pick<ToolDefinition, "name" | "description" | "parameters">> {
    const canViewCosts = opts.canViewCosts ?? true;
    return this.tools
      .filter((t) => canViewCosts || !AI_COST_TOOL_NAMES.has(t.name))
      .map(({ name, description, parameters }) => ({
        name,
        description,
        parameters,
      }));
  }

  async executeTool(
    tenantId: string,
    name: string,
    params: Record<string, any>,
    opts: { canViewCosts?: boolean } = {},
  ): Promise<unknown> {
    const canViewCosts = opts.canViewCosts ?? true;
    if (!canViewCosts && AI_COST_TOOL_NAMES.has(name)) {
      throw new BadRequestException(
        `El rol actual no tiene acceso a datos de coste ("${name}").`,
      );
    }
    const tool = this.tools.find((t) => t.name === name);
    if (!tool) {
      throw new BadRequestException(`Tool desconocida: "${name}"`);
    }
    return tool.handler(tenantId, params ?? {});
  }
}
