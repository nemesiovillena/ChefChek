import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { EscandallosService } from "./escandallos.service";
import { PrismaService } from "../../common/services/prisma.service";

describe("EscandallosService", () => {
  let service: EscandallosService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    recipe: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    recipeSubRecipe: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscandallosService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EscandallosService>(EscandallosService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getDetailedRecipeCost", () => {
    it("should calculate detailed recipe cost correctly", async () => {
      const mockRecipe = {
        id: "recipe-1",
        name: "Test Recipe",
        portions: 4,
        portionSize: 200,
        ingredients: [
          {
            productId: "product-1",
            quantity: 1,
            unit: "kg",
            product: {
              id: "product-1",
              name: "Test Product",
              purchasePrice: 10,
              wastePercentage: 5,
              yieldFactor: 0.95,
            },
          },
        ],
        subRecipesAsChild: [],
      };

      mockPrismaService.recipe.findFirst = jest
        .fn()
        .mockResolvedValue(mockRecipe);

      const result = await service.getDetailedRecipeCost(
        "tenant-1",
        "recipe-1",
      );

      expect(result).toHaveProperty("recipeId", "recipe-1");
      expect(result).toHaveProperty("totalCost");
      expect(result).toHaveProperty("costPerPortion");
      expect(result).toHaveProperty("costBreakdown");
      expect(result.costBreakdown).toHaveLength(1);
      expect(result.costBreakdown[0]).toHaveProperty(
        "productName",
        "Test Product",
      );
    });

    it("should throw NotFoundException when recipe not found", async () => {
      mockPrismaService.recipe.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        service.getDetailedRecipeCost("tenant-1", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getCostVariations", () => {
    it("should return cost variations for recipe", async () => {
      const mockRecipe = {
        id: "recipe-1",
        name: "Test Recipe",
        ingredients: [
          {
            productId: "product-1",
            quantity: 1,
            unit: "kg",
            product: {
              id: "product-1",
              name: "Test Product",
              purchasePrice: 10,
              wastePercentage: 5,
              yieldFactor: 0.95,
            },
          },
        ],
      };

      mockPrismaService.recipe.findFirst = jest
        .fn()
        .mockResolvedValue(mockRecipe);

      const result = await service.getCostVariations("tenant-1", "recipe-1");

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty("recipeId", "recipe-1");
      expect(result[0]).toHaveProperty("variation");
      expect(result[0]).toHaveProperty("variationPercentage");
    });
  });

  describe("getCostProjections", () => {
    it("should return cost projections for recipe", async () => {
      const mockRecipe = {
        id: "recipe-1",
        name: "Test Recipe",
        totalCost: 50,
        ingredients: [
          {
            productId: "product-1",
            quantity: 1,
            unit: "kg",
            product: {
              id: "product-1",
              name: "Test Product",
              purchasePrice: 10,
            },
          },
        ],
      };

      mockPrismaService.recipe.findFirst = jest
        .fn()
        .mockResolvedValue(mockRecipe);

      const result = await service.getCostProjections("tenant-1", "recipe-1");

      expect(result).toHaveProperty("recipeId", "recipe-1");
      expect(result).toHaveProperty("projectedCost");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("trend");
      expect(result).toHaveProperty("factors");
    });
  });

  describe("convertUnits", () => {
    it("should convert units correctly", async () => {
      const mockProduct = {
        id: "product-1",
        name: "Test Product",
        purchasePrice: 10,
        wastePercentage: 5,
        yieldFactor: 0.95,
      };

      mockPrismaService.product.findFirst = jest
        .fn()
        .mockResolvedValue(mockProduct);

      const result = await service.convertUnits(
        "tenant-1",
        "kg",
        "g",
        1,
        "product-1",
      );

      expect(result).toHaveProperty("success", true);
      expect(result.data).toHaveProperty("original", {
        quantity: 1,
        unit: "kg",
      });
      expect(result.data).toHaveProperty("converted");
      expect(result.data.converted.quantity).toBe(1000);
      expect(result.data.converted.unit).toBe("g");
    });

    it("should throw BadRequestException when conversion is invalid", async () => {
      const mockProduct = { id: "p-1", name: "Product" };
      mockPrismaService.product.findFirst = jest
        .fn()
        .mockResolvedValue(mockProduct);

      await expect(
        service.convertUnits("tenant-1", "kg", "l", 1, "p-1"),
      ).rejects.toThrow();
    });
  });

  describe("getCompleteCostAnalysis and Report", () => {
    const mockRecipe = {
      id: "recipe-1",
      name: "Test Recipe",
      portions: 4,
      totalCost: 50,
      ingredients: [],
      subRecipesAsChild: [],
    };

    it("should return complete cost analysis successfully", async () => {
      mockPrismaService.recipe.findFirst = jest
        .fn()
        .mockResolvedValue(mockRecipe);

      // Mocks para las llamadas internas que hacen findFirst de nuevo o usan otros servicios
      const result = await service.getCompleteCostAnalysis(
        "tenant-1",
        "recipe-1",
      );

      expect(result.recipeId).toBe("recipe-1");
      expect(result.recipeName).toBe("Test Recipe");
      expect(result.profitability).toBe(0);
    });

    it("should throw NotFoundException on complete analysis if recipe is missing", async () => {
      mockPrismaService.recipe.findFirst = jest.fn().mockResolvedValue(null);
      await expect(
        service.getCompleteCostAnalysis("tenant-1", "missing"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should generate escandallo report for a single recipe", async () => {
      mockPrismaService.recipe.findFirst = jest
        .fn()
        .mockResolvedValue(mockRecipe);
      const result = await service.generateEscandalloReport("tenant-1", {
        recipeId: "recipe-1",
      });

      expect(result.success).toBe(true);
      expect(result.data.summary.totalRecipes).toBe(1);
    });

    it("should generate escandallo report for all recipes", async () => {
      mockPrismaService.recipe.findMany = jest
        .fn()
        .mockResolvedValue([mockRecipe]);
      const result = await service.generateEscandalloReport("tenant-1", {
        includeVariations: false,
        includeProjections: false,
      });

      expect(result.success).toBe(true);
      expect(result.data.summary.totalRecipes).toBe(1);
    });
  });

  describe("calculateSubRecipesCost private method", () => {
    it("should sum sub-recipes cost", async () => {
      // Para probar el método privado, podemos invocar getDetailedRecipeCost pasándole una receta con subrecetas
      const mockRecipe = {
        id: "recipe-parent",
        name: "Parent Recipe",
        portions: 4,
        ingredients: [],
      };

      mockPrismaService.recipe.findFirst = jest
        .fn()
        .mockResolvedValue(mockRecipe);

      // Mock de la relación de sub-recetas
      (mockPrismaService as any).recipeSubRecipe = {
        findMany: jest.fn().mockResolvedValue([
          {
            quantity: 2,
            subRecipe: {
              totalCostPerUnit: 5,
            },
          },
        ]),
      };

      const result = await service.getDetailedRecipeCost(
        "tenant-1",
        "recipe-parent",
      );
      expect(result.totalCost).toBe(10); // 2 * 5
    });

    it("should return 0 cost if sub-recipes fetch throws error", async () => {
      const mockRecipe = {
        id: "recipe-parent",
        name: "Parent",
        portions: 2,
        ingredients: [],
      };
      mockPrismaService.recipe.findFirst = jest
        .fn()
        .mockResolvedValue(mockRecipe);

      (mockPrismaService as any).recipeSubRecipe = {
        findMany: jest.fn().mockRejectedValue(new Error("db error")),
      };

      const result = await service.getDetailedRecipeCost(
        "tenant-1",
        "recipe-parent",
      );
      expect(result.totalCost).toBe(0);
    });
  });
});
