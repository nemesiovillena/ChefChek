import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PythonOcrService } from "./python-ocr.service";
import axios from "axios";

// Mock de Axios
const mockAxiosPost = jest.fn();
const mockAxiosGet = jest.fn();

jest.mock("axios", () => {
  return {
    create: jest.fn().mockImplementation(() => {
      return {
        post: mockAxiosPost,
        get: mockAxiosGet,
      };
    }),
  };
});

describe("PythonOcrService", () => {
  let service: PythonOcrService;
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    mockAxiosPost.mockReset();
    mockAxiosGet.mockReset();
    configService = { get: jest.fn() };

    configService.get.mockImplementation((key: string, defaultValue?: any) => {
      if (key === "OCR_SERVICE_URL") {
        return "http://mock-ocr-url:8000";
      }
      return defaultValue;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PythonOcrService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<PythonOcrService>(PythonOcrService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("isConfigured", () => {
    it("should return true if ocrServiceUrl is set", () => {
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe("getProviderInfo", () => {
    it("should return metadata about PaddleOCR microservice", () => {
      const info = service.getProviderInfo();
      expect(info.name).toBe("PaddleOCR Microservice");
      expect(info.features).toContain("TEXT_DETECTION");
    });
  });

  describe("extractText", () => {
    it("should process base64 file and return text & confidence on success", async () => {
      const mockResult = {
        success: true,
        document: {
          raw_text: "TEXTO EXTRAIDO DE ALBARAN",
          confidence: 0.92,
          products: [{ name: "Producto 1", quantity: 5, unit_price: 1.2 }],
        },
      };
      mockAxiosPost.mockResolvedValue({ data: mockResult });

      const fileUrl = "data:image/jpeg;base64,mockbase64data";
      const result = await service.extractText(fileUrl);

      expect(result.text).toBe("TEXTO EXTRAIDO DE ALBARAN");
      expect(result.confidence).toBe(0.92);
      expect(result.provider).toBe("paddleocr-microservice");
      expect(mockAxiosPost).toHaveBeenCalledWith(
        "/ocr/image",
        expect.any(FormData),
        expect.any(Object),
      );
    });

    it("should throw error if microservice returns success: false", async () => {
      mockAxiosPost.mockResolvedValue({
        data: { success: false, error: "Internal processing error" },
      });

      const fileUrl = "data:image/jpeg;base64,mockbase64data";
      await expect(service.extractText(fileUrl)).rejects.toThrow(
        "Internal processing error",
      );
    });

    it("should throw error if http request fails", async () => {
      mockAxiosPost.mockRejectedValue(new Error("Network Error"));

      const fileUrl = "data:image/jpeg;base64,mockbase64data";
      await expect(service.extractText(fileUrl)).rejects.toThrow(
        "Network Error",
      );
    });
  });

  describe("processImage", () => {
    it("should upload image buffer and return response on success", async () => {
      const mockResult = {
        success: true,
        document: {
          supplier_name: "Proveedor de Prueba",
          products: [],
          confidence: 0.88,
        },
        validation: { is_valid: true, recommended_action: "none" },
      };
      mockAxiosPost.mockResolvedValue({ data: mockResult });

      const buffer = Buffer.from("mockImageContent");
      const result = await service.processImage(
        buffer,
        "test.jpg",
        "image/jpeg",
        "gemini-model",
        "mock-key",
      );

      expect(result.success).toBe(true);
      expect(result.document.supplier_name).toBe("Proveedor de Prueba");
      expect(mockAxiosPost).toHaveBeenCalledWith(
        "/ocr/image",
        expect.any(FormData),
        expect.any(Object),
      );
    });

    it("should catch and return error info if request fails", async () => {
      mockAxiosPost.mockRejectedValue(new Error("Upload Timeout"));

      const buffer = Buffer.from("mockImageContent");
      const result = await service.processImage(
        buffer,
        "test.jpg",
        "image/jpeg",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Upload Timeout");
      expect(result.document).toBeNull();
    });
  });

  describe("processPdf", () => {
    it("should send pdf buffer to /ocr/pdf endpoint", async () => {
      const mockResult = { success: true };
      mockAxiosPost.mockResolvedValue({ data: mockResult });

      const buffer = Buffer.from("mockPdfContent");
      const result = await service.processPdf(buffer, "invoice.pdf");

      expect(result.success).toBe(true);
      expect(mockAxiosPost).toHaveBeenCalledWith(
        "/ocr/pdf",
        expect.any(FormData),
        expect.any(Object),
      );
    });
  });

  describe("refineExtraction", () => {
    it("should call /ocr/refine endpoint and return results", async () => {
      const mockResult = {
        success: true,
        document: { products: [{ name: "Refined Product" }] },
      };
      mockAxiosPost.mockResolvedValue({ data: mockResult });

      const result = await service.refineExtraction(
        "raw text",
        { supplierName: "Supplier" },
        "model-1",
        "key-1",
      );

      expect(result.success).toBe(true);
      expect(result.document.products[0].name).toBe("Refined Product");
      expect(mockAxiosPost).toHaveBeenCalledWith("/ocr/refine", {
        ocr_text: "raw text",
        supplier_hints: { supplierName: "Supplier" },
        ai_model: "model-1",
        ai_api_key: "key-1",
      });
    });
  });

  describe("healthCheck", () => {
    it("should return status of microservice", async () => {
      const mockHealth = { status: "healthy", version: "1.0" };
      mockAxiosGet.mockResolvedValue({ data: mockHealth });

      const health = await service.healthCheck();
      expect(health.status).toBe("healthy");
      expect(mockAxiosGet).toHaveBeenCalledWith("/health");
    });
  });
});
