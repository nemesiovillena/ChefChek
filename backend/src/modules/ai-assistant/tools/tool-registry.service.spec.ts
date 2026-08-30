import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { ToolRegistryService } from "./tool-registry.service";
import { PrismaService } from "../../../common/services/prisma.service";
import { PurchaseAnalyticsService } from "../../compras/services/purchase-analytics.service";
import { PriceAgreementService } from "../../compras/services/price-agreement.service";
import { ProductsService } from "../../products/products.service";
import { RecipesService } from "../../recipes/recipes.service";
import { WarehousesService } from "../../almacenes/almacenes.service";
import { LotService } from "../../albaranes/services/lot.service";

/**
 * Datos por tenant, para verificar que executeTool nunca cruza tenants aunque
 * dos tenants tengan filas con el mismo shape (mismo productId/supplierId).
 */
const TENANT_DATA: Record<string, any[]> = {
  t1: [
    {
      id: "pph-1",
      tenantId: "t1",
      productId: "shared-id",
      previousPrice: 10,
      newPrice: 12,
      recordedAt: new Date("2026-08-20"),
      product: { name: "Salmón (t1)" },
      supplier: { id: "s1", name: "Proveedor T1" },
    },
  ],
  t2: [
    {
      id: "pph-2",
      tenantId: "t2",
      productId: "shared-id",
      previousPrice: 5,
      newPrice: 4, // bajada, no debe aparecer como subida
      recordedAt: new Date("2026-08-20"),
      product: { name: "Salmón (t2)" },
      supplier: { id: "s2", name: "Proveedor T2" },
    },
  ],
};

