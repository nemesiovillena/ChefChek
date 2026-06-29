import { Test, TestingModule } from "@nestjs/testing";
import { RecipesController } from "./recipes.controller";
import { RecipesService } from "./recipes.service";
import { CreateRecipeDto } from "./dto/create-recipe.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";

describe("RecipesController", () => {
  let controller: RecipesController;

  const mockRecipesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    duplicate: jest.fn(),
    calculateRecipeCost: jest.fn(),
  };

  const mockReq = {
    tenantId: "tenant-1",
    user: { id: "user-1", role: "ADMIN" },
  };

  const mockRecipe = {
    id: "recipe-1",
    name: "Test Recipe",
    description: "Test description",
    elaboration: JSON.stringify({ type: "doc", content: [] }),
    portions: 4,
    portionSize: 250,
    totalCost: 10.5,
    totalCostPerUnit: 2.625,
    version: 1,
    isActive: true,
    ingredients: [],
    subRecipes: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecipesController],
      providers: [{ provide: RecipesService, useValue: mockRecipesService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RecipesController>(RecipesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a recipe and return success response", async () => {
      const createDto: CreateRecipeDto = {
        name: "Test Recipe",
        elaboration: JSON.stringify({ type: "doc", content: [] }),
        portions: 4,
      };

      mockRecipesService.create.mockResolvedValue(mockRecipe);

      const result = await controller.create(mockReq as any, createDto);

      expect(mockRecipesService.create).toHaveBeenCalledWith(
        "tenant-1",
        createDto,
      );
      expect(result).toEqual({
        success: true,
        data: mockRecipe,
        message: "Recipe created successfully",
      });
    });
  });

  describe("findAll", () => {
    it("should return all recipes for tenant", async () => {
      const recipes = [mockRecipe];
      mockRecipesService.findAll.mockResolvedValue(recipes);

      const result = await controller.findAll(mockReq as any, {});

      expect(mockRecipesService.findAll).toHaveBeenCalledWith("tenant-1", {});
      expect(result).toEqual({
        success: true,
        data: recipes,
        message: "Recipes retrieved successfully",
      });
    });

    it("should pass query parameters to service", async () => {
      const query = { search: "pasta", category: "main" };
      mockRecipesService.findAll.mockResolvedValue([]);

      await controller.findAll(mockReq as any, query);

      expect(mockRecipesService.findAll).toHaveBeenCalledWith(
        "tenant-1",
        query,
      );
    });
  });

  describe("findOne", () => {
    it("should return a single recipe", async () => {
      mockRecipesService.findOne.mockResolvedValue(mockRecipe);

      const result = await controller.findOne(mockReq as any, "recipe-1");

      expect(mockRecipesService.findOne).toHaveBeenCalledWith(
        "tenant-1",
        "recipe-1",
      );
      expect(result).toEqual({
        success: true,
        data: mockRecipe,
        message: "Recipe retrieved successfully",
      });
    });
  });

  describe("update", () => {
    it("should update a recipe and return success response", async () => {
      const updateDto = { name: "Updated Recipe" };
      mockRecipesService.update.mockResolvedValue({
        ...mockRecipe,
        name: "Updated Recipe",
      });

      const result = await controller.update(
        mockReq as any,
        "recipe-1",
        updateDto,
      );

      expect(mockRecipesService.update).toHaveBeenCalledWith(
        "tenant-1",
        "recipe-1",
        updateDto,
      );
      expect(result).toEqual({
        success: true,
        data: { ...mockRecipe, name: "Updated Recipe" },
        message: "Recipe updated successfully",
      });
    });
  });

  describe("remove", () => {
    it("should remove a recipe and return success response", async () => {
      mockRecipesService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(mockReq as any, "recipe-1");

      expect(mockRecipesService.remove).toHaveBeenCalledWith(
        "tenant-1",
        "recipe-1",
      );
      expect(result).toEqual({
        success: true,
        message: "Recipe deleted successfully",
      });
    });
  });

  describe("duplicate", () => {
    it("should duplicate a recipe with new name", async () => {
      const duplicatedRecipe = { ...mockRecipe, id: "recipe-2", name: "Copy" };
      mockRecipesService.duplicate.mockResolvedValue(duplicatedRecipe);

      const result = await controller.duplicate(
        mockReq as any,
        "recipe-1",
        "Copy",
      );

      expect(mockRecipesService.duplicate).toHaveBeenCalledWith(
        "tenant-1",
        "recipe-1",
        "Copy",
      );
      expect(result).toEqual({
        success: true,
        data: duplicatedRecipe,
        message: "Recipe duplicated successfully",
      });
    });

    it("should duplicate a recipe without new name", async () => {
      mockRecipesService.duplicate.mockResolvedValue(mockRecipe);

      const result = await controller.duplicate(
        mockReq as any,
        "recipe-1",
        undefined,
      );

      expect(mockRecipesService.duplicate).toHaveBeenCalledWith(
        "tenant-1",
        "recipe-1",
        undefined,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("calculateCost", () => {
    it("should calculate recipe cost and return breakdown", async () => {
      const costBreakdown = {
        ingredientsCost: 8,
        subRecipesCost: 2,
        totalCost: 10,
        costPerPortion: 2.5,
        costPerUnit: 0.01,
      };
      mockRecipesService.calculateRecipeCost.mockResolvedValue(costBreakdown);

      const result = await controller.calculateCost(mockReq as any, "recipe-1");

      expect(mockRecipesService.calculateRecipeCost).toHaveBeenCalledWith(
        "tenant-1",
        "recipe-1",
      );
      expect(result).toEqual({
        success: true,
        data: costBreakdown,
        message: "Recipe cost calculated successfully",
      });
    });
  });

  describe("uploadImage", () => {
    it("should upload recipe image successfully", async () => {
      const mockFile = {
        fieldname: "file",
        originalname: "test-recipe.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        buffer: Buffer.from("mockImageContent"),
        size: 100,
      } as Express.Multer.File;

      const result = await controller.uploadImage(mockFile);
      expect(result.success).toBe(true);
      expect(result.data.imageUrl).toContain("/uploads/recipes/");
    });

    it("should throw BadRequestException if file is missing", async () => {
      await expect(controller.uploadImage(null)).rejects.toThrow();
    });

    it("should throw BadRequestException if file type is invalid", async () => {
      const mockFile = {
        fieldname: "file",
        originalname: "test.pdf",
        mimetype: "application/pdf",
        buffer: Buffer.from("pdfcontent"),
      } as any;

      await expect(controller.uploadImage(mockFile)).rejects.toThrow();
    });
  });
});
