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

    it("should throw NotFoundException when product not found", async () => {
      mockPrismaService.product.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        service.convertUnits("tenant-1", "kg", "g", 1, "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
