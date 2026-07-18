import { Test, TestingModule } from "@nestjs/testing";
import { LineMatchingService } from "./line-matching.service";
import { PrismaService } from "../../../common/services/prisma.service";
import { ProductRecognitionService } from "../../ocr/product-recognition.service";
import { LineMatchStatus } from "@prisma/client";

describe("LineMatchingService", () => {
  let service: LineMatchingService;
  let mockPrisma: any;
  let mockProductRecognition: any;

  const mockTenantId = "tenant-123";
  const mockProductId = "product-456";
  const mockAlbaranId = "albaran-789";

  beforeEach(async () => {
    mockPrisma = {
      product: {
        findFirst: jest.fn(),
      },
      albaran: {
        findFirst: jest.fn(),
      },
      albaranLine: {
        update: jest.fn(),
      },
      supplierProductAlias: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    mockProductRecognition = {
      recognizeProduct: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LineMatchingService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ProductRecognitionService,
          useValue: mockProductRecognition,
        },
      ],
    }).compile();

    service = module.get<LineMatchingService>(LineMatchingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("matchLine", () => {
    describe("article number (barcode) matching", () => {
      it("should return MATCH_ALTO with confidence 1.0 for exact barcode match", async () => {
        const articleNumber = "8437000001234";
        const description = "Aceite de oliva virgen extra";

        mockPrisma.product.findFirst.mockResolvedValueOnce({
          id: mockProductId,
          name: "Aceite de oliva",
        });

        const result = await service.matchLine({
          description,
          articleNumber,
          tenantId: mockTenantId,
        });

        expect(result).toEqual({
          matchedProductId: mockProductId,
          matchStatus: LineMatchStatus.MATCH_ALTO,
          confidence: 1.0,
          suggestions: [],
        });

        expect(mockPrisma.product.findFirst).toHaveBeenCalledWith({
          where: {
            tenantId: mockTenantId,
            barcode: articleNumber,
          },
          select: {
            id: true,
            name: true,
          },
        });
      });

      it("should fall back to description match if barcode not found", async () => {
        const articleNumber = "8437000009999";
        const description = "Tomate frito";

        // No barcode match
        mockPrisma.product.findFirst
          .mockResolvedValueOnce(null)
          // Product lookup for high confidence match
          .mockResolvedValueOnce({ id: mockProductId });

        mockProductRecognition.recognizeProduct.mockResolvedValue({
          recognizedProduct: {
            name: "Tomate frito",
            unit: "kg",
            unitPrice: 2.5,
            confidence: 0.95,
          },
          confidence: 0.95,
          suggestions: [],
        });

        const result = await service.matchLine({
          description,
          articleNumber,
          tenantId: mockTenantId,
        });

        expect(result.matchStatus).toBe(LineMatchStatus.MATCH_ALTO);
        expect(result.matchedProductId).toBe(mockProductId);
        expect(mockProductRecognition.recognizeProduct).toHaveBeenCalledWith(
          description,
          mockTenantId,
        );
      });
    });

    describe("description matching", () => {
      it("should return MATCH_ALTO for high confidence match (>= 0.8)", async () => {
        const description = "Aceite de oliva virgen extra 5L";

        mockProductRecognition.recognizeProduct.mockResolvedValue({
          recognizedProduct: {
            name: "Aceite de oliva virgen extra",
            unit: "L",
            unitPrice: 25.0,
            confidence: 0.92,
          },
          confidence: 0.92,
          suggestions: [],
        });

        mockPrisma.product.findFirst.mockResolvedValue({ id: mockProductId });

        const result = await service.matchLine({
          description,
          tenantId: mockTenantId,
        });

        expect(result).toEqual({
          matchedProductId: mockProductId,
          matchStatus: LineMatchStatus.MATCH_ALTO,
          confidence: 0.92,
          suggestions: [],
        });
      });

      it("should return MATCH_DUDOSO with suggestions for medium confidence (0.5-0.8)", async () => {
        const description = "Aceite";

        mockProductRecognition.recognizeProduct.mockResolvedValue({
          recognizedProduct: {
            name: "Aceite genérico",
            unit: "L",
            unitPrice: 15.0,
            confidence: 0.65,
          },
          confidence: 0.65,
          suggestions: [
            { name: "Aceite de oliva", unitPrice: 25.0, unit: "L" },
            { name: "Aceite de girasol", unitPrice: 12.0, unit: "L" },
          ],
        });

        const result = await service.matchLine({
          description,
          tenantId: mockTenantId,
        });

        expect(result.matchStatus).toBe(LineMatchStatus.MATCH_DUDOSO);
        expect(result.matchedProductId).toBeNull();
        expect(result.confidence).toBe(0.65);
        expect(result.suggestions).toHaveLength(2);
        expect(result.suggestions[0].name).toBe("Aceite de oliva");
      });

      it("should return NUEVO for low confidence (< 0.5)", async () => {
        const description = "Producto desconocido XYZ";

        mockProductRecognition.recognizeProduct.mockResolvedValue({
          recognizedProduct: null,
          confidence: 0.3,
          suggestions: [],
        });

        const result = await service.matchLine({
          description,
          tenantId: mockTenantId,
        });

        expect(result).toEqual({
          matchedProductId: null,
          matchStatus: LineMatchStatus.NUEVO,
          confidence: 0.3,
          suggestions: [],
        });
      });

      it("should return NUEVO for empty description", async () => {
        const result = await service.matchLine({
          description: "",
          tenantId: mockTenantId,
        });

        expect(result).toEqual({
          matchedProductId: null,
          matchStatus: LineMatchStatus.NUEVO,
          confidence: 0,
          suggestions: [],
        });

        expect(mockProductRecognition.recognizeProduct).not.toHaveBeenCalled();
      });

      it("should return NUEVO for whitespace-only description", async () => {
        const result = await service.matchLine({
          description: "   ",
          tenantId: mockTenantId,
        });

        expect(result).toEqual({
          matchedProductId: null,
          matchStatus: LineMatchStatus.NUEVO,
          confidence: 0,
          suggestions: [],
        });
      });

      it("should limit suggestions to top 5", async () => {
        const description = "Aceite";

        mockProductRecognition.recognizeProduct.mockResolvedValue({
          recognizedProduct: null,
          confidence: 0.6,
          suggestions: [
            { name: "Aceite 1", unitPrice: 10, unit: "L" },
            { name: "Aceite 2", unitPrice: 11, unit: "L" },
            { name: "Aceite 3", unitPrice: 12, unit: "L" },
            { name: "Aceite 4", unitPrice: 13, unit: "L" },
            { name: "Aceite 5", unitPrice: 14, unit: "L" },
            { name: "Aceite 6", unitPrice: 15, unit: "L" },
            { name: "Aceite 7", unitPrice: 16, unit: "L" },
          ],
        });

        const result = await service.matchLine({
          description,
          tenantId: mockTenantId,
        });

        expect(result.suggestions).toHaveLength(5);
      });
    });

    describe("supplier alias matching", () => {
      const mockSupplierId = "supplier-321";

      it("should return MATCH_ALTO from a confirmed alias without calling recognition", async () => {
        mockPrisma.supplierProductAlias.findUnique.mockResolvedValue({
          productId: mockProductId,
        });

        const result = await service.matchLine({
          description: "JARRETE CORD. 1RA",
          tenantId: mockTenantId,
          supplierId: mockSupplierId,
        });

        expect(result).toEqual({
          matchedProductId: mockProductId,
          matchStatus: LineMatchStatus.MATCH_ALTO,
          confidence: 1.0,
          suggestions: [],
        });
        expect(mockPrisma.supplierProductAlias.findUnique).toHaveBeenCalledWith(
          {
            where: {
              tenantId_supplierId_normalizedDescription: {
                tenantId: mockTenantId,
                supplierId: mockSupplierId,
                normalizedDescription: "jarrete cord 1ra",
              },
            },
          },
        );
        expect(mockProductRecognition.recognizeProduct).not.toHaveBeenCalled();
      });

      it("should fall back to recognition when no alias matches", async () => {
        mockPrisma.supplierProductAlias.findUnique.mockResolvedValue(null);
        mockProductRecognition.recognizeProduct.mockResolvedValue({
          recognizedProduct: null,
          confidence: 0.3,
          suggestions: [],
        });

        const result = await service.matchLine({
          description: "Producto nuevo",
          tenantId: mockTenantId,
          supplierId: mockSupplierId,
        });

        expect(result.matchStatus).toBe(LineMatchStatus.NUEVO);
        expect(mockProductRecognition.recognizeProduct).toHaveBeenCalled();
      });

      it("should skip alias lookup when no supplierId is provided", async () => {
        mockProductRecognition.recognizeProduct.mockResolvedValue({
          recognizedProduct: null,
          confidence: 0.3,
          suggestions: [],
        });

        await service.matchLine({
          description: "Producto sin proveedor",
          tenantId: mockTenantId,
        });

        expect(
          mockPrisma.supplierProductAlias.findUnique,
        ).not.toHaveBeenCalled();
      });
    });

    describe("product ID resolution", () => {
      it("should find product ID by name for recognized product", async () => {
        const description = "Tomate frito";

        mockProductRecognition.recognizeProduct.mockResolvedValue({
          recognizedProduct: {
            name: "Tomate frito",
            unit: "kg",
            unitPrice: 2.5,
            confidence: 0.95,
          },
          confidence: 0.95,
          suggestions: [],
        });

        mockPrisma.product.findFirst.mockResolvedValue({ id: mockProductId });

        await service.matchLine({
          description,
          tenantId: mockTenantId,
        });

        expect(mockPrisma.product.findFirst).toHaveBeenCalledWith({
          where: {
            tenantId: mockTenantId,
            name: {
              mode: "insensitive",
              equals: "Tomate frito",
            },
          },
          select: { id: true },
        });
      });

      it("should handle case-insensitive product name matching", async () => {
        const description = "TOMATE Frito";

        mockProductRecognition.recognizeProduct.mockResolvedValue({
          recognizedProduct: {
            name: "tomate frito",
            unit: "kg",
            unitPrice: 2.5,
            confidence: 0.95,
          },
          confidence: 0.95,
          suggestions: [],
        });

        mockPrisma.product.findFirst.mockResolvedValue({ id: mockProductId });

        const result = await service.matchLine({
          description,
          tenantId: mockTenantId,
        });

        expect(result.matchedProductId).toBe(mockProductId);
      });
    });
  });

  describe("matchAllLines", () => {
    it("should match all lines of an albaran", async () => {
      const mockLines = [
        {
          id: "line-1",
          description: "Aceite de oliva",
          articleNumber: "8437000001234",
        },
        {
          id: "line-2",
          description: "Tomate frito",
          articleNumber: null,
        },
      ];

      mockPrisma.albaran.findFirst.mockResolvedValue({
        id: mockAlbaranId,
        lines: mockLines,
      });

      // First line: barcode match
      mockPrisma.product.findFirst
        .mockResolvedValueOnce({ id: "product-1", name: "Aceite" })
        // Second line: no barcode match
        .mockResolvedValueOnce(null)
        // Second line: product lookup
        .mockResolvedValueOnce({ id: "product-2" });

      mockProductRecognition.recognizeProduct.mockResolvedValue({
        recognizedProduct: {
          name: "Tomate frito",
          unit: "kg",
          unitPrice: 2.5,
          confidence: 0.95,
        },
        confidence: 0.95,
        suggestions: [],
      });

      mockPrisma.albaranLine.update.mockResolvedValue({});

      await service.matchAllLines(mockAlbaranId, mockTenantId);

      expect(mockPrisma.albaranLine.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.albaranLine.update).toHaveBeenCalledWith({
        where: { id: "line-1" },
        data: expect.objectContaining({
          matchStatus: LineMatchStatus.MATCH_ALTO,
          confidence: 1.0,
        }),
      });
      expect(mockPrisma.albaranLine.update).toHaveBeenCalledWith({
        where: { id: "line-2" },
        data: expect.objectContaining({
          matchStatus: LineMatchStatus.MATCH_ALTO,
        }),
      });
    });

    it("should handle albaran not found gracefully", async () => {
      mockPrisma.albaran.findFirst.mockResolvedValue(null);

      await service.matchAllLines("non-existent", mockTenantId);

      expect(mockPrisma.albaranLine.update).not.toHaveBeenCalled();
    });

    it("should continue processing if one line fails", async () => {
      const mockLines = [
        { id: "line-1", description: "Aceite", articleNumber: null },
        { id: "line-2", description: "Tomate", articleNumber: null },
      ];

      mockPrisma.albaran.findFirst.mockResolvedValue({
        id: mockAlbaranId,
        lines: mockLines,
      });

      mockProductRecognition.recognizeProduct
        .mockRejectedValueOnce(new Error("Recognition failed"))
        .mockResolvedValueOnce({
          recognizedProduct: {
            name: "Tomate",
            unit: "kg",
            unitPrice: 2.5,
            confidence: 0.95,
          },
          confidence: 0.95,
          suggestions: [],
        });

      mockPrisma.product.findFirst.mockResolvedValue({ id: "product-2" });
      mockPrisma.albaranLine.update.mockResolvedValue({});

      await service.matchAllLines(mockAlbaranId, mockTenantId);

      // Second line should still be processed
      expect(mockPrisma.albaranLine.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.albaranLine.update).toHaveBeenCalledWith({
        where: { id: "line-2" },
        data: expect.any(Object),
      });
    });

    it("should handle empty lines array", async () => {
      mockPrisma.albaran.findFirst.mockResolvedValue({
        id: mockAlbaranId,
        lines: [],
      });

      await service.matchAllLines(mockAlbaranId, mockTenantId);

      expect(mockPrisma.albaranLine.update).not.toHaveBeenCalled();
    });
  });

  describe("rememberAlias", () => {
    const mockSupplierId = "supplier-321";

    it("should upsert a normalized alias for the supplier", async () => {
      await service.rememberAlias({
        tenantId: mockTenantId,
        supplierId: mockSupplierId,
        description: "  JARRETE   Córd. 1ra  ",
        productId: mockProductId,
        confirmedBy: "user-1",
      });

      expect(mockPrisma.supplierProductAlias.upsert).toHaveBeenCalledWith({
        where: {
          tenantId_supplierId_normalizedDescription: {
            tenantId: mockTenantId,
            supplierId: mockSupplierId,
            normalizedDescription: "jarrete cord 1ra",
          },
        },
        create: {
          tenantId: mockTenantId,
          supplierId: mockSupplierId,
          normalizedDescription: "jarrete cord 1ra",
          productId: mockProductId,
          confirmedBy: "user-1",
        },
        update: {
          productId: mockProductId,
          confirmedBy: "user-1",
        },
      });
    });

    it("should not throw when the upsert fails (best-effort)", async () => {
      mockPrisma.supplierProductAlias.upsert.mockRejectedValue(
        new Error("db error"),
      );

      await expect(
        service.rememberAlias({
          tenantId: mockTenantId,
          supplierId: mockSupplierId,
          description: "Jarrete de cordero",
          productId: mockProductId,
        }),
      ).resolves.toBeUndefined();
    });

    it("should skip the upsert for an empty description", async () => {
      await service.rememberAlias({
        tenantId: mockTenantId,
        supplierId: mockSupplierId,
        description: "   ",
        productId: mockProductId,
      });

      expect(mockPrisma.supplierProductAlias.upsert).not.toHaveBeenCalled();
    });
  });
});