describe("ToolRegistryService", () => {
  let service: ToolRegistryService;
  let prismaMock: any;
  let purchaseAnalyticsMock: any;
  let priceAgreementMock: any;
  let productsMock: any;
  let recipesMock: any;
  let warehousesMock: any;
  let lotServiceMock: any;

  beforeEach(async () => {
    prismaMock = {
      productPriceHistory: {
        findMany: jest.fn(({ where }: any) =>
          Promise.resolve(
            (TENANT_DATA[where.tenantId] ?? []).filter(
              (r) => !where.supplierId || r.supplier.id === where.supplierId,
            ),
          ),
        ),
      },
    };
    purchaseAnalyticsMock = {
      topPurchasedByQuantity: jest.fn().mockResolvedValue([]),
      topSpend: jest.fn().mockResolvedValue([]),
      bySupplier: jest.fn().mockResolvedValue([]),
    };
    priceAgreementMock = { findAll: jest.fn().mockResolvedValue([]) };
    productsMock = {
      findNameMatches: jest.fn().mockResolvedValue([]),
      searchByNameLoose: jest.fn().mockResolvedValue([]),
    };
    recipesMock = {
      findNameMatches: jest.fn().mockResolvedValue([]),
      calculateRecipeCost: jest.fn(),
    };
    warehousesMock = { getStock: jest.fn().mockResolvedValue([]) };
    lotServiceMock = { findLots: jest.fn().mockResolvedValue([]) };

    const module = await Test.createTestingModule({
      providers: [
        ToolRegistryService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PurchaseAnalyticsService, useValue: purchaseAnalyticsMock },
        { provide: PriceAgreementService, useValue: priceAgreementMock },
        { provide: ProductsService, useValue: productsMock },
        { provide: RecipesService, useValue: recipesMock },
        { provide: WarehousesService, useValue: warehousesMock },
        { provide: LotService, useValue: lotServiceMock },
      ],
    }).compile();
    service = module.get(ToolRegistryService);
  });

  it("expone 10 tools con schema sin tenantId en las propiedades", () => {
    const schemas = service.getToolSchemas();
    expect(schemas).toHaveLength(10);
    for (const schema of schemas) {
      expect(schema.parameters.properties).not.toHaveProperty("tenantId");
      expect(schema.parameters.required ?? []).not.toContain("tenantId");
    }
  });

  it("rechaza (no crashea) un nombre de tool desconocido", async () => {
    await expect(service.executeTool("t1", "no_existe", {})).rejects.toThrow(
      BadRequestException,
    );
  });

  describe("gating por coste (recipes.cost)", () => {
    const COST_TOOLS = [
      "get_recipe_cost",
      "get_price_history",
      "get_price_increases",
      "get_top_spend_products",
      "get_supplier_spend",
      "get_pending_price_deviations",
    ];

    it("omite las tools de coste del schema cuando canViewCosts=false", () => {
      const names = service
        .getToolSchemas({ canViewCosts: false })
        .map((s) => s.name);
      for (const t of COST_TOOLS) {
        expect(names).not.toContain(t);
      }
      // las no monetarias siguen expuestas
      expect(names).toContain("get_top_purchased_products");
      expect(names).toContain("get_low_stock_products");
      expect(names).toContain("get_product_stock");
      expect(names).toContain("get_lot_traceability");
    });

    it("mantiene las 10 tools cuando canViewCosts=true (default)", () => {
      expect(service.getToolSchemas({ canViewCosts: true })).toHaveLength(10);
      expect(service.getToolSchemas()).toHaveLength(10);
    });

    it("executeTool rechaza una tool de coste cuando canViewCosts=false", async () => {
      await expect(
        service.executeTool(
          "t1",
          "get_recipe_cost",
          { recipeName: "x" },
          { canViewCosts: false },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("executeTool permite una tool no monetaria cuando canViewCosts=false", async () => {
      await expect(
        service.executeTool(
          "t1",
          "get_top_purchased_products",
          { period: "week" },
          { canViewCosts: false },
        ),
      ).resolves.toBeDefined();
    });
  });

  it("get_price_increases: tenant A nunca ve datos de tenant B con el mismo productId", async () => {
    const resultT1 = (await service.executeTool("t1", "get_price_increases", {
      period: "week",
    })) as any[];
    const resultT2 = (await service.executeTool("t2", "get_price_increases", {
      period: "week",
    })) as any[];

    expect(resultT1).toHaveLength(1);
    expect(resultT1[0].productName).toBe("Salmón (t1)");
    // t2 tiene una bajada de precio, no una subida -> no debe aparecer
    expect(resultT2).toHaveLength(0);
  });

  describe("get_lot_traceability", () => {
    it("está disponible aunque canViewCosts=false (el lote no es dato monetario)", async () => {
      lotServiceMock.findLots.mockResolvedValueOnce([
        {
          productName: "CR.AÑOJO FRES LOMO ALTO",
          lotNumber: "A1",
          supplierName: "Mar Menor",
          albaranNumber: "12345",
          albaranInternalNumber: "000123",
          albaranDate: "2026-08-24T00:00:00.000Z",
          quantity: 3,
          unit: "kg",
          expiryDate: null,
          source: "lot_record",
        },
      ]);
      productsMock.searchByNameLoose.mockResolvedValueOnce([
        { id: "p1", name: "CR.AÑOJO FRES LOMO ALTO" },
      ]);

      const res = (await service.executeTool(
        "t1",
        "get_lot_traceability",
        { productName: "lomo alto añojo", supplierName: "Mar Menor" },
        { canViewCosts: false },
      )) as any;

      expect(res.lotes).toHaveLength(1);
      expect(res.lotes[0]).not.toHaveProperty("source");
      expect(lotServiceMock.findLots).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: "t1", productIds: ["p1"] }),
      );
    });

    it("pide artículo o lote si no se da ninguno", async () => {
      const res = (await service.executeTool(
        "t1",
        "get_lot_traceability",
        {},
      )) as any;
      expect(res.error).toMatch(/artículo o el número de lote/i);
      expect(lotServiceMock.findLots).not.toHaveBeenCalled();
    });
  });

  it("get_top_purchased_products inyecta tenantId al servicio subyacente, no al LLM", async () => {
    await service.executeTool("t1", "get_top_purchased_products", {
      period: "week",
    });
    expect(purchaseAnalyticsMock.topPurchasedByQuantity).toHaveBeenCalledWith(
      "t1",
      expect.any(Object),
      expect.any(Number),
    );
  });

  it("get_recipe_cost devuelve error legible si no encuentra la receta (no crashea)", async () => {
    const result = (await service.executeTool("t1", "get_recipe_cost", {
      recipeName: "Receta inexistente",
    })) as any;
    expect(result.error).toContain("No encuentro");
    expect(recipesMock.calculateRecipeCost).not.toHaveBeenCalled();
  });

  it("get_product_stock resuelve por nombre antes de consultar stock", async () => {
    productsMock.findNameMatches.mockResolvedValueOnce([
      { id: "p1", name: "Harina", isActive: true },
    ]);
    await service.executeTool("t1", "get_product_stock", {
      productName: "harina",
    });
    expect(warehousesMock.getStock).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ productId: "p1" }),
    );
  });
});
