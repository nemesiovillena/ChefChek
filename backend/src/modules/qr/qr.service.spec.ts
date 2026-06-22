import { Test, TestingModule } from "@nestjs/testing";
import { QRService } from "./qr.service";
import { PrismaService } from "../../common/services/prisma.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  GenerateQRCodeDto,
  QRCodeConfigDto,
  QRCodeType,
  QRCodeFormat,
  QRCodeErrorCorrection,
  QREntityType,
} from "./dto/qr.dto";

describe("QRService", () => {
  let service: QRService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    qRCode: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    digitalMenuConfig: {
      findUnique: jest.fn(),
    },
    recipe: {
      findUnique: jest.fn(),
    },
    category: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QRService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<QRService>(QRService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe("generateQRCode", () => {
    it("should generate a QR code for a product", async () => {
      const dto: GenerateQRCodeDto = {
        entityType: QREntityType.PRODUCT,
        entityId: "test-product-id",
        data: { tenantId: "test-tenant" },
        config: {
          qrType: QRCodeType.STATIC,
          format: QRCodeFormat.PNG,
          errorCorrection: QRCodeErrorCorrection.M,
          size: 300,
        },
      };

      const mockProduct = {
        id: "test-product-id",
        name: "Test Product",
        description: "Test Description",
        category: "TestCategory",
      };

      const mockQRCode = {
        id: "test-qr-id",
        qrCodeId: "product-test-product-id-123456-abc123",
        entityType: "product",
        entityId: "test-product-id",
        qrCodeData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
        config: dto.config,
        format: "png",
        size: 300,
        publicUrl: "http://localhost:3000/productos/test-product-id",
        scanCount: 0,
        expiresAt: null,
        tenantId: "test-tenant",
        publicFilePath: "/public/qr/test-qr.png",
        generatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.qRCode.create.mockResolvedValue(mockQRCode);

      const result = await service.generateQRCode(dto);

      expect(result).toBeDefined();
      expect(result.qrCodeId).toBe(mockQRCode.qrCodeId);
      expect(result.entityType).toBe(QREntityType.PRODUCT);
      expect(result.format).toBe(QRCodeFormat.PNG);
      expect(result.size).toBe(300);

      expect(mockPrismaService.product.findUnique).toHaveBeenCalledWith({
        where: { id: "test-product-id" },
      });
      expect(mockPrismaService.qRCode.create).toHaveBeenCalled();
    });

    it("should throw NotFoundException if product does not exist", async () => {
      const dto: GenerateQRCodeDto = {
        entityType: QREntityType.PRODUCT,
        entityId: "non-existent-id",
        data: { tenantId: "test-tenant" },
      };

      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.generateQRCode(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException for invalid config", async () => {
      const dto: GenerateQRCodeDto = {
        entityType: QREntityType.PRODUCT,
        entityId: "test-product-id",
        data: { tenantId: "test-tenant" },
        config: {
          size: 50, // Invalid size (< 100)
        },
      };

      await expect(service.generateQRCode(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should generate QR code with default config", async () => {
      const dto: GenerateQRCodeDto = {
        entityType: QREntityType.PRODUCT,
        entityId: "test-product-id",
        data: { tenantId: "test-tenant" },
      };

      const mockProduct = {
        id: "test-product-id",
        name: "Test Product",
      };

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.qRCode.create.mockResolvedValue({
        qrCodeId: "test-qr-id",
        entityType: "product",
        entityId: "test-product-id",
        qrCodeData: "data:image/png;base64,...",
        format: "png",
        size: 300,
        publicUrl: "http://localhost:3000/productos/test-product-id",
        publicFilePath: "/public/qr/test-qr.png",
        scanCount: 0,
        expiresAt: null,
        generatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.generateQRCode(dto);

      expect(result.format).toBe(QRCodeFormat.PNG);
      expect(result.size).toBe(300);
    });

    it("should support different QR code formats", async () => {
      const formats = [
        QRCodeFormat.PNG,
        QRCodeFormat.SVG,
        QRCodeFormat.JPEG,
        QRCodeFormat.WEBP,
      ];

      for (const format of formats) {
        const dto: GenerateQRCodeDto = {
          entityType: QREntityType.PRODUCT,
          entityId: "test-product-id",
          data: { tenantId: "test-tenant" },
          config: { format },
        };

        const mockProduct = {
          id: "test-product-id",
          name: "Test Product",
        };

        mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
        mockPrismaService.qRCode.create.mockResolvedValue({
          qrCodeId: `test-qr-id-${format}`,
          entityType: "product",
          entityId: "test-product-id",
          qrCodeData: `data:${format === "svg" ? "image/svg+xml" : `image/${format}`};base64,...`,
          format: format,
          size: 300,
          publicUrl: "http://localhost:3000/productos/test-product-id",
          publicFilePath: "/public/qr/test-qr.png",
          scanCount: 0,
          expiresAt: null,
          generatedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await service.generateQRCode(dto);
        expect(result.format).toBe(format);
      }
    });

    it("should handle different entity types", async () => {
      const entityTypes = [
        QREntityType.PRODUCT,
        QREntityType.RECIPE,
        QREntityType.CATEGORY,
        QREntityType.DIGITAL_MENU,
      ];

      for (const entityType of entityTypes) {
        const dto: GenerateQRCodeDto = {
          entityType,
          entityId: `test-${entityType}-id`,
          data: { tenantId: "test-tenant" },
        };

        const mockEntity = {
          id: `test-${entityType}-id`,
          name: "Test Entity",
        };

        // Setup mock based on entity type
        if (entityType === QREntityType.PRODUCT) {
          mockPrismaService.product.findUnique.mockResolvedValue(mockEntity);
        } else if (entityType === QREntityType.RECIPE) {
          mockPrismaService.recipe.findUnique.mockResolvedValue(mockEntity);
        } else if (entityType === QREntityType.CATEGORY) {
          mockPrismaService.category.findUnique.mockResolvedValue(mockEntity);
        } else if (entityType === QREntityType.DIGITAL_MENU) {
          mockPrismaService.digitalMenuConfig.findUnique.mockResolvedValue(
            mockEntity,
          );
        }

        mockPrismaService.qRCode.create.mockResolvedValue({
          qrCodeId: `test-qr-id-${entityType}`,
          entityType: entityType,
          entityId: `test-${entityType}-id`,
          qrCodeData: "data:image/png;base64,...",
          format: "png",
          size: 300,
          publicUrl: "http://localhost:3000/endpoint/test-id",
          publicFilePath: "/public/qr/test-qr.png",
          scanCount: 0,
          expiresAt: null,
          generatedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await service.generateQRCode(dto);
        expect(result.entityType).toBe(entityType);
      }
    });
  });

  describe("getQRCode", () => {
    it("should retrieve a QR code by ID", async () => {
      const mockQRCode = {
        qrCodeId: "test-qr-id",
        entityType: "product",
        entityId: "test-product-id",
        qrCodeData: "data:image/png;base64,...",
        config: {},
        format: "png",
        size: 300,
        publicUrl: "http://localhost:3000/productos/test-product-id",
        publicFilePath: "/public/qr/test-qr.png",
        scanCount: 5,
        expiresAt: null,
        generatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.qRCode.findUnique.mockResolvedValue(mockQRCode);

      const result = await service.getQRCode("test-qr-id");

      expect(result.qrCodeId).toBe("test-qr-id");
      expect(result.scanCount).toBe(5);
      expect(mockPrismaService.qRCode.findUnique).toHaveBeenCalledWith({
        where: { qrCodeId: "test-qr-id" },
      });
    });

    it("should throw NotFoundException if QR code does not exist", async () => {
      mockPrismaService.qRCode.findUnique.mockResolvedValue(null);

      await expect(service.getQRCode("non-existent-id")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw NotFoundException if QR code has expired", async () => {
      const expiredQR = {
        qrCodeId: "expired-qr-id",
        entityType: "product",
        entityId: "test-product-id",
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };

      mockPrismaService.qRCode.findUnique.mockResolvedValue(expiredQR);

      await expect(service.getQRCode("expired-qr-id")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("registerScan", () => {
    it("should register a scan and update counters", async () => {
      const mockQRCode = {
        qrCodeId: "test-qr-id",
        entityType: "product",
        entityId: "test-product-id",
        qrCodeData: "data:image/png;base64,...",
        publicUrl: "http://localhost:3000/productos/test-product-id",
        scanCount: 5,
        format: "png",
        size: 300,
      };

      const updatedQRCode = {
        ...mockQRCode,
        scanCount: 6,
        lastScannedAt: new Date(),
        lastDeviceId: "test-device",
        lastUserAgent: "test-user-agent",
      };

      const mockProduct = {
        id: "test-product-id",
        name: "Test Product",
        description: "Test Description",
        category: "TestCategory",
      };

      mockPrismaService.qRCode.findUnique.mockResolvedValue(mockQRCode);
      mockPrismaService.qRCode.update.mockResolvedValue(updatedQRCode);
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.registerScan({
        qrCodeId: "test-qr-id",
        deviceId: "test-device",
        userAgent: "test-user-agent",
      });

      expect(result.scanCount).toBe(6);
      expect(result.lastScannedAt).toBeDefined();
      expect(mockPrismaService.qRCode.update).toHaveBeenCalledWith({
        where: { qrCodeId: "test-qr-id" },
        data: {
          scanCount: 6,
          lastScannedAt: expect.any(Date),
          lastDeviceId: "test-device",
          lastUserAgent: "test-user-agent",
        },
      });
    });

    it("should return entity data with scan response", async () => {
      const mockQRCode = {
        qrCodeId: "test-qr-id",
        entityType: "product",
        entityId: "test-product-id",
        qrCodeData: "data:image/png;base64,...",
        publicUrl: "http://localhost:3000/productos/test-product-id",
        scanCount: 1,
        format: "png",
        size: 300,
      };

      const updatedQRCode = {
        ...mockQRCode,
        scanCount: 2,
        lastScannedAt: new Date(),
      };

      const mockProduct = {
        id: "test-product-id",
        name: "Test Product",
        description: "Test Description",
        category: "TestCategory",
      };

      mockPrismaService.qRCode.findUnique.mockResolvedValue(mockQRCode);
      mockPrismaService.qRCode.update.mockResolvedValue(updatedQRCode);
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.registerScan({ qrCodeId: "test-qr-id" });

      expect(result.entityData).toBeDefined();
      expect(result.entityData.name).toBe("Test Product");
    });
  });

  describe("getQRCodesByEntity", () => {
    it("should retrieve all QR codes for an entity", async () => {
      const mockQRCodes = [
        {
          qrCodeId: "qr-1",
          entityType: "product",
          entityId: "test-product-id",
          qrCodeData: "data:image/png;base64,...",
          config: {},
          format: "png",
          size: 300,
          publicUrl: "http://localhost:3000/productos/test-product-id",
          publicFilePath: "/public/qr/qr-1.png",
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          generatedAt: new Date(),
        },
        {
          qrCodeId: "qr-2",
          entityType: "product",
          entityId: "test-product-id",
          qrCodeData: "data:image/png;base64,...",
          config: {},
          format: "svg",
          size: 500,
          publicUrl: "http://localhost:3000/productos/test-product-id",
          publicFilePath: "/public/qr/qr-2.svg",
          expiresAt: new Date(Date.now() + 86400000), // Not expired
          createdAt: new Date(),
          updatedAt: new Date(),
          generatedAt: new Date(),
        },
      ];

      mockPrismaService.qRCode.findMany.mockResolvedValue(mockQRCodes);

      const result = await service.getQRCodesByEntity(
        QREntityType.PRODUCT,
        "test-product-id",
      );

      expect(result).toHaveLength(2);
      expect(result[0].format).toBe(QRCodeFormat.PNG);
      expect(result[1].format).toBe(QRCodeFormat.SVG);

      expect(mockPrismaService.qRCode.findMany).toHaveBeenCalledWith({
        where: {
          entityType: "product",
          entityId: "test-product-id",
          OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
        },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should filter out expired QR codes", async () => {
      const mockQRCodes = [
        {
          qrCodeId: "qr-1",
          entityType: "product",
          entityId: "test-product-id",
          expiresAt: new Date(Date.now() + 86400000), // Not expired
          generatedAt: new Date(),
          format: "png",
          size: 300,
          publicUrl: "http://localhost:3000/productos/test-product-id",
          publicFilePath: "/public/qr/qr-1.png",
          scanCount: 5,
          qrCodeData: "data:image/png;base64,...",
          config: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.qRCode.findMany.mockResolvedValue(mockQRCodes);

      const result = await service.getQRCodesByEntity(
        QREntityType.PRODUCT,
        "test-product-id",
      );

      expect(result).toHaveLength(1);
    });
  });

  describe("getQRStats", () => {
    it("should return QR code statistics", async () => {
      const mockQRCodes = [
        {
          qrCodeId: "qr-1",
          entityType: "product",
          entityId: "product-1",
          scanCount: 10,
          expiresAt: new Date(Date.now() + 86400000),
        },
        {
          qrCodeId: "qr-2",
          entityType: "recipe",
          entityId: "recipe-1",
          scanCount: 5,
          expiresAt: new Date(Date.now() - 1000),
        },
        {
          qrCodeId: "qr-3",
          entityType: "product",
          entityId: "product-2",
          scanCount: 15,
          expiresAt: null,
        },
      ];

      mockPrismaService.qRCode.findMany.mockResolvedValue(mockQRCodes);

      const result = await service.getQRStats();

      expect(result.total).toBe(3);
      expect(result.active).toBe(2);
      expect(result.expired).toBe(1);
      expect(result.totalScans).toBe(30);
      expect(result.topScanned).toHaveLength(3);
      expect(result.topScanned[0].scanCount).toBe(10);
    });

    it("should filter stats by entity type", async () => {
      const mockQRCodes = [
        {
          qrCodeId: "qr-1",
          entityType: "product",
          entityId: "product-1",
          scanCount: 10,
          expiresAt: null,
        },
        {
          qrCodeId: "qr-2",
          entityType: "recipe",
          entityId: "recipe-1",
          scanCount: 5,
          expiresAt: null,
        },
      ];

      mockPrismaService.qRCode.findMany.mockResolvedValue(mockQRCodes);

      const result = await service.getQRStats(QREntityType.PRODUCT);

      expect(result.total).toBe(2);
      expect(result.totalScans).toBe(15);

      expect(mockPrismaService.qRCode.findMany).toHaveBeenCalledWith({
        where: { entityType: "product" },
        orderBy: { scanCount: "desc" },
        take: 10,
      });
    });
  });

  describe("deleteQRCode", () => {
    it("should delete a QR code", async () => {
      const mockQRCode = {
        qrCodeId: "test-qr-id",
        publicFilePath: "/public/qr/test-qr.png",
      };

      mockPrismaService.qRCode.findUnique.mockResolvedValue(mockQRCode);
      mockPrismaService.qRCode.delete.mockResolvedValue({});

      await service.deleteQRCode("test-qr-id");

      expect(mockPrismaService.qRCode.delete).toHaveBeenCalledWith({
        where: { qrCodeId: "test-qr-id" },
      });
    });

    it("should throw NotFoundException if QR code does not exist", async () => {
      mockPrismaService.qRCode.findUnique.mockResolvedValue(null);

      await expect(service.deleteQRCode("non-existent-id")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("regenerateQRCode", () => {
    it("should regenerate an existing QR code", async () => {
      const existingQR = {
        qrCodeId: "test-qr-id",
        entityType: "product",
        entityId: "test-product-id",
        config: { size: 300, format: "png", errorCorrection: "M" },
        publicFilePath: "/public/qr/test-qr-old.png",
      };

      const newConfig: QRCodeConfigDto = {
        size: 500,
        format: QRCodeFormat.SVG,
      };

      const regeneratedQR = {
        qrCodeId: "test-qr-id",
        entityType: "product",
        entityId: "test-product-id",
        qrCodeData: "new-data:image/svg+xml;base64,...",
        config: newConfig,
        format: "svg",
        size: 500,
        publicFilePath: "/public/qr/test-qr-new.svg",
        scanCount: 0,
        generatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.qRCode.findUnique.mockResolvedValue(existingQR);
      mockPrismaService.qRCode.update.mockResolvedValue(regeneratedQR);

      const result = await service.regenerateQRCode("test-qr-id", newConfig);

      expect(result.format).toBe("svg");
      expect(result.size).toBe(500);
      expect(result.scanCount).toBe(0);

      expect(mockPrismaService.qRCode.update).toHaveBeenCalledWith({
        where: { qrCodeId: "test-qr-id" },
        data: {
          qrCodeData: expect.any(String),
          config: { ...existingQR.config, ...newConfig },
          format: "svg",
          size: 500,
          scanCount: 0,
          generatedAt: expect.any(Date),
        },
      });
    });
  });
});
