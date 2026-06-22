import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { TechnicalSheetsService } from "./technical-sheets.service";
import { PrismaService } from "../../common/services/prisma.service";
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  GenerateSheetDto,
  GenerateBatchDto,
} from "./dto/technical-sheets.dto";

describe("TechnicalSheetsService", () => {
  let service: TechnicalSheetsService;
  let mockPrismaService: any;

  const tenantId = "test-tenant-id";
  const userId = "test-user-id";
  const templateId = "test-template-id";
  const recipeId = "test-recipe-id";
  const documentId = "test-document-id";

  const mockTemplate = {
    id: templateId,
    tenantId,
    name: "Standard Template",
    type: "STANDARD",
    description: "A standard technical sheet template",
    layout: {
      header: { visible: true, order: 1 },
      generalInfo: { visible: true, order: 2 },
      ingredients: { visible: true, order: 3 },
      preparation: { visible: true, order: 4 },
      nutrition: { visible: true, order: 5 },
      footer: { visible: true, order: 6 },
    },
    fields: [
      { id: "name", name: "Nombre", type: "TEXT", required: true },
      { id: "ingredients", name: "Ingredientes", type: "LIST", required: true },
    ],
    styles: {
      primaryColor: "#1f2937",
      secondaryColor: "#6b7280",
      fontFamily: "Helvetica",
      fontSize: 12,
      headerFontSize: 18,
      lineWidth: 1,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: userId,
  };

  const mockRecipe = {
    id: recipeId,
    tenantId,
    name: "Test Recipe",
    code: "REC-001",
    description: "A delicious test recipe",
    yield: 4,
    portionWeight: 250,
    preparationTime: 30,
    cookingTime: 60,
    elaboration: "Step 1: Prep ingredients\nStep 2: Cook\nStep 3: Serve",
    ingredients: [
      {
        id: "ing-1",
        recipeId,
        productId: "prod-1",
        quantity: 500,
        unit: "g",
        product: {
          id: "prod-1",
          name: "Tomato",
          cost: 2.5,
          calories: 20,
          proteins: 1,
          carbs: 5,
          fats: 0.2,
          fiber: 1.5,
          allergens: [],
        },
      },
    ],
    subRecipes: [],
    translations: [],
    allergens: [],
  };

  const mockDocument = {
    id: documentId,
    tenantId,
    name: "Ficha Técnica - Test Recipe",
    type: "TECHNICAL_SHEET",
    category: "RECIPES",
    recipeId,
    templateId,
    version: 1,
    createdAt: new Date(),
    createdBy: userId,
    fileSize: 1024,
    fileFormat: "PDF",
    url: "/documents/DOC-123",
  };

  beforeEach(async () => {
    mockPrismaService = {
      technicalSheetTemplate: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      recipe: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      document: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TechnicalSheetsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TechnicalSheetsService>(TechnicalSheetsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createTemplate", () => {
    const createDto: CreateTemplateDto = {
      name: "Standard Template",
      type: "STANDARD" as any,
      description: "A standard technical sheet template",
    };

    it("should create template successfully", async () => {
      mockPrismaService.technicalSheetTemplate.create.mockResolvedValue(
        mockTemplate,
      );

      const result = await service.createTemplate(tenantId, userId, createDto);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.name).toBe("Standard Template");
      expect(result.data.type).toBe("STANDARD");
      expect(
        mockPrismaService.technicalSheetTemplate.create,
      ).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          name: createDto.name,
          type: createDto.type,
          description: createDto.description,
          createdBy: userId,
        }),
      });
    });

    it("should create template with custom layout and fields", async () => {
      const customDto: CreateTemplateDto = {
        name: "Custom Template",
        type: "CUSTOM" as any,
        layout: {
          header: { visible: true, order: 1 },
          generalInfo: { visible: false, order: 2 },
          ingredients: { visible: true, order: 3 },
          preparation: { visible: true, order: 4 },
          nutrition: { visible: false, order: 5 },
          footer: { visible: true, order: 6 },
        },
        fields: [
          { id: "name", name: "Nombre", type: "TEXT" as any, required: true },
        ],
      };

      mockPrismaService.technicalSheetTemplate.create.mockResolvedValue({
        ...mockTemplate,
        ...customDto,
      });

      const result = await service.createTemplate(tenantId, userId, customDto);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Custom Template");
    });

    it("should apply default layout if not provided", async () => {
      mockPrismaService.technicalSheetTemplate.create.mockResolvedValue(
        mockTemplate,
      );

      await service.createTemplate(tenantId, userId, createDto);

      const createCall =
        mockPrismaService.technicalSheetTemplate.create.mock.calls[0][0];
      expect(createCall.data.layout).toBeDefined();
      expect(createCall.data.layout.header.visible).toBe(true);
    });
  });

  describe("getTemplates", () => {
    it("should retrieve all templates for tenant", async () => {
      mockPrismaService.technicalSheetTemplate.findMany.mockResolvedValue([
        mockTemplate,
      ]);

      const result = await service.getTemplates(tenantId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(templateId);
      expect(
        mockPrismaService.technicalSheetTemplate.findMany,
      ).toHaveBeenCalledWith({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should return empty array if no templates found", async () => {
      mockPrismaService.technicalSheetTemplate.findMany.mockResolvedValue([]);

      const result = await service.getTemplates(tenantId);

      expect(result).toHaveLength(0);
    });
  });

  describe("getTemplate", () => {
    it("should retrieve template by id", async () => {
      mockPrismaService.technicalSheetTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );

      const result = await service.getTemplate(tenantId, templateId);

      expect(result.id).toBe(templateId);
      expect(result.name).toBe("Standard Template");
      expect(
        mockPrismaService.technicalSheetTemplate.findFirst,
      ).toHaveBeenCalledWith({
        where: { id: templateId, tenantId },
      });
    });

    it("should throw NotFoundException if template not found", async () => {
      mockPrismaService.technicalSheetTemplate.findFirst.mockResolvedValue(
        null,
      );

      await expect(service.getTemplate(tenantId, templateId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("updateTemplate", () => {
    const updateDto: UpdateTemplateDto = {
      name: "Updated Template",
      description: "Updated description",
    };

    it("should update template successfully", async () => {
      mockPrismaService.technicalSheetTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );
      mockPrismaService.technicalSheetTemplate.update.mockResolvedValue({
        ...mockTemplate,
        ...updateDto,
      });

      const result = await service.updateTemplate(
        tenantId,
        templateId,
        updateDto,
      );

      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Updated Template");
      expect(result.data.description).toBe("Updated description");
      expect(
        mockPrismaService.technicalSheetTemplate.update,
      ).toHaveBeenCalledWith({
        where: { id: templateId },
        data: updateDto,
      });
    });

    it("should update partial fields only", async () => {
      const partialDto: UpdateTemplateDto = {
        styles: {
          primaryColor: "#000000",
          fontSize: 14,
        },
      };

      mockPrismaService.technicalSheetTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );
      mockPrismaService.technicalSheetTemplate.update.mockResolvedValue(
        mockTemplate,
      );

      await service.updateTemplate(tenantId, templateId, partialDto);

      const updateCall =
        mockPrismaService.technicalSheetTemplate.update.mock.calls[0][0];
      expect(updateCall.data.styles).toBeDefined();
    });

    it("should throw NotFoundException if template not found", async () => {
      mockPrismaService.technicalSheetTemplate.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.updateTemplate(tenantId, templateId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("deleteTemplate", () => {
    it("should delete template successfully", async () => {
      mockPrismaService.technicalSheetTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );
      mockPrismaService.technicalSheetTemplate.delete.mockResolvedValue(
        mockTemplate,
      );

      const result = await service.deleteTemplate(tenantId, templateId);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Template deleted successfully");
      expect(
        mockPrismaService.technicalSheetTemplate.delete,
      ).toHaveBeenCalledWith({
        where: { id: templateId },
      });
    });

    it("should throw NotFoundException if template not found", async () => {
      mockPrismaService.technicalSheetTemplate.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.deleteTemplate(tenantId, templateId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("generateTechnicalSheet", () => {
    const generateDto: GenerateSheetDto = {
      recipeId,
      templateId,
      format: "A4" as any,
      includeNutrition: true,
      includeAllergens: true,
      includeCosts: true,
    };

    it("should generate technical sheet successfully", async () => {
      mockPrismaService.recipe.findFirst.mockResolvedValue(mockRecipe);
      mockPrismaService.technicalSheetTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );
      mockPrismaService.document.create.mockResolvedValue(mockDocument);

      const result = await service.generateTechnicalSheet(
        tenantId,
        userId,
        generateDto,
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(mockPrismaService.recipe.findFirst).toHaveBeenCalledWith({
        where: { id: recipeId, tenantId },
        include: {
          ingredients: {
            include: { product: true },
          },
          subRecipes: {
            include: { subRecipe: true },
          },
          translations: true,
        },
      });
      expect(mockPrismaService.document.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          name: "Ficha Técnica - Test Recipe",
          type: "TECHNICAL_SHEET",
          category: "RECIPES",
          recipeId,
          templateId,
          createdBy: userId,
        }),
      });
    });

    it("should throw NotFoundException if recipe not found", async () => {
      mockPrismaService.recipe.findFirst.mockResolvedValue(null);

      await expect(
        service.generateTechnicalSheet(tenantId, userId, generateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException if template not found", async () => {
      mockPrismaService.recipe.findFirst.mockResolvedValue(mockRecipe);
      mockPrismaService.technicalSheetTemplate.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.generateTechnicalSheet(tenantId, userId, generateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it("should apply custom branding and watermark", async () => {
      const customDto: GenerateSheetDto = {
        ...generateDto,
        watermark: "CONFIDENTIAL",
        branding: {
          companyName: "Test Restaurant",
          address: "123 Test St",
          contact: "contact@test.com",
        },
      };

      mockPrismaService.recipe.findFirst.mockResolvedValue(mockRecipe);
      mockPrismaService.technicalSheetTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );
      mockPrismaService.document.create.mockResolvedValue(mockDocument);

      const result = await service.generateTechnicalSheet(
        tenantId,
        userId,
        customDto,
      );

      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe("generateBatch", () => {
    const batchDto: GenerateBatchDto = {
      recipeIds: [recipeId, "recipe-2"],
      templateId,
      format: "A4" as any,
      mergeIntoOne: false,
    };

    it("should generate batch technical sheets successfully", async () => {
      const recipes = [
        mockRecipe,
        { ...mockRecipe, id: "recipe-2", name: "Second Recipe" },
      ];

      mockPrismaService.recipe.findMany.mockResolvedValue(recipes);
      mockPrismaService.technicalSheetTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );

      const result = await service.generateBatch(tenantId, userId, batchDto);

      expect(result).toBeInstanceOf(Buffer);
      expect(mockPrismaService.recipe.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: batchDto.recipeIds },
          tenantId,
        },
        include: {
          ingredients: {
            include: { product: true },
          },
          translations: true,
        },
      });
    });

    it("should merge into one PDF when mergeIntoOne is true", async () => {
      const mergeDto: GenerateBatchDto = {
        ...batchDto,
        mergeIntoOne: true,
      };

      const recipes = [mockRecipe, { ...mockRecipe, id: "recipe-2" }];

      mockPrismaService.recipe.findMany.mockResolvedValue(recipes);
      mockPrismaService.technicalSheetTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );

      const result = await service.generateBatch(tenantId, userId, mergeDto);

      expect(result).toBeInstanceOf(Buffer);
    });

    it("should throw NotFoundException if no recipes found", async () => {
      mockPrismaService.recipe.findMany.mockResolvedValue([]);

      await expect(
        service.generateBatch(tenantId, userId, batchDto),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException if template not found", async () => {
      mockPrismaService.recipe.findMany.mockResolvedValue([mockRecipe]);
      mockPrismaService.technicalSheetTemplate.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.generateBatch(tenantId, userId, batchDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getDocuments", () => {
    it("should retrieve all documents for tenant", async () => {
      mockPrismaService.document.findMany.mockResolvedValue([mockDocument]);

      const result = await service.getDocuments(tenantId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(documentId);
      expect(mockPrismaService.document.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should filter documents by type", async () => {
      mockPrismaService.document.findMany.mockResolvedValue([mockDocument]);

      await service.getDocuments(tenantId, { type: "TECHNICAL_SHEET" });

      expect(mockPrismaService.document.findMany).toHaveBeenCalledWith({
        where: { tenantId, type: "TECHNICAL_SHEET" },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should filter documents by category", async () => {
      mockPrismaService.document.findMany.mockResolvedValue([mockDocument]);

      await service.getDocuments(tenantId, { category: "RECIPES" });

      expect(mockPrismaService.document.findMany).toHaveBeenCalledWith({
        where: { tenantId, category: "RECIPES" },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should filter documents by recipeId", async () => {
      mockPrismaService.document.findMany.mockResolvedValue([mockDocument]);

      await service.getDocuments(tenantId, { recipeId });

      expect(mockPrismaService.document.findMany).toHaveBeenCalledWith({
        where: { tenantId, recipeId },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should apply multiple filters", async () => {
      mockPrismaService.document.findMany.mockResolvedValue([mockDocument]);

      await service.getDocuments(tenantId, {
        type: "TECHNICAL_SHEET",
        category: "RECIPES",
        recipeId,
      });

      expect(mockPrismaService.document.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          type: "TECHNICAL_SHEET",
          category: "RECIPES",
          recipeId,
        },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("getDocument", () => {
    it("should retrieve document by id", async () => {
      mockPrismaService.document.findFirst.mockResolvedValue(mockDocument);

      const result = await service.getDocument(tenantId, documentId);

      expect(result.id).toBe(documentId);
      expect(result.name).toBe("Ficha Técnica - Test Recipe");
      expect(mockPrismaService.document.findFirst).toHaveBeenCalledWith({
        where: { id: documentId, tenantId },
      });
    });

    it("should throw NotFoundException if document not found", async () => {
      mockPrismaService.document.findFirst.mockResolvedValue(null);

      await expect(service.getDocument(tenantId, documentId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("deleteDocument", () => {
    it("should delete document successfully", async () => {
      mockPrismaService.document.findFirst.mockResolvedValue(mockDocument);
      mockPrismaService.document.delete.mockResolvedValue(mockDocument);

      const result = await service.deleteDocument(tenantId, documentId);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Document deleted successfully");
      expect(mockPrismaService.document.delete).toHaveBeenCalledWith({
        where: { id: documentId },
      });
    });

    it("should throw NotFoundException if document not found", async () => {
      mockPrismaService.document.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteDocument(tenantId, documentId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("PDF Generation Features", () => {
    const generateDto: GenerateSheetDto = {
      recipeId,
      templateId,
      format: "A4" as any,
      includeNutrition: true,
      includeAllergens: true,
      includeCosts: true,
    };

    it("should handle recipe with allergens", async () => {
      const recipeWithAllergens = {
        ...mockRecipe,
        ingredients: [
          {
            ...mockRecipe.ingredients[0],
            product: {
              ...mockRecipe.ingredients[0].product,
              allergens: [1, 3],
            },
          },
        ],
      };

      mockPrismaService.recipe.findFirst.mockResolvedValue(recipeWithAllergens);
      mockPrismaService.technicalSheetTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );
      mockPrismaService.document.create.mockResolvedValue(mockDocument);

      const result = await service.generateTechnicalSheet(
        tenantId,
        userId,
        generateDto,
      );

      expect(result).toBeInstanceOf(Buffer);
    });

    it("should handle LETTER format", async () => {
      const letterDto: GenerateSheetDto = {
        ...generateDto,
        format: "LETTER" as any,
      };

      mockPrismaService.recipe.findFirst.mockResolvedValue(mockRecipe);
      mockPrismaService.technicalSheetTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );
      mockPrismaService.document.create.mockResolvedValue(mockDocument);

      const result = await service.generateTechnicalSheet(
        tenantId,
        userId,
        letterDto,
      );

      expect(result).toBeInstanceOf(Buffer);
    });

    it("should handle recipe without elaboration steps", async () => {
      const recipeWithoutSteps = {
        ...mockRecipe,
        elaboration: null,
      };

      mockPrismaService.recipe.findFirst.mockResolvedValue(recipeWithoutSteps);
      mockPrismaService.technicalSheetTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );
      mockPrismaService.document.create.mockResolvedValue(mockDocument);

      const result = await service.generateTechnicalSheet(
        tenantId,
        userId,
        generateDto,
      );

      expect(result).toBeInstanceOf(Buffer);
    });

    it("should calculate nutrition if not provided", async () => {
      const recipeWithoutNutrition = {
        ...mockRecipe,
        nutrition: null,
      };

      mockPrismaService.recipe.findFirst.mockResolvedValue(
        recipeWithoutNutrition,
      );
      mockPrismaService.technicalSheetTemplate.findFirst.mockResolvedValue(
        mockTemplate,
      );
      mockPrismaService.document.create.mockResolvedValue(mockDocument);

      const result = await service.generateTechnicalSheet(
        tenantId,
        userId,
        generateDto,
      );

      expect(result).toBeInstanceOf(Buffer);
    });
  });
});
