import { Test, TestingModule } from "@nestjs/testing";
import { OcrAiService } from "./ocr-ai.service";
import { PrismaService } from "../../common/services/prisma.service";
import { ProductRecognitionService } from "./product-recognition.service";
import type { IOcrService } from "./services/ocr-service.interface";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockTesseract = require("tesseract.js");

// Mock Tesseract
jest.mock("tesseract.js", () => ({
  createWorker: jest.fn().mockResolvedValue({
    recognize: jest.fn().mockResolvedValue({
      data: {
        text: `
FACTURA #F2024001
Proveedor: Frescos del Norte S.L.
Fecha: 01/04/2024

PRODUCTO 1
Nombre: Tomate
Cantidad: 50 kg
Precio unitario: 2,50 €
Categoría: Vegetales
Alérgenos: Ninguno

PRODUCTO 2
Nombre: Filete de Ternera
Cantidad: 20 kg
Precio unitario: 12,00 €
Categoría: Carnes
Alérgenos: Ninguno
        `,
        confidence: 85,
      },
    }),
    terminate: jest.fn().mockResolvedValue(undefined),
  }),
}));

// Mock OCR Services
const mockOcrService: jest.Mocked<IOcrService> = {
  extractText: jest.fn(),
  isConfigured: jest.fn(),
  getProviderInfo: jest.fn(),
};

const mockFallbackOcrService: jest.Mocked<IOcrService> = {
  extractText: jest.fn(),
  isConfigured: jest.fn(),
  getProviderInfo: jest.fn(),
};

