import { Test, TestingModule } from "@nestjs/testing";
import { AllergensController } from "./allergens.controller";
import { AllergensService } from "./allergens.service";
import { ALLERGENS_INFO } from "./dto/allergens.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard } from "../../guards/module.guard";

describe("AllergensController", () => {
  let controller: AllergensController;

  const mockAllergensService = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    getAllergensInfo: jest.fn(),
    updateProductAllergens: jest.fn(),
    calculateRecipeAllergens: jest.fn(),
    calculateMenuAllergens: jest.fn(),
    detectAllergenConflicts: jest.fn(),
    generateComplianceReport: jest.fn(),
    getProductsWithAllergens: jest.fn(),
    getRecipesWithAllergens: jest.fn(),
    getMenusWithAllergens: jest.fn(),
    recalculateAllAllergensForTenant: jest.fn(),
  };

  const mockReq = {
    tenantId: "tenant-1",
    user: { id: "user-1", role: "ADMIN" },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AllergensController],
      providers: [
        { provide: AllergensService, useValue: mockAllergensService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ModuleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AllergensController>(AllergensController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getAllergensInfo", () => {
    it("should return allergens info successfully", async () => {
      mockAllergensService.getAllergensInfo.mockResolvedValue(ALLERGENS_INFO);

      const result = await controller.getAllergensInfo();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(ALLERGENS_INFO);
      expect(mockAllergensService.getAllergensInfo).toHaveBeenCalled();
    });

    it("should return empty array if no allergens info", async () => {
      mockAllergensService.getAllergensInfo.mockResolvedValue([]);

      const result = await controller.getAllergensInfo();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe("updateProductAllergens", () => {
    it("should update product allergens successfully", async () => {
      const productId = "product-1";
      const dto = { allergens: [1, 3, 5] };
      const expectedResult = {
        success: true,
        data: { id: productId, name: "Test Product", allergens: dto.allergens },
      };

      mockAllergensService.updateProductAllergens.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.updateProductAllergens(
        mockReq,
        productId,
        dto,
      );

      expect(result).toEqual(expectedResult);
      expect(mockAllergensService.updateProductAllergens).toHaveBeenCalledWith(
        mockReq.tenantId,
        productId,
        dto,
      );
    });

    it("should handle product not found error", async () => {
      const productId = "non-existent";
      const dto = { allergens: [1] };

      mockAllergensService.updateProductAllergens.mockRejectedValue(
        new Error("Product not found"),
      );

      await expect(
        controller.updateProductAllergens(mockReq, productId, dto),
      ).rejects.toThrow("Product not found");
    });
  });

  describe("calculateRecipeAllergens", () => {
    it("should calculate recipe allergens successfully", async () => {
      const recipeId = "recipe-1";
      const calculatedAllergens = [1, 2, 3];

      mockAllergensService.calculateRecipeAllergens.mockResolvedValue(
        calculatedAllergens,
      );

      const result = await controller.calculateRecipeAllergens(
        mockReq,
        recipeId,
      );

      expect(result.success).toBe(true);
      expect(result.data.recipeId).toBe(recipeId);
      expect(result.data.allergens).toEqual(calculatedAllergens);
      expect(
        mockAllergensService.calculateRecipeAllergens,
      ).toHaveBeenCalledWith(mockReq.tenantId, recipeId);
    });

    it("should return empty array if no allergens found", async () => {
      const recipeId = "recipe-2";

      mockAllergensService.calculateRecipeAllergens.mockResolvedValue([]);

      const result = await controller.calculateRecipeAllergens(
        mockReq,
        recipeId,
      );

      expect(result.success).toBe(true);
      expect(result.data.allergens).toEqual([]);
    });
  });

  describe("calculateMenuAllergens", () => {
    it("should calculate menu allergens successfully", async () => {
      const menuId = "menu-1";
      const calculatedAllergens = [1, 3, 7];

      mockAllergensService.calculateMenuAllergens.mockResolvedValue(
        calculatedAllergens,
      );

      const result = await controller.calculateMenuAllergens(mockReq, menuId);

      expect(result.success).toBe(true);
      expect(result.data.menuId).toBe(menuId);
      expect(result.data.allergens).toEqual(calculatedAllergens);
      expect(mockAllergensService.calculateMenuAllergens).toHaveBeenCalledWith(
        mockReq.tenantId,
        menuId,
      );
    });
  });

  describe("detectAllergenConflicts", () => {
    it("should detect allergen conflicts successfully", async () => {
      const menuId = "menu-1";
      const body = { filteredAllergens: [1, 2] };
      const conflicts = [
        { recipeId: "recipe-1", filteredAllergens: [1] },
        { recipeId: "recipe-2", filteredAllergens: [2] },
      ];

      mockAllergensService.detectAllergenConflicts.mockResolvedValue(conflicts);

      const result = await controller.detectAllergenConflicts(
        mockReq,
        menuId,
        body,
      );

      expect(result.success).toBe(true);
      expect(result.data.menuId).toBe(menuId);
      expect(result.data.filteredAllergens).toEqual(body.filteredAllergens);
      expect(result.data.conflicts).toEqual(conflicts);
      expect(mockAllergensService.detectAllergenConflicts).toHaveBeenCalledWith(
        mockReq.tenantId,
        menuId,
        body.filteredAllergens,
      );
    });

    it("should return empty conflicts array if no conflicts found", async () => {
      const menuId = "menu-2";
      const body = { filteredAllergens: [99] };

      mockAllergensService.detectAllergenConflicts.mockResolvedValue([]);

      const result = await controller.detectAllergenConflicts(
        mockReq,
        menuId,
        body,
      );

      expect(result.success).toBe(true);
      expect(result.data.conflicts).toEqual([]);
    });
  });

  describe("getComplianceReport", () => {
    it("should generate compliance report with FULL type by default", async () => {
      const menuId = "menu-1";
      const report = {
        menuId,
        reportType: "FULL",
        missingDeclarations: ["product-1"],
      };

      mockAllergensService.generateComplianceReport.mockResolvedValue(report);

      const result = await controller.getComplianceReport(mockReq, menuId, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual(report);
      expect(
        mockAllergensService.generateComplianceReport,
      ).toHaveBeenCalledWith(mockReq.tenantId, menuId, "FULL");
    });

    it("should generate compliance report with SUMMARY type", async () => {
      const menuId = "menu-1";
      const body = { reportType: "SUMMARY" as const };
      const report = {
        menuId,
        reportType: "SUMMARY",
        missingDeclarations: [],
      };

      mockAllergensService.generateComplianceReport.mockResolvedValue(report);

      const result = await controller.getComplianceReport(
        mockReq,
        menuId,
        body,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(report);
      expect(
        mockAllergensService.generateComplianceReport,
      ).toHaveBeenCalledWith(mockReq.tenantId, menuId, "SUMMARY");
    });
  });

  describe("getProductsWithAllergens", () => {
    it("should return all products with allergens", async () => {
      const products = [
        { id: "product-1", name: "Product 1", allergens: [1, 2] },
        { id: "product-2", name: "Product 2", allergens: [3] },
      ];

      mockAllergensService.getProductsWithAllergens.mockResolvedValue(products);

      const result = await controller.getProductsWithAllergens(mockReq);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(products);
      expect(
        mockAllergensService.getProductsWithAllergens,
      ).toHaveBeenCalledWith(mockReq.tenantId, []);
    });
  });

  describe("getProductsWithSpecificAllergens", () => {
    it("should return products filtered by allergen IDs", async () => {
      const allergenIds = "1,3,5";
      const ids = [1, 3, 5];
      const products = [
        { id: "product-1", name: "Product 1", allergens: [1] },
        { id: "product-2", name: "Product 2", allergens: [3, 5] },
      ];

      mockAllergensService.getProductsWithAllergens.mockResolvedValue(products);

      const result = await controller.getProductsWithSpecificAllergens(
        mockReq,
        allergenIds,
      );

      expect(result.success).toBe(true);
      expect(result.data.allergenIds).toEqual(ids);
      expect(result.data.products).toEqual(products);
      expect(
        mockAllergensService.getProductsWithAllergens,
      ).toHaveBeenCalledWith(mockReq.tenantId, ids);
    });

    it("should handle single allergen ID", async () => {
      const allergenIds = "7";
      const ids = [7];
      const products = [{ id: "product-1", name: "Product 1", allergens: [7] }];

      mockAllergensService.getProductsWithAllergens.mockResolvedValue(products);

      const result = await controller.getProductsWithSpecificAllergens(
        mockReq,
        allergenIds,
      );

      expect(result.data.allergenIds).toEqual(ids);
    });
  });

  describe("getRecipesWithAllergens", () => {
    it("should return all recipes with allergens", async () => {
      const recipes = [
        { id: "recipe-1", name: "Recipe 1", allergens: [1, 2, 3] },
        { id: "recipe-2", name: "Recipe 2", allergens: [4] },
      ];

      mockAllergensService.getRecipesWithAllergens.mockResolvedValue(recipes);

      const result = await controller.getRecipesWithAllergens(mockReq);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(recipes);
      expect(mockAllergensService.getRecipesWithAllergens).toHaveBeenCalledWith(
        mockReq.tenantId,
        [],
      );
    });
  });

  describe("getRecipesWithSpecificAllergens", () => {
    it("should return recipes filtered by allergen IDs", async () => {
      const allergenIds = "2,4";
      const ids = [2, 4];
      const recipes = [
        { id: "recipe-1", name: "Recipe 1", allergens: [2] },
        { id: "recipe-2", name: "Recipe 2", allergens: [4] },
      ];

      mockAllergensService.getRecipesWithAllergens.mockResolvedValue(recipes);

      const result = await controller.getRecipesWithSpecificAllergens(
        mockReq,
        allergenIds,
      );

      expect(result.success).toBe(true);
      expect(result.data.allergenIds).toEqual(ids);
      expect(result.data.recipes).toEqual(recipes);
      expect(mockAllergensService.getRecipesWithAllergens).toHaveBeenCalledWith(
        mockReq.tenantId,
        ids,
      );
    });
  });

  describe("getMenusWithAllergens", () => {
    it("should return all menus with allergens", async () => {
      const menus = [
        { id: "menu-1", name: "Menu 1", allergens: [1, 2] },
        { id: "menu-2", name: "Menu 2", allergens: [3] },
      ];

      mockAllergensService.getMenusWithAllergens.mockResolvedValue(menus);

      const result = await controller.getMenusWithAllergens(mockReq);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(menus);
      expect(mockAllergensService.getMenusWithAllergens).toHaveBeenCalledWith(
        mockReq.tenantId,
        [],
      );
    });
  });

  describe("getMenusWithSpecificAllergens", () => {
    it("should return menus filtered by allergen IDs", async () => {
      const allergenIds = "1,5";
      const ids = [1, 5];
      const menus = [
        { id: "menu-1", name: "Menu 1", allergens: [1] },
        { id: "menu-2", name: "Menu 2", allergens: [5] },
      ];

      mockAllergensService.getMenusWithAllergens.mockResolvedValue(menus);

      const result = await controller.getMenusWithSpecificAllergens(
        mockReq,
        allergenIds,
      );

      expect(result.success).toBe(true);
      expect(result.data.allergenIds).toEqual(ids);
      expect(result.data.menus).toEqual(menus);
      expect(mockAllergensService.getMenusWithAllergens).toHaveBeenCalledWith(
        mockReq.tenantId,
        ids,
      );
    });
  });

  describe("recalculateAllAllergensForTenant", () => {
    it("should recalculate all allergens for tenant", async () => {
      const expectedResult = {
        success: true,
        message: "All allergens recalculated for tenant",
        stats: {
          products: 10,
          recipes: 5,
          menus: 2,
        },
      };

      mockAllergensService.recalculateAllAllergensForTenant.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.recalculateAllAllergensForTenant(mockReq);

      expect(result).toEqual(expectedResult);
      expect(
        mockAllergensService.recalculateAllAllergensForTenant,
      ).toHaveBeenCalledWith(mockReq.tenantId);
    });
  });

  describe("listAllergens", () => {
    it("should return the catalog with tenant scope", async () => {
      const catalog = [{ id: 1, name: "Gluten", productsCount: 3 }];
      mockAllergensService.findAll.mockResolvedValue(catalog);

      const result = await controller.listAllergens(mockReq);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(catalog);
      expect(mockAllergensService.findAll).toHaveBeenCalledWith(
        mockReq.tenantId,
      );
    });
  });

  describe("createAllergen", () => {
    it("should create and return the new allergen", async () => {
      const dto = { name: "Custom" };
      const created = { id: 15, name: "Custom", isActive: true };
      mockAllergensService.create.mockResolvedValue(created);

      const result = await controller.createAllergen(dto as any);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(created);
      expect(mockAllergensService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe("updateAllergen", () => {
    it("should update and return the allergen", async () => {
      const updated = { id: 1, name: "Renamed", isActive: true };
      mockAllergensService.update.mockResolvedValue(updated);

      const result = await controller.updateAllergen("1", {
        name: "Renamed",
      } as any);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updated);
      expect(mockAllergensService.update).toHaveBeenCalledWith(1, {
        name: "Renamed",
      });
    });
  });
});
