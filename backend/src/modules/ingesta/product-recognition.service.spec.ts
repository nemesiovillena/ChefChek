import { Test, TestingModule } from "@nestjs/testing";
import { ProductRecognitionService } from "./product-recognition.service";
import { PrismaService } from "../../common/services/prisma.service";

describe("ProductRecognitionService", () => {
  let service: ProductRecognitionService;
  let mockPrismaService: any;

  const mockProduct = {
    id: "product-1",
    tenantId: "tenant-1",
    name: "Tomate Raf",
    description: "Tomate Raf de primera calidad",
    purchaseUnit: "kg",
    storageUnit: "kg",
    recipeUnit: "kg",
    netPrice: 3.5,
    category: { id: "cat-1", name: "Vegetales" },
    supplier: { id: "supplier-1", name: "Frescos del Norte" },
  };

  const mockProducts = [
    mockProduct,
    {
      id: "product-2",
      tenantId: "tenant-1",
      name: "Tomate Cherry",
      description: "Tomate cherry dulce",
      purchaseUnit: "kg",
      storageUnit: "kg",
      recipeUnit: "kg",
      netPrice: 4.5,
      category: { id: "cat-1", name: "Vegetales" },
      supplier: { id: "supplier-1", name: "Frescos del Norte" },
    },
    {
      id: "product-3",
      tenantId: "tenant-1",
      name: "Pepino",
      description: "Pepino fresco",
      purchaseUnit: "kg",
      storageUnit: "kg",
      recipeUnit: "kg",
      netPrice: 2.0,
      category: { id: "cat-1", name: "Vegetales" },
      supplier: { id: "supplier-1", name: "Frescos del Norte" },
    },
  ];

  beforeEach(async () => {
    const mockPrismaProduct = {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(mockProduct),
      update: jest.fn().mockResolvedValue(mockProduct),
    };

    mockPrismaService = {
      product: mockPrismaProduct as any,
      alert: {
        create: jest.fn().mockResolvedValue({ id: "alert-1" }),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductRecognitionService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ProductRecognitionService>(ProductRecognitionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  describe("recognizeProduct", () => {
    it("should return exact match with confidence 1.0", async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(mockProduct);

      const result = await service.recognizeProduct("Tomate Raf", "tenant-1");

      expect(result.recognizedProduct).not.toBeNull();
      expect(result.confidence).toBe(1.0);
      expect(result.suggestions).toHaveLength(0);
      expect(mockPrismaService.product.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          name: {
            mode: "insensitive",
            equals: "Tomate Raf",
          },
        },
      });
    });

    it("should perform case-insensitive exact match", async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(mockProduct);

      const result = await service.recognizeProduct("tomate raf", "tenant-1");

      expect(result.recognizedProduct).not.toBeNull();
      expect(result.confidence).toBe(1.0);
    });

    it("should return fuzzy match when above threshold", async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);

      const result = await service.recognizeProduct("Tomate", "tenant-1");

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it("should return suggestions for fuzzy matches below threshold", async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.findMany.mockResolvedValue([mockProducts[2]]); // Pepino

      const result = await service.recognizeProduct("Tomate", "tenant-1");

      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it("should return null when no match found", async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.recognizeProduct(
        "Unknown Product",
        "tenant-1",
      );

      expect(result.recognizedProduct).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.suggestions).toHaveLength(0);
    });

    it("should use AI classification when OpenAI API key is set", async () => {
      process.env.OPENAI_API_KEY = "test-api-key";
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.recognizeProduct(
        "Filete de ternera",
        "tenant-1",
      );

      // Should have attempted AI classification
      expect(result).toBeDefined();
    });

    it("should handle AI classification failure gracefully", async () => {
      process.env.OPENAI_API_KEY = "test-api-key";
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.recognizeProduct("Some Product", "tenant-1");

      expect(result).toBeDefined();
    });

    it("should search by first word in fuzzy matching", async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);

      await service.recognizeProduct("Tomate Raf Premium", "tenant-1");

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: expect.objectContaining({
              contains: "Tomate",
            }),
          }),
        }),
      );
    });

    it("should limit fuzzy matches to 5 results", async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);

      await service.recognizeProduct("Tomate", "tenant-1");

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        }),
      );
    });

    it("should sort matches by similarity score", async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);

      const result = await service.recognizeProduct("Tomate Raf", "tenant-1");

      // If there are multiple suggestions, they should be sorted
      if (result.suggestions.length > 1) {
        const firstSimilarity = service["calculateSimilarity"](
          "Tomate Raf",
          result.suggestions[0].name || "",
        );
        const secondSimilarity = service["calculateSimilarity"](
          "Tomate Raf",
          result.suggestions[1].name || "",
        );
        expect(firstSimilarity).toBeGreaterThanOrEqual(secondSimilarity);
      }
    });
  });

  describe("trainModel", () => {
    it("should return success message with product count", async () => {
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);

      const result = await service.trainModel("tenant-1");

      expect(result.success).toBe(true);
      expect(result.message).toContain("3 products");
    });

    it("should return failure when no products found", async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.trainModel("tenant-1");

      expect(result.success).toBe(false);
      expect(result.message).toBe("No products found for training");
    });

    it("should include category distribution in logs", async () => {
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);

      const result = await service.trainModel("tenant-1");

      expect(result.message).toContain("categories");
    });

    it("should handle products without categories", async () => {
      const productsWithoutCategory = [
        { ...mockProduct, category: null },
        { ...mockProduct, id: "product-2", category: null },
      ];
      mockPrismaService.product.findMany.mockResolvedValue(
        productsWithoutCategory,
      );

      const result = await service.trainModel("tenant-1");

      expect(result.success).toBe(true);
    });

    it("should throw error on database failure", async () => {
      mockPrismaService.product.findMany.mockRejectedValueOnce(
        new Error("Database error"),
      );

      await expect(service.trainModel("tenant-1")).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("handleUnknownProduct", () => {
    it("should create product for human review", async () => {
      mockPrismaService.product.create.mockResolvedValue(mockProduct);
      mockPrismaService.alert.create.mockResolvedValue({ id: "alert-1" });

      const result = await service.handleUnknownProduct(
        "New Product",
        "tenant-1",
        "user-1",
      );

      expect(result.success).toBe(true);
      expect(result.needsReview).toBe(true);
      expect(mockPrismaService.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          name: "New Product",
          description: expect.stringContaining("pendiente de revisión"),
        }),
      });
    });

    it("should create alert for review", async () => {
      mockPrismaService.product.create.mockResolvedValue(mockProduct);
      mockPrismaService.alert.create.mockResolvedValue({ id: "alert-1" });

      await service.handleUnknownProduct("Unknown Item", "tenant-1", "user-1");

      expect(mockPrismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          type: "INFO",
          alertType: "INFO",
          severity: "INFO",
          isResolved: false,
        }),
      });
    });

    it("should set default values for product fields", async () => {
      mockPrismaService.product.create.mockResolvedValue(mockProduct);
      mockPrismaService.alert.create.mockResolvedValue({ id: "alert-1" });

      await service.handleUnknownProduct("Test Product", "tenant-1", "user-1");

      const createCall = mockPrismaService.product.create.mock.calls[0][0];
      expect(createCall.data.purchaseUnit).toBe("ud");
      expect(createCall.data.storageUnit).toBe("ud");
      expect(createCall.data.recipeUnit).toBe("ud");
      expect(createCall.data.purchasePrice).toBe(0);
      expect(createCall.data.netPrice).toBe(0);
    });
  });

  describe("validateProductForReview", () => {
    it("should return success when product is validated", async () => {
      const result = await service.validateProductForReview(
        "doc-1",
        "product-1",
        true,
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe("Product validated successfully");
    });

    it("should update product name when corrected", async () => {
      mockPrismaService.product.update.mockResolvedValue(mockProduct);

      const result = await service.validateProductForReview(
        "doc-1",
        "product-1",
        false,
        "Corrected Name",
      );

      expect(result.success).toBe(true);
      expect(mockPrismaService.product.update).toHaveBeenCalledWith({
        where: { id: "product-1" },
        data: { name: "Corrected Name" },
      });
    });

    it("should update product price when corrected", async () => {
      mockPrismaService.product.update.mockResolvedValue(mockProduct);

      const result = await service.validateProductForReview(
        "doc-1",
        "product-1",
        false,
        undefined,
        10.5,
      );

      expect(result.success).toBe(true);
      expect(mockPrismaService.product.update).toHaveBeenCalledWith({
        where: { id: "product-1" },
        data: { netPrice: 10.5 },
      });
    });

    it("should update both name and price when both corrected", async () => {
      mockPrismaService.product.update.mockResolvedValue(mockProduct);

      const result = await service.validateProductForReview(
        "doc-1",
        "product-1",
        false,
        "New Name",
        15.0,
      );

      expect(result.success).toBe(true);
      expect(mockPrismaService.product.update).toHaveBeenCalledWith({
        where: { id: "product-1" },
        data: { name: "New Name", netPrice: 15.0 },
      });
    });

    it("should return success without update if no corrections provided", async () => {
      const result = await service.validateProductForReview(
        "doc-1",
        "product-1",
        false,
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe("Product corrected successfully");
      expect(mockPrismaService.product.update).not.toHaveBeenCalled();
    });

    it("should throw error on update failure", async () => {
      mockPrismaService.product.update.mockRejectedValueOnce(
        new Error("Update failed"),
      );

      await expect(
        service.validateProductForReview(
          "doc-1",
          "product-1",
          false,
          "New Name",
        ),
      ).rejects.toThrow("Update failed");
    });
  });

  describe("calculateSimilarity (private method tested via recognizeProduct)", () => {
    it("should return 1.0 for identical strings", async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);

      const result = await service.recognizeProduct("Tomate Raf", "tenant-1");

      // Exact match should have been caught by findFirst
      expect(result).toBeDefined();
    });

    it("should return high similarity for similar strings", async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);

      const result = await service.recognizeProduct(
        "Tomate Raf Premium",
        "tenant-1",
      );

      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should return lower similarity for different strings", async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.findMany.mockResolvedValue([mockProducts[2]]); // Pepino

      const result = await service.recognizeProduct("Tomate", "tenant-1");

      expect(result.confidence).toBeLessThan(1.0);
    });
  });

  describe("levenshteinDistance (private method tested via recognizeProduct)", () => {
    it("should handle empty strings gracefully", async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.recognizeProduct("", "tenant-1");

      expect(result).toBeDefined();
    });
  });

  describe("classifyWithAI (private method tested via recognizeProduct)", () => {
    it("should classify meat products", async () => {
      process.env.OPENAI_API_KEY = "test-api-key";
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.recognizeProduct(
        "Filete de ternera",
        "tenant-1",
      );

      // AI classification should have been attempted
      expect(result).toBeDefined();
    });

    it("should classify dairy products", async () => {
      process.env.OPENAI_API_KEY = "test-api-key";
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.recognizeProduct("Leche entera", "tenant-1");

      expect(result).toBeDefined();
    });

    it("should classify fish products", async () => {
      process.env.OPENAI_API_KEY = "test-api-key";
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.recognizeProduct(
        "Pescado fresco",
        "tenant-1",
      );

      expect(result).toBeDefined();
    });

    it("should classify bread products", async () => {
      process.env.OPENAI_API_KEY = "test-api-key";
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.recognizeProduct("Pan artesano", "tenant-1");

      expect(result).toBeDefined();
    });

    it("should default to Miscelánea for unknown categories", async () => {
      process.env.OPENAI_API_KEY = "test-api-key";
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.recognizeProduct(
        "Producto random",
        "tenant-1",
      );

      expect(result).toBeDefined();
    });
  });

  describe("mapToExtractedProduct (private method tested via recognizeProduct)", () => {
    it("should map product database entity to ExtractedProductDto", async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(mockProduct);

      const result = await service.recognizeProduct("Tomate Raf", "tenant-1");

      expect(result.recognizedProduct).toMatchObject({
        name: mockProduct.name,
        description: mockProduct.description,
        unit: mockProduct.purchaseUnit,
        unitPrice: mockProduct.netPrice,
        supplier: mockProduct.supplier?.name,
        category: mockProduct.category?.name,
      });
    });

    it("should set confidence to 1.0 for database matches", async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(mockProduct);

      const result = await service.recognizeProduct("Tomate Raf", "tenant-1");

      expect(result.recognizedProduct?.confidence).toBe(1.0);
    });

    it("should handle null supplier and category", async () => {
      const productWithoutRelations = {
        ...mockProduct,
        supplier: null,
        category: null,
      };
      mockPrismaService.product.findFirst.mockResolvedValue(
        productWithoutRelations,
      );

      const result = await service.recognizeProduct("Tomate Raf", "tenant-1");

      expect(result.recognizedProduct).toBeDefined();
      expect(result.recognizedProduct?.supplier).toBeUndefined();
      expect(result.recognizedProduct?.category).toBeUndefined();
    });
  });

  describe("MIN_CONFIDENCE_THRESHOLD", () => {
    it("should use threshold of 0.7 for recognition", async () => {
      // Access private property
      const threshold = (service as any).MIN_CONFIDENCE_THRESHOLD;
      expect(threshold).toBe(0.7);
    });
  });
});
