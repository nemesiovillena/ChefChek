import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { RecipesService } from "./recipes.service";
import { PrismaService } from "../../common/services/prisma.service";
import { CreateRecipeDto } from "./dto/create-recipe.dto";

describe("RecipesService", () => {
  let service: RecipesService;

  const mockPrismaService = {
    recipe: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    recipeIngredient: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    recipeSubRecipe: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const tenantId = "test-tenant-id";
  const recipeId = "test-recipe-id";

  const mockProduct = {
    id: "product-1",
    name: "Test Product",
    purchasePrice: 10,
    netPrice: 9,
    wastePercentage: 10,
    purchaseUnit: "Kilogramo",
    storageUnit: "Kilogramos",
    recipeUnit: "Gramos",
    allergens: [1, 2],
    tenantId,
  };

  const mockIngredient = {
    id: "ingredient-1",
    productId: "product-1",
    quantity: 100,
    unit: "Gramos",
    product: mockProduct,
  };

  const mockSubRecipe = {
    id: "subrecipe-1",
    subRecipeId: "sub-recipe-1",
    quantity: 50,
    unit: "Gramos",
    subRecipe: {
      id: "sub-recipe-1",
      name: "Sub Recipe",
      totalCost: 20,
      totalCostPerUnit: 0.2,
      ingredients: [],
    },
  };

  const mockRecipe = {
    id: recipeId,
    tenantId,
    name: "Test Recipe",
    description: "Test Description",
    elaboration: JSON.stringify({ type: "doc", content: [] }),
    portions: 4,
    portionSize: 200,
    totalCost: 15.5,
    totalCostPerUnit: 0.155,
    version: 1,
    parentVersion: null,
    isActive: true,
    isPublic: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ingredients: [mockIngredient],
    subRecipes: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<RecipesService>(RecipesService);

    // Default mocks for optimized queries
    mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    const createRecipeDto: CreateRecipeDto = {
      name: "New Recipe",
      description: "New Description",
      elaboration: JSON.stringify({ type: "doc", content: [] }),
      portions: 4,
      portionSize: 200,
      ingredients: [
        {
          productId: "product-1",
          quantity: 100,
          unit: "Gramos",
        },
      ],
      subRecipes: [],
      isPublic: false,
    };

    it("should create a recipe successfully", async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(mockProduct);
      mockPrismaService.recipe.create.mockResolvedValue(mockRecipe);

      const result = await service.create(tenantId, createRecipeDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(mockRecipe.name);
      expect(mockPrismaService.recipe.create).toHaveBeenCalled();
    });

    it("should throw BadRequestException if elaboration is not valid JSON", async () => {
      const invalidDto = {
        ...createRecipeDto,
        elaboration: "invalid json",
      };

      await expect(service.create(tenantId, invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw NotFoundException if product not found", async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      await expect(service.create(tenantId, createRecipeDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("findAll", () => {
    it("should return an array of recipes", async () => {
      mockPrismaService.recipe.findMany.mockResolvedValue([mockRecipe]);

      const result = await service.findAll(tenantId);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(mockPrismaService.recipe.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
        },
        include: {
          ingredients: {
            include: {
              product: true,
            },
          },
          subRecipes: {
            include: {
              subRecipe: true,
            },
          },
          categories: {
            include: {
              category: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should filter recipes by search query", async () => {
      mockPrismaService.recipe.findMany.mockResolvedValue([mockRecipe]);

      const result = await service.findAll(tenantId, { search: "Test" });

      expect(result).toBeDefined();
      expect(mockPrismaService.recipe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: "Test", mode: "insensitive" } },
            ]),
          }),
        }),
      );
    });
  });

  describe("findOne", () => {
    it("should return a recipe by id", async () => {
      mockPrismaService.recipe.findFirst.mockResolvedValue(mockRecipe);

      const result = await service.findOne(tenantId, recipeId);

      expect(result).toBeDefined();
      expect(result.id).toBe(recipeId);
      expect(mockPrismaService.recipe.findFirst).toHaveBeenCalledWith({
        where: { id: recipeId, tenantId },
        include: {
          ingredients: {
            include: {
              product: true,
            },
          },
          subRecipes: {
            include: {
              subRecipe: {
                include: {
                  ingredients: {
                    include: {
                      product: true,
                    },
                  },
                  subRecipes: {
                    include: {
                      subRecipe: true,
                    },
                  },
                  categories: {
                    include: {
                      category: true,
                    },
                  },
                },
              },
            },
          },
          categories: {
            include: {
              category: true,
            },
          },
        },
      });
    });

    it("should throw NotFoundException if recipe not found", async () => {
      mockPrismaService.recipe.findFirst.mockResolvedValue(null);

      await expect(service.findOne(tenantId, recipeId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    const updateRecipeDto: Partial<CreateRecipeDto> = {
      name: "Updated Recipe",
      description: "Updated Description",
    };

    it("should update a recipe successfully", async () => {
      mockPrismaService.recipe.findFirst.mockResolvedValue(mockRecipe);
      mockPrismaService.recipe.update.mockResolvedValue({
        ...mockRecipe,
        ...updateRecipeDto,
      });
      mockPrismaService.recipe.findUnique.mockResolvedValue({
        ...mockRecipe,
        ...updateRecipeDto,
        ingredients: mockRecipe.ingredients,
        subRecipes: [],
      });

      const result = await service.update(tenantId, recipeId, updateRecipeDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(updateRecipeDto.name);
      expect(mockPrismaService.recipe.update).toHaveBeenCalled();
    });

    it("should throw NotFoundException if recipe not found", async () => {
      mockPrismaService.recipe.findFirst.mockResolvedValue(null);

      await expect(
        service.update(tenantId, recipeId, updateRecipeDto),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if elaboration is invalid JSON", async () => {
      mockPrismaService.recipe.findFirst.mockResolvedValue(mockRecipe);

      const invalidDto = {
        elaboration: "invalid json",
      };

      await expect(
        service.update(tenantId, recipeId, invalidDto),
      ).rejects.toThrow(BadRequestException);
    });

    it("should update ingredients if provided", async () => {
      const dtoWithIngredients: Partial<CreateRecipeDto> = {
        ingredients: [
          {
            productId: "product-1",
            quantity: 200,
            unit: "Gramos",
          },
        ],
      };

      mockPrismaService.recipe.findFirst.mockResolvedValue(mockRecipe);
      mockPrismaService.product.findFirst.mockResolvedValue(mockProduct);
      mockPrismaService.recipeIngredient.deleteMany.mockResolvedValue({
        count: 1,
      });
      mockPrismaService.recipeIngredient.createMany.mockResolvedValue({
        count: 1,
      });
      mockPrismaService.recipe.update.mockResolvedValue(mockRecipe);
      mockPrismaService.recipe.findUnique.mockResolvedValue(mockRecipe);

      await service.update(tenantId, recipeId, dtoWithIngredients);

      expect(
        mockPrismaService.recipeIngredient.deleteMany,
      ).toHaveBeenCalledWith({
        where: { recipeId },
      });
      expect(mockPrismaService.recipeIngredient.createMany).toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should soft delete a recipe (set isActive to false)", async () => {
      mockPrismaService.recipe.findFirst.mockResolvedValue(mockRecipe);
      mockPrismaService.recipe.update.mockResolvedValue({
        ...mockRecipe,
        isActive: false,
      });

      await service.remove(tenantId, recipeId);

      expect(mockPrismaService.recipe.update).toHaveBeenCalledWith({
        where: { id: recipeId },
        data: { isActive: false },
      });
    });

    it("should throw NotFoundException if recipe not found", async () => {
      mockPrismaService.recipe.findFirst.mockResolvedValue(null);

      await expect(service.remove(tenantId, recipeId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("duplicate", () => {
    it("should duplicate a recipe with a new name", async () => {
      const newName = "Duplicated Recipe";
      mockPrismaService.recipe.findFirst.mockResolvedValue(mockRecipe);
      mockPrismaService.product.findFirst.mockResolvedValue(mockProduct);
      mockPrismaService.recipe.create.mockResolvedValue({
        ...mockRecipe,
        id: "new-recipe-id",
        name: newName,
      });

      const result = await service.duplicate(tenantId, recipeId, newName);

      expect(result).toBeDefined();
      expect(result.name).toBe(newName);
    });

    it("should duplicate a recipe with default name if not provided", async () => {
      mockPrismaService.recipe.findFirst.mockResolvedValue(mockRecipe);
      mockPrismaService.product.findFirst.mockResolvedValue(mockProduct);
      mockPrismaService.recipe.create.mockResolvedValue({
        ...mockRecipe,
        id: "new-recipe-id",
        name: `${mockRecipe.name} (Copia)`,
      });

      const result = await service.duplicate(tenantId, recipeId);

      expect(result.name).toContain("(Copia)");
    });
  });

  describe("calculateRecipeCost", () => {
    it("should return cost breakdown for a recipe", async () => {
      mockPrismaService.recipe.findFirst.mockResolvedValue(mockRecipe);

      const result = await service.calculateRecipeCost(tenantId, recipeId);

      expect(result).toBeDefined();
      expect(result.totalCost).toBe(mockRecipe.totalCost);
      expect(result).toHaveProperty("ingredientsCost");
      expect(result).toHaveProperty("subRecipesCost");
      expect(result).toHaveProperty("costPerPortion");
      expect(result).toHaveProperty("costPerUnit");
    });

    it("should throw NotFoundException if recipe not found", async () => {
      mockPrismaService.recipe.findFirst.mockResolvedValue(null);

      await expect(
        service.calculateRecipeCost(tenantId, recipeId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("edge cases", () => {
    it("should handle recipe with no ingredients and no sub-recipes", async () => {
      const emptyRecipe = {
        ...mockRecipe,
        ingredients: [],
        subRecipes: [],
        totalCost: 0,
        totalCostPerUnit: 0,
      };

      mockPrismaService.recipe.findFirst.mockResolvedValue(emptyRecipe);

      const result = await service.calculateRecipeCost(tenantId, recipeId);

      expect(result.totalCost).toBe(0);
      expect(result.ingredientsCost).toBe(0);
      expect(result.subRecipesCost).toBe(0);
    });

    it("should handle recipe with very long name", async () => {
      const longName = "A".repeat(300);
      const createDto = {
        name: longName,
        elaboration: JSON.stringify({ type: "doc", content: [] }),
        portions: 1,
        portionSize: 100,
        ingredients: [],
        subRecipes: [],
      };

      const mockRecipe = {
        id: "recipe-1",
        name: longName,
        totalCost: 0,
        totalCostPerUnit: 0,
        ingredients: [],
        subRecipes: [],
        isActive: true,
      };

      mockPrismaService.recipe.create.mockResolvedValue(mockRecipe);

      const result = await service.create(tenantId, createDto);

      expect(result.name).toBe(longName);
    });

    it("should handle recipe with very large portions", async () => {
      const createDto = {
        name: "Large Portions Recipe",
        elaboration: JSON.stringify({ type: "doc", content: [] }),
        portions: 1000,
        portionSize: 500,
        ingredients: [],
        subRecipes: [],
      };

      const mockRecipe = {
        id: "recipe-1",
        name: "Large Portions Recipe",
        totalCost: 0,
        totalCostPerUnit: 0,
        portions: 1000,
        portionSize: 500,
        ingredients: [],
        subRecipes: [],
        isActive: true,
      };

      mockPrismaService.recipe.create.mockResolvedValue(mockRecipe);

      const result = await service.create(tenantId, createDto);

      expect(result.portions).toBe(1000);
    });

    it("should handle invalid elaboration JSON gracefully", async () => {
      const createDto = {
        name: "Recipe",
        elaboration: "{ invalid json }",
        ingredients: [],
        subRecipes: [],
      };

      await expect(service.create(tenantId, createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should handle recipe with maximum portions", async () => {
      const createDto = {
        name: "Recipe",
        elaboration: JSON.stringify({ type: "doc", content: [] }),
        portions: 10000,
        portionSize: 100,
        ingredients: [],
        subRecipes: [],
      };

      const mockRecipe = {
        id: "recipe-1",
        name: "Recipe",
        totalCost: 0,
        totalCostPerUnit: 0,
        portions: 10000,
        portionSize: 100,
        ingredients: [],
        subRecipes: [],
        isActive: true,
      };

      mockPrismaService.recipe.create.mockResolvedValue(mockRecipe);

      const result = await service.create(tenantId, createDto);

      expect(result.portions).toBe(10000);
    });

    it("should handle recipe with minimum portion size", async () => {
      const createDto = {
        name: "Recipe",
        elaboration: JSON.stringify({ type: "doc", content: [] }),
        portions: 1,
        portionSize: 1,
        ingredients: [],
        subRecipes: [],
      };

      const mockRecipe = {
        id: "recipe-1",
        name: "Recipe",
        totalCost: 0,
        totalCostPerUnit: 0,
        portions: 1,
        portionSize: 1,
        ingredients: [],
        subRecipes: [],
        isActive: true,
      };

      mockPrismaService.recipe.create.mockResolvedValue(mockRecipe);

      const result = await service.create(tenantId, createDto);

      expect(result.portionSize).toBe(1);
    });

    it("should handle public recipe creation", async () => {
      const createDto = {
        name: "Recipe",
        elaboration: JSON.stringify({ type: "doc", content: [] }),
        portions: 1,
        portionSize: 100,
        ingredients: [],
        subRecipes: [],
        isPublic: true,
      };

      const mockRecipe = {
        id: "recipe-1",
        name: "Recipe",
        totalCost: 0,
        totalCostPerUnit: 0,
        ingredients: [],
        subRecipes: [],
        isActive: true,
        isPublic: true,
      };

      mockPrismaService.recipe.create.mockResolvedValue(mockRecipe);

      const result = await service.create(tenantId, createDto);

      expect(result.isPublic).toBe(true);
    });

    it("should handle recipe with elaboration containing nested structure", async () => {
      const elaboration = JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Step 1" },
              { type: "text", marks: [{ type: "bold" }], text: " important" },
            ],
          },
          {
            type: "orderedList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Item 1" }],
                  },
                ],
              },
            ],
          },
        ],
      });

      const createDto = {
        name: "Recipe",
        elaboration,
        portions: 1,
        portionSize: 100,
        ingredients: [],
        subRecipes: [],
      };

      const mockRecipe = {
        id: "recipe-1",
        name: "Recipe",
        totalCost: 0,
        totalCostPerUnit: 0,
        elaboration,
        ingredients: [],
        subRecipes: [],
        isActive: true,
      };

      mockPrismaService.recipe.create.mockResolvedValue(mockRecipe);

      const result = await service.create(tenantId, createDto);

      expect(result.elaboration).toBe(elaboration);
    });

    it("should handle recipe update with empty ingredients", async () => {
      const mockRecipe = {
        id: recipeId,
        tenantId,
        name: "Recipe",
        ingredients: [
          {
            productId: "prod-1",
            quantity: 100,
            unit: "Gramos",
            product: mockProduct,
          },
        ],
        subRecipes: [],
      };

      mockPrismaService.recipe.findFirst.mockResolvedValue(mockRecipe);
      mockPrismaService.recipeIngredient.deleteMany.mockResolvedValue({
        count: 1,
      });
      mockPrismaService.recipeIngredient.createMany.mockResolvedValue({
        count: 0,
      });
      mockPrismaService.recipe.update.mockResolvedValue(mockRecipe);
      mockPrismaService.recipe.findUnique.mockResolvedValue(mockRecipe);
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);

      await service.update(tenantId, recipeId, { ingredients: [] });

      expect(
        mockPrismaService.recipeIngredient.deleteMany,
      ).toHaveBeenCalledWith({
        where: { recipeId },
      });
      expect(
        mockPrismaService.recipeIngredient.createMany,
      ).toHaveBeenCalledWith({
        data: [],
      });
    });

    it("should handle recipe with mixed ingredient and sub-recipe costs", async () => {
      const mockRecipeWithBoth = {
        ...mockRecipe,
        ingredients: [mockIngredient],
        subRecipes: [mockSubRecipe],
        totalCost: 35.5, // 15.5 (ingredients) + 20 (sub-recipe)
        totalCostPerUnit: 0.355,
      };

      mockPrismaService.recipe.findFirst.mockResolvedValue(mockRecipeWithBoth);

      const result = await service.calculateRecipeCost(tenantId, recipeId);

      expect(result.totalCost).toBe(35.5);
      expect(result.ingredientsCost).toBeDefined();
      expect(result.subRecipesCost).toBeDefined();
    });
  });
});