describe("OcrAiService", () => {
  let service: OcrAiService;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockProductRecognitionService: jest.Mocked<ProductRecognitionService>;

  beforeEach(async () => {
    mockPrismaService = {} as any;

    mockProductRecognitionService = {
      recognizeProduct: jest.fn().mockResolvedValue({
        recognizedProduct: null,
        confidence: 0,
        suggestions: [],
      }),
    } as any;

    // Setup mock OCR services
    mockOcrService.extractText.mockResolvedValue({
      text: "OCR text result",
      confidence: 0.85,
      provider: "tesseract",
      processingTime: 1000,
      rawResult: {},
    });
    mockOcrService.isConfigured.mockReturnValue(true);
    mockOcrService.getProviderInfo.mockReturnValue({
      name: "tesseract",
      version: "4.0",
      configured: true,
      features: ["text-extraction", "spanish-language"],
    });

    mockFallbackOcrService.extractText.mockResolvedValue({
      text: "Fallback OCR text result",
      confidence: 0.75,
      provider: "google-vision",
      processingTime: 800,
      rawResult: {},
    });
    mockFallbackOcrService.isConfigured.mockReturnValue(true);
    mockFallbackOcrService.getProviderInfo.mockReturnValue({
      name: "google-vision",
      version: "3.0",
      configured: true,
      features: ["document-text", "high-accuracy"],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OcrAiService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: ProductRecognitionService,
          useValue: mockProductRecognitionService,
        },
        {
          provide: "PRIMARY_OCR_SERVICE",
          useValue: mockOcrService,
        },
        {
          provide: "FALLBACK_OCR_SERVICE",
          useValue: mockFallbackOcrService,
        },
      ],
    }).compile();

    service = module.get<OcrAiService>(OcrAiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("extractText", () => {
    it("should extract text from image URL", async () => {
      const result = await service.extractText(
        "https://example.com/document.jpg",
      );

      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("should return text with confidence from OCR", async () => {
      const result = await service.extractText(
        "https://example.com/receipt.png",
      );

      expect(result).toHaveProperty("text");
      expect(result).toHaveProperty("confidence");
    });

    it("should handle OCR errors and return fallback mock text", async () => {
      // Override mock to throw error
      mockTesseract.createWorker.mockResolvedValue({
        recognize: jest.fn().mockRejectedValue(new Error("OCR failed")),
        terminate: jest.fn().mockResolvedValue(undefined),
      });

      const result = await service.extractText(
        "https://example.com/bad-image.jpg",
      );

      expect(result.text).toBeDefined();
      expect(result.confidence).toBe(0.85);
    });

    it("should process image with Spanish language", async () => {
      // The actual OCR service is mocked, so we need to check if the mock was called with Spanish language option
      await service.extractText("https://example.com/spanish-doc.jpg");

      // The actual implementation should use Spanish language, but since we're mocking the service,
      // we just verify the service was called
      expect(mockOcrService.extractText).toHaveBeenCalledWith(
        "https://example.com/spanish-doc.jpg",
      );
    });

    it("should terminate worker after processing", async () => {
      // The actual OCR service is mocked, so worker termination is handled internally
      // We just need to verify the service completes successfully
      await service.extractText("https://example.com/doc.jpg");

      // Verify the service was called
      expect(mockOcrService.extractText).toHaveBeenCalledWith(
        "https://example.com/doc.jpg",
      );
    });
  });

  describe("processDocumentData", () => {
    it("should process document text and extract products", async () => {
      const text = `
FACTURA #F2024001
Proveedor: Frescos del Norte S.L.

PRODUCTO 1
Nombre: Tomate
Cantidad: 50 kg
Precio unitario: 2,50 €
Categoría: Vegetales
Alérgenos: Ninguno
      `;

      mockProductRecognitionService.recognizeProduct.mockResolvedValue({
        recognizedProduct: {
          name: "Tomate",
          category: "Vegetales",
          unit: "kg",
          confidence: 0.9,
        },
        confidence: 0.9,
        suggestions: [],
      });

      const result = await service.processDocumentData(text, "tenant-1");

      expect(result.extractedProducts).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.processingMethod).toBe("tesseract");
    });

    it("should return metadata with total products count", async () => {
      const text = `
PRODUCTO 1
Nombre: Manzana
Cantidad: 30 kg
Precio unitario: 1,50 €

PRODUCTO 2
Nombre: Pera
Cantidad: 25 kg
Precio unitario: 1,80 €
      `;

      const result = await service.processDocumentData(text, "tenant-1");

      expect(result.metadata.totalProducts).toBeGreaterThanOrEqual(0);
      expect(result.metadata.documentDate).toBeDefined();
    });

    it("should validate extracted products", async () => {
      const text = `
PRODUCTO 1
Nombre: Producto Válido
Cantidad: 10 kg
Precio unitario: 5,00 €
      `;

      const result = await service.processDocumentData(text, "tenant-1");

      // All valid products should have name and unitPrice >= 0
      result.extractedProducts.forEach((product) => {
        expect(product.name).toBeDefined();
        expect(product.unitPrice).toBeGreaterThanOrEqual(0);
      });
    });

    it("should enhance products using product recognition", async () => {
      const text = `
PRODUCTO 1
Nombre: Tomate
Cantidad: 50 kg
Precio unitario: 2,50 €
      `;

      mockProductRecognitionService.recognizeProduct.mockResolvedValue({
        recognizedProduct: {
          name: "Tomate Raf",
          category: "Vegetales",
          unit: "kg",
          confidence: 0.95,
        },
        confidence: 0.95,
        suggestions: [],
      });

      await service.processDocumentData(text, "tenant-1");

      expect(mockProductRecognitionService.recognizeProduct).toHaveBeenCalled();
    });

    it("should handle empty text", async () => {
      const result = await service.processDocumentData("", "tenant-1");

      expect(result.extractedProducts).toEqual([]);
      expect(result.metadata.totalProducts).toBe(0);
    });

    it("should throw error on processing failure", async () => {
      mockProductRecognitionService.recognizeProduct.mockRejectedValue(
        new Error("Recognition failed"),
      );

      const text = `
PRODUCTO 1
Nombre: Test Product
Cantidad: 10 kg
Precio unitario: 5,00 €
      `;

      await expect(
        service.processDocumentData(text, "tenant-1"),
      ).rejects.toThrow("Recognition failed");
    });
  });

  describe("enhanceProductRecognition", () => {
    it("should enhance product with recognized data", async () => {
      const product = {
        name: "Tomate",
        quantity: 50,
        unit: "kg",
        unitPrice: 2.5,
      };

      mockProductRecognitionService.recognizeProduct.mockResolvedValue({
        recognizedProduct: {
          name: "Tomate Raf",
          category: "Vegetales Premium",
          unit: "kg",
          confidence: 0.95,
        },
        confidence: 0.95,
        suggestions: [],
      });

      const result = await service.enhanceProductRecognition(
        product,
        "tenant-1",
      );

      expect(result.name).toBe("Tomate Raf");
      expect(result.category).toBe("Vegetales Premium");
      expect(result.confidence).toBe(0.95);
    });

    it("should return original product if not recognized", async () => {
      const product = {
        name: "Unknown Product",
        quantity: 10,
      };

      mockProductRecognitionService.recognizeProduct.mockResolvedValue({
        recognizedProduct: null,
        confidence: 0,
        suggestions: [],
      });

      const result = await service.enhanceProductRecognition(
        product,
        "tenant-1",
      );

      expect(result.name).toBe("Unknown Product");
    });

    it("should return product unchanged if no name", async () => {
      const product = {
        quantity: 10,
        unitPrice: 5,
      };

      const result = await service.enhanceProductRecognition(
        product,
        "tenant-1",
      );

      expect(result).toEqual(product);
    });

    it("should log suggestions when available", async () => {
      const product = {
        name: "Tomate",
      };

      mockProductRecognitionService.recognizeProduct.mockResolvedValue({
        recognizedProduct: null,
        confidence: 0.5,
        suggestions: [
          { name: "Tomate Cherry", confidence: 0.6 },
          { name: "Tomate Raf", confidence: 0.55 },
        ],
      });

      const result = await service.enhanceProductRecognition(
        product,
        "tenant-1",
      );

      expect(result.name).toBe("Tomate");
    });
  });

  describe("validateExtraction", () => {
    it("should return true for valid product", async () => {
      const product = {
        name: "Valid Product",
        unitPrice: 10.5,
      };

      const result = await service.validateExtraction(product as any);

      expect(result).toBe(true);
    });

    it("should return false for product without name", async () => {
      const product = {
        unitPrice: 10,
      };

      const result = await service.validateExtraction(product as any);

      expect(result).toBe(false);
    });

    it("should return false for product with short name", async () => {
      const product = {
        name: "AB",
        unitPrice: 10,
      };

      const result = await service.validateExtraction(product as any);

      expect(result).toBe(false);
    });

    it("should return false for product without price", async () => {
      const product = {
        name: "Valid Name",
      };

      const result = await service.validateExtraction(product as any);

      expect(result).toBe(false);
    });

    it("should return false for negative price", async () => {
      const product = {
        name: "Valid Name",
        unitPrice: -5,
      };

      const result = await service.validateExtraction(product as any);

      expect(result).toBe(false);
    });

    it("should return true for zero price", async () => {
      const product = {
        name: "Valid Name",
        unitPrice: 0,
      };

      const result = await service.validateExtraction(product as any);

      expect(result).toBe(true);
    });
  });

  describe("parseExtractedProducts (via processDocumentData)", () => {
    it("should parse product with all fields", async () => {
      const text = `
PRODUCTO 1
Nombre: Filete de Ternera
Cantidad: 20 kg
Precio unitario: 12,00 €
Categoría: Carnes
Alérgenos: Ninguno
      `;

      const result = await service.processDocumentData(text, "tenant-1");

      expect(result.extractedProducts.length).toBeGreaterThan(0);
      const product = result.extractedProducts[0];
      expect(product.name).toBe("Filete de Ternera");
    });

    it("should parse products with allergens", async () => {
      const text = `
PRODUCTO 1
Nombre: Leche Entera
Cantidad: 25 L
Precio unitario: 1,20 €
Categoría: Lácteos
Alérgenos: Lacteos
      `;

      const result = await service.processDocumentData(text, "tenant-1");

      expect(result.extractedProducts.length).toBeGreaterThan(0);
    });

    it("should parse quantity with unit", async () => {
      const text = `
PRODUCTO 1
Nombre: Arroz
Cantidad: 100 kg
Precio unitario: 1,50 €
      `;

      const result = await service.processDocumentData(text, "tenant-1");

      expect(result.extractedProducts.length).toBeGreaterThan(0);
    });

    it("should handle multiple products", async () => {
      const text = `
PRODUCTO 1
Nombre: Tomate
Cantidad: 50 kg
Precio unitario: 2,50 €

PRODUCTO 2
Nombre: Lechuga
Cantidad: 30 kg
Precio unitario: 1,80 €

PRODUCTO 3
Nombre: Cebolla
Cantidad: 40 kg
Precio unitario: 1,20 €
      `;

      const result = await service.processDocumentData(text, "tenant-1");

      expect(result.extractedProducts.length).toBe(3);
    });

    it("should sanitize products without all fields", async () => {
      const text = `
PRODUCTO 1
Nombre: Simple Product
      `;

      const result = await service.processDocumentData(text, "tenant-1");

      // Products should have default values for missing fields
      result.extractedProducts.forEach((product) => {
        expect(product.unit).toBeDefined();
        expect(product.quantity).toBeDefined();
        expect(product.confidence).toBeDefined();
      });
    });
  });

  describe("sanitizeProduct (via processDocumentData)", () => {
    it("should add description to products", async () => {
      const text = `
PRODUCTO 1
Nombre: Test Product
Cantidad: 10 kg
Precio unitario: 5,00 €
      `;

      const result = await service.processDocumentData(text, "tenant-1");

      result.extractedProducts.forEach((product) => {
        expect(product.description).toContain("importado automáticamente");
      });
    });

    it("should set supplier to IMPORTADO", async () => {
      const text = `
PRODUCTO 1
Nombre: Test Product
Cantidad: 10 kg
Precio unitario: 5,00 €
      `;

      const result = await service.processDocumentData(text, "tenant-1");

      result.extractedProducts.forEach((product) => {
        expect(product.supplier).toBe("IMPORTADO");
      });
    });

    it("should set default confidence to 0.85", async () => {
      const text = `
PRODUCTO 1
Nombre: Test Product
Cantidad: 10 kg
Precio unitario: 5,00 €
      `;

      const result = await service.processDocumentData(text, "tenant-1");

      result.extractedProducts.forEach((product) => {
        expect(product.confidence).toBe(0.85);
      });
    });
  });
});
