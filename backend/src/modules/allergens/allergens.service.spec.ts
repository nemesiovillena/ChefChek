import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { AllergensService } from "./allergens.service";
import { PrismaService } from "../../common/services/prisma.service";
import { ALLERGENS_INFO } from "./dto/allergens.dto";

describe("AllergensService", () => {
  let service: AllergensService;

  const mockPrismaService = {
    product: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    recipe: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    menu: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const tenantId = "test-tenant-id";
  const productId = "test-product-id";
  const recipeId = "test-recipe-id";
  const menuId = "test-menu-id";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AllergensService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AllergensService>(AllergensService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("updateProductAllergens", () => {
    it("should update product allergens successfully", async () => {
      const dto = { allergens: [1, 2, 3] };
      const mockProduct = { id: productId, name: "Test Product", tenantId };
      const updatedProduct = { ...mockProduct, allergens: dto.allergens };

      mockPrismaService.product.findFirst.mockResolvedValue(mockProduct);
      mockPrismaService.product.update.mockResolvedValue(updatedProduct);

      const result = await service.updateProductAllergens(
        tenantId,
        productId,
        dto,
      );

      expect(mockPrismaService.product.findFirst).toHaveBeenCalledWith({
        where: { id: productId, tenantId },
      });
      expect(mockPrismaService.product.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: { allergens: dto.allergens },
      });
      expect(result).toEqual({
        success: true,
        data: {
          id: productId,
          name: "Test Product",
          allergens: [1, 2, 3],
        },
      });
    });

    it("should throw NotFoundException if product not found", async () => {
      const dto = { allergens: [1, 2] };
      mockPrismaService.product.findFirst.mockResolvedValue(null);

      await expect(
        service.updateProductAllergens(tenantId, productId, dto),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.product.update).not.toHaveBeenCalled();
    });
  });

  describe("calculateRecipeAllergens", () => {
    it("should calculate allergens from direct ingredients", async () => {
      const mockRecipe = {
        id: recipeId,
        tenantId,
        ingredients: [
          { product: { allergens: [1, 2] } },
          { product: { allergens: [2, 3] } },
        ],
        subRecipes: [],
      };

      mockPrismaService.recipe.findFirst.mockResolvedValue(mockRecipe);
      mockPrismaService.recipe.update.mockResolvedValue({
        ...mockRecipe,
        allergens: [1, 2, 3],
      });

      const result = await service.calculateRecipeAllergens(tenantId, recipeId);

      expect(result).toEqual(expect.arrayContaining([1, 2, 3]));
      expect(mockPrismaService.recipe.update).toHaveBeenCalledWith({
        where: { id: recipeId },
        data: { allergens: expect.arrayContaining([1, 2, 3]) },
      });
    });

    it("should calculate allergens including sub-recipes", async () => {
      const subRecipeId = "sub-recipe-id";
      const mockRecipe = {
        id: recipeId,
        tenantId,
        ingredients: [],
        subRecipes: [{ subRecipeId }],
      };

      const mockSubRecipe = {
        id: subRecipeId,
        tenantId,
        ingredients: [{ product: { allergens: [1, 2, 3] } }],
        subRecipes: [],
      };

      mockPrismaService.recipe.findFirst
        .mockResolvedValueOnce(mockRecipe)
        .mockResolvedValueOnce(mockSubRecipe);
      mockPrismaService.recipe.update.mockResolvedValue({});

      const result = await service.calculateRecipeAllergens(tenantId, recipeId);

      expect(result).toEqual([1, 2, 3]);
    });

    it("should throw NotFoundException if recipe not found", async () => {
      mockPrismaService.recipe.findFirst.mockResolvedValue(null);

      await expect(
        service.calculateRecipeAllergens(tenantId, recipeId),
      ).rejects.toThrow(NotFoundException);
    });

    it("should handle products with null allergens", async () => {
      const mockRecipe = {
        id: recipeId,
        tenantId,
        ingredients: [
          { product: { allergens: null } },
          { product: { allergens: [1] } },
        ],
        subRecipes: [],
      };

      mockPrismaService.recipe.findFirst.mockResolvedValue(mockRecipe);
      mockPrismaService.recipe.update.mockResolvedValue({});

      const result = await service.calculateRecipeAllergens(tenantId, recipeId);

      expect(result).toEqual([1]);
    });
  });

  describe("calculateMenuAllergens", () => {
    it("should calculate allergens from menu recipes", async () => {
      const mockMenu = {
        id: menuId,
        tenantId,
        sections: [
          {
            items: [{ recipe: { id: recipeId, allergens: [1, 2] } }],
          },
        ],
      };

      mockPrismaService.menu.findFirst.mockResolvedValue(mockMenu);
      mockPrismaService.menu.update.mockResolvedValue({});

      const result = await service.calculateMenuAllergens(tenantId, menuId);

      expect(result).toEqual(expect.arrayContaining([1, 2]));
      expect(mockPrismaService.menu.update).toHaveBeenCalledWith({
        where: { id: menuId },
        data: { allergens: expect.arrayContaining([1, 2]) },
      });
    });

    it("should calculate recipe allergens if not present", async () => {
      const mockMenu = {
        id: menuId,
        tenantId,
        sections: [
          {
            items: [{ recipe: { id: recipeId, allergens: null } }],
          },
        ],
      };

      const mockRecipe = {
        id: recipeId,
        tenantId,
        ingredients: [{ product: { allergens: [3, 4] } }],
        subRecipes: [],
      };

      mockPrismaService.menu.findFirst.mockResolvedValue(mockMenu);
      mockPrismaService.recipe.findFirst.mockResolvedValue(mockRecipe);
      mockPrismaService.recipe.findUnique.mockResolvedValue({
        allergens: [3, 4],
      });
      mockPrismaService.recipe.update.mockResolvedValue({});
      mockPrismaService.menu.update.mockResolvedValue({});

      const result = await service.calculateMenuAllergens(tenantId, menuId);

      expect(result).toEqual(expect.arrayContaining([3, 4]));
    });

    it("should throw NotFoundException if menu not found", async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue(null);

      await expect(
        service.calculateMenuAllergens(tenantId, menuId),
      ).rejects.toThrow(NotFoundException);
    });

    it("should handle empty sections", async () => {
      const mockMenu = {
        id: menuId,
        tenantId,
        sections: [],
      };

      mockPrismaService.menu.findFirst.mockResolvedValue(mockMenu);
      mockPrismaService.menu.update.mockResolvedValue({});

      const result = await service.calculateMenuAllergens(tenantId, menuId);

      expect(result).toEqual([]);
    });
  });

  describe("detectAllergenConflicts", () => {
    it("should detect allergen conflicts in menu recipes", async () => {
      const filteredAllergens = [1, 2];
      const mockMenu = {
        id: menuId,
        tenantId,
        sections: [
          {
            items: [
              {
                recipe: {
                  id: recipeId,
                  ingredients: [{ product: { allergens: [1, 3] } }],
                  subRecipes: [],
                },
              },
            ],
          },
        ],
      };

      mockPrismaService.menu.findFirst.mockResolvedValue(mockMenu);
      mockPrismaService.recipe.findFirst.mockResolvedValue({
        id: recipeId,
        ingredients: [{ product: { allergens: [1, 3] } }],
        subRecipes: [],
      });
      mockPrismaService.recipe.update.mockResolvedValue({});

      const result = await service.detectAllergenConflicts(
        tenantId,
        menuId,
        filteredAllergens,
      );

      expect(result).toHaveLength(1);
      expect(result[0].recipeId).toBe(recipeId);
      expect(result[0].filteredAllergens).toEqual([1]);
    });

    it("should return empty array if no conflicts", async () => {
      const filteredAllergens = [5, 6];
      const mockMenu = {
        id: menuId,
        tenantId,
        sections: [
          {
            items: [
              {
                recipe: {
                  id: recipeId,
                  ingredients: [{ product: { allergens: [1, 2] } }],
                  subRecipes: [],
                },
              },
            ],
          },
        ],
      };

      mockPrismaService.menu.findFirst.mockResolvedValue(mockMenu);
      mockPrismaService.recipe.findFirst.mockResolvedValue({
        id: recipeId,
        ingredients: [{ product: { allergens: [1, 2] } }],
        subRecipes: [],
      });
      mockPrismaService.recipe.update.mockResolvedValue({});

      const result = await service.detectAllergenConflicts(
        tenantId,
        menuId,
        filteredAllergens,
      );

      expect(result).toEqual([]);
    });

    it("should throw NotFoundException if menu not found", async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue(null);

      await expect(
        service.detectAllergenConflicts(tenantId, menuId, []),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("generateComplianceReport", () => {
    it("should generate FULL compliance report", async () => {
      const mockMenu = {
        id: menuId,
        tenantId,
        sections: [
          {
            items: [
              {
                recipe: {
                  id: recipeId,
                  ingredients: [
                    {
                      productId: "prod-1",
                      product: { id: "prod-1", allergens: [1] },
                    },
                    {
                      productId: "prod-2",
                      product: { id: "prod-2", allergens: [] },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      mockPrismaService.menu.findFirst.mockResolvedValue(mockMenu);
      mockPrismaService.recipe.findFirst.mockResolvedValue({
        id: recipeId,
        ingredients: mockMenu.sections[0].items[0].recipe.ingredients,
        subRecipes: [],
      });
      mockPrismaService.recipe.update.mockResolvedValue({});

      const result = await service.generateComplianceReport(
        tenantId,
        menuId,
        "FULL",
      );

      expect(result.menuId).toBe(menuId);
      expect(result.reportType).toBe("FULL");
      expect(result.missingDeclarations).toContain("prod-2");
    });

    it("should generate SUMMARY compliance report", async () => {
      const mockMenu = {
        id: menuId,
        tenantId,
        sections: [
          {
            items: [
              {
                recipe: {
                  id: recipeId,
                  ingredients: [
                    {
                      productId: "prod-1",
                      product: { id: "prod-1", allergens: [1, 2] },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      mockPrismaService.menu.findFirst.mockResolvedValue(mockMenu);
      mockPrismaService.recipe.findFirst.mockResolvedValue({
        id: recipeId,
        ingredients: mockMenu.sections[0].items[0].recipe.ingredients,
        subRecipes: [],
      });
      mockPrismaService.recipe.update.mockResolvedValue({});

      const result = await service.generateComplianceReport(
        tenantId,
        menuId,
        "SUMMARY",
      );

      expect(result.reportType).toBe("SUMMARY");
    });

    it("should throw NotFoundException if menu not found", async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue(null);

      await expect(
        service.generateComplianceReport(tenantId, menuId, "FULL"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getAllergensInfo", () => {
    it("should return all allergens info", async () => {
      const result = await service.getAllergensInfo();

      expect(result).toEqual(ALLERGENS_INFO);
      expect(result).toHaveLength(14);
    });
  });

  describe("getProductsWithAllergens", () => {
    it("should return products with specified allergens", async () => {
      const allergenIds = [1, 2];
      const mockProducts = [
        { id: "prod-1", name: "Product 1", allergens: [1, 2] },
        { id: "prod-2", name: "Product 2", allergens: [2, 3] },
      ];

      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);

      const result = await service.getProductsWithAllergens(
        tenantId,
        allergenIds,
      );

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          allergens: { hasSome: allergenIds },
        },
        select: {
          id: true,
          name: true,
          allergens: true,
        },
      });
      expect(result).toEqual(mockProducts);
    });

    it("should return empty array if no products found", async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.getProductsWithAllergens(tenantId, [99]);

      expect(result).toEqual([]);
    });
  });

  describe("getRecipesWithAllergens", () => {
    it("should return recipes with specified allergens", async () => {
      const allergenIds = [1, 3];
      const mockRecipes = [
        { id: "recipe-1", name: "Recipe 1", allergens: [1, 3] },
      ];

      mockPrismaService.recipe.findMany.mockResolvedValue(mockRecipes);

      const result = await service.getRecipesWithAllergens(
        tenantId,
        allergenIds,
      );

      expect(mockPrismaService.recipe.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          allergens: { hasSome: allergenIds },
        },
        select: {
          id: true,
          name: true,
          allergens: true,
        },
      });
      expect(result).toEqual(mockRecipes);
    });
  });

  describe("getMenusWithAllergens", () => {
    it("should return menus with specified allergens", async () => {
      const allergenIds = [2, 4];
      const mockMenus = [{ id: "menu-1", name: "Menu 1", allergens: [2, 4] }];

      mockPrismaService.menu.findMany.mockResolvedValue(mockMenus);

      const result = await service.getMenusWithAllergens(tenantId, allergenIds);

      expect(mockPrismaService.menu.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          allergens: { hasSome: allergenIds },
        },
        select: {
          id: true,
          name: true,
          allergens: true,
        },
      });
      expect(result).toEqual(mockMenus);
    });
  });

  describe("recalculateAllAllergensForTenant", () => {
    it("should recalculate allergens for all tenant entities", async () => {
      const mockProducts = [{ id: "prod-1" }, { id: "prod-2" }];
      const mockRecipes = [{ id: "recipe-1" }];
      const mockMenus = [{ id: "menu-1" }];

      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);
      mockPrismaService.recipe.findMany.mockResolvedValue(mockRecipes);
      mockPrismaService.menu.findMany.mockResolvedValue(mockMenus);
      mockPrismaService.product.findUnique.mockResolvedValue({
        allergens: [1],
      });
      mockPrismaService.product.update.mockResolvedValue({});
      mockPrismaService.recipe.findFirst.mockResolvedValue({
        id: "recipe-1",
        ingredients: [],
        subRecipes: [],
      });
      mockPrismaService.recipe.update.mockResolvedValue({});
      mockPrismaService.menu.findFirst.mockResolvedValue({
        id: "menu-1",
        sections: [],
      });
      mockPrismaService.menu.update.mockResolvedValue({});

      const result = await service.recalculateAllAllergensForTenant(tenantId);

      expect(result.success).toBe(true);
      expect(result.stats).toEqual({
        products: 2,
        recipes: 1,
        menus: 1,
      });
    });

    it("should handle empty tenant data", async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.recipe.findMany.mockResolvedValue([]);
      mockPrismaService.menu.findMany.mockResolvedValue([]);

      const result = await service.recalculateAllAllergensForTenant(tenantId);

      expect(result.success).toBe(true);
      expect(result.stats).toEqual({
        products: 0,
        recipes: 0,
        menus: 0,
      });
    });
  });
});
