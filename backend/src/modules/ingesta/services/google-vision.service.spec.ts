import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { GoogleVisionService } from "./google-vision.service";

// Mock del cliente de Google Vision API
const mockAnnotateImage = jest.fn();

jest.mock("@google-cloud/vision", () => {
  return {
    ImageAnnotatorClient: jest.fn().mockImplementation(() => {
      return {
        annotateImage: mockAnnotateImage,
      };
    }),
  };
});

describe("GoogleVisionService", () => {
  let service: GoogleVisionService;

  beforeEach(async () => {
    mockAnnotateImage.mockReset();

    // Configurar API key simulada en environment
    process.env.GOOGLE_CLOUD_VISION_API_KEY = "mock-api-key";

    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogleVisionService],
    }).compile();

    service = module.get<GoogleVisionService>(GoogleVisionService);
  });

  afterEach(() => {
    delete process.env.GOOGLE_CLOUD_VISION_API_KEY;
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("isConfigured", () => {
    it("should return true if GOOGLE_CLOUD_VISION_API_KEY env is set", () => {
      expect(service.isConfigured()).toBe(true);
    });

    it("should return false if GOOGLE_CLOUD_VISION_API_KEY env is missing", () => {
      delete process.env.GOOGLE_CLOUD_VISION_API_KEY;
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe("getProviderInfo", () => {
    it("should return metadata about Google Cloud Vision provider", () => {
      const info = service.getProviderInfo();
      expect(info.name).toBe("Google Cloud Vision");
      expect(info.configured).toBe(true);
      expect(info.features).toContain("TEXT_DETECTION");
    });
  });

  describe("extractText", () => {
    const mockBase64 =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    it("should throw BadRequestException if fileUrl is empty", async () => {
      await expect(service.extractText("")).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.extractText("   ")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException if fileUrl has invalid format", async () => {
      await expect(
        service.extractText("not-a-valid-url-or-base64"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should perform OCR on base64 image and return structured response", async () => {
      mockAnnotateImage.mockResolvedValue([
        {
          fullTextAnnotation: {
            text: "PRODUCTO\nNombre: Tomates\nPrecio: 2.50€",
            pages: [
              {
                blocks: [{ confidence: 0.95 }, { confidence: 0.85 }],
              },
            ],
          },
        },
      ]);

      const result = await service.extractText(mockBase64);

      expect(result.provider).toBe("google-vision");
      expect(result.confidence).toBeCloseTo(0.9); // (0.95 + 0.85) / 2
      expect(result.text).toBe("PRODUCTO Nombre Tomates Precio 2.50€"); // Cleaned text (removes newlines & custom cleaning)
      expect(result.rawResult).toBeDefined();
      expect(mockAnnotateImage).toHaveBeenCalledTimes(1);
    });

    it("should retry on transient failures and succeed", async () => {
      mockAnnotateImage
        .mockRejectedValueOnce(new Error("Transient API error"))
        .mockResolvedValueOnce([
          {
            fullTextAnnotation: {
              text: "TOMATE",
              pages: [{ blocks: [{ confidence: 0.8 }] }],
            },
          },
        ]);

      // Sobrescribir RETRY_DELAY_MS para acelerar tests
      (service as any).RETRY_DELAY_MS = 1;

      const result = await service.extractText(mockBase64);
      expect(result.text).toBe("TOMATE");
      expect(mockAnnotateImage).toHaveBeenCalledTimes(2);
    });

    it("should throw InternalServerErrorException after max retries exceed", async () => {
      mockAnnotateImage.mockRejectedValue(
        new Error("Persistent connection issue"),
      );
      (service as any).RETRY_DELAY_MS = 1;

      await expect(service.extractText(mockBase64)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(mockAnnotateImage).toHaveBeenCalledTimes(3); // MAX_RETRIES = 3
    });

    it("should handle specific API error codes like auth/permissions failure", async () => {
      const authError = new Error("API Key Invalid");
      (authError as any).code = 7; // Permission Denied code in GCP
      mockAnnotateImage.mockRejectedValue(authError);
      (service as any).RETRY_DELAY_MS = 1;

      await expect(service.extractText(mockBase64)).rejects.toThrow(
        new InternalServerErrorException(
          "Google Vision API authentication failed. Check API key configuration.",
        ),
      );
    });
  });
});
