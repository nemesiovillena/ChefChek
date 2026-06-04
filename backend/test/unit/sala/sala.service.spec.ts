import { Test, TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { SalaService } from "../../../src/modules/sala/sala.service";
import { PrismaService } from "../../../src/common/services/prisma.service";
import {
  QrScanDto,
  FeedbackDto,
  InteractionDto,
  IncidentDto,
} from "../../../src/modules/sala/dto/sala.dto";

describe("SalaService", () => {
  let service: SalaService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    digitalMenuConfig: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    menuScan: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    menu: {
      findUnique: jest.fn(),
    },
    dashboardAlert: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalaService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SalaService>(SalaService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("validateQrCode", () => {
    it("should validate a valid QR code", async () => {
      const dto: QrScanDto = {
        qrCode: "test-qr-code",
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0",
        language: "es",
      };

      const mockDigitalMenu = {
        id: "menu-id",
        name: "Test Restaurant",
        tenantId: "tenant-id",
        menuId: "menu-content-id",
        menu: {
          items: [],
          sections: [],
        },
      };

      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(
        mockDigitalMenu,
      );
      mockPrismaService.menuScan.create.mockResolvedValue({ id: "scan-id" });
      mockPrismaService.digitalMenuConfig.update.mockResolvedValue({});

      const result = await service.validateQrCode(dto);

      expect(result).toEqual({
        isValid: true,
        digitalMenuId: "menu-id",
        menuId: "menu-content-id",
        tenantId: "tenant-id",
        restaurantName: "Test Restaurant",
      });
      expect(mockPrismaService.menuScan.create).toHaveBeenCalled();
      expect(mockPrismaService.digitalMenuConfig.update).toHaveBeenCalledWith({
        where: { id: "menu-id" },
        data: {
          scanCount: { increment: 1 },
          lastScannedAt: expect.any(Date),
        },
      });
    });

    it("should return invalid for non-existent QR code", async () => {
      const dto: QrScanDto = {
        qrCode: "invalid-qr-code",
        ipAddress: "127.0.0.1",
      };

      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(null);

      const result = await service.validateQrCode(dto);

      expect(result).toEqual({
        isValid: false,
        error: "QR code not found or expired",
      });
      expect(mockPrismaService.menuScan.create).not.toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      const dto: QrScanDto = {
        qrCode: "test-qr-code",
      };

      mockPrismaService.digitalMenuConfig.findFirst.mockRejectedValue(
        new Error("Database error"),
      );

      const result = await service.validateQrCode(dto);

      expect(result).toEqual({
        isValid: false,
        error: "Error validating QR code",
      });
    });
  });

  describe("submitFeedback", () => {
    it("should submit rating feedback", async () => {
      const dto: FeedbackDto = {
        digitalMenuId: "menu-id",
        type: "RATING",
        menuItemId: "item-id",
        rating: 5,
        comment: "Great food!",
        category: "FOOD_QUALITY",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0",
      };

      mockPrismaService.menuScan.create.mockResolvedValue({
        id: "feedback-id",
        interactionType: "rating",
      });

      const result = await service.submitFeedback(dto);

      expect(result).toEqual({
        success: true,
        data: { id: "feedback-id", interactionType: "rating" },
        message: "Feedback submitted successfully",
      });
      expect(mockPrismaService.menuScan.create).toHaveBeenCalledWith({
        data: {
          digitalMenuId: "menu-id",
          ipAddress: "127.0.0.1",
          userAgent: "Mozilla/5.0",
          language: "es",
          interactionType: "rating",
          metadata: {
            menuItemId: "item-id",
            rating: 5,
            comment: "Great food!",
            category: "FOOD_QUALITY",
            customerName: "John Doe",
            customerEmail: "john@example.com",
          },
          scannedAt: expect.any(Date),
        },
      });
    });

    it("should submit comment feedback", async () => {
      const dto: FeedbackDto = {
        digitalMenuId: "menu-id",
        type: "COMMENT",
        comment: "Needs improvement",
        ipAddress: "127.0.0.1",
      };

      mockPrismaService.menuScan.create.mockResolvedValue({
        id: "feedback-id",
      });

      const result = await service.submitFeedback(dto);

      expect(result.success).toBe(true);
      expect(mockPrismaService.menuScan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            interactionType: "comment",
            metadata: expect.objectContaining({
              comment: "Needs improvement",
            }),
          }),
        }),
      );
    });

    it("should handle feedback submission errors", async () => {
      const dto: FeedbackDto = {
        digitalMenuId: "menu-id",
        type: "RATING",
        rating: 3,
      };

      mockPrismaService.menuScan.create.mockRejectedValue(
        new Error("DB error"),
      );

      await expect(service.submitFeedback(dto)).rejects.toThrow();
    });
  });

  describe("trackInteraction", () => {
    it("should track user interaction", async () => {
      const dto: InteractionDto = {
        digitalMenuId: "menu-id",
        interactionType: "view_item",
        menuItemId: "item-id",
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0",
        language: "es",
        filteredByAllergens: ["gluten"],
      };

      mockPrismaService.menuScan.create.mockResolvedValue({
        id: "interaction-id",
      });

      const result = await service.trackInteraction(dto);

      expect(result).toEqual({
        success: true,
        data: { id: "interaction-id" },
      });
      expect(mockPrismaService.menuScan.create).toHaveBeenCalledWith({
        data: {
          digitalMenuId: "menu-id",
          interactionType: "view_item",
          ipAddress: "127.0.0.1",
          userAgent: "Mozilla/5.0",
          language: "es",
          metadata: {
            menuItemId: "item-id",
            filteredByAllergens: ["gluten"],
          },
          scannedAt: expect.any(Date),
        },
      });
    });

    it("should track filter interaction", async () => {
      const dto: InteractionDto = {
        digitalMenuId: "menu-id",
        interactionType: "filter",
        filteredByAllergens: ["nuts", "dairy"],
      };

      mockPrismaService.menuScan.create.mockResolvedValue({
        id: "interaction-id",
      });

      await service.trackInteraction(dto);

      expect(mockPrismaService.menuScan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            interactionType: "filter",
            metadata: expect.objectContaining({
              filteredByAllergens: ["nuts", "dairy"],
            }),
          }),
        }),
      );
    });
  });

  describe("reportIncident", () => {
    it("should report critical incident", async () => {
      const dto: IncidentDto = {
        digitalMenuId: "menu-id",
        type: "HYGIENE",
        location: "Table 5",
        description: "Dirty table",
        severity: "CRITICAL",
        customerName: "Jane Smith",
        incidentDate: new Date().toISOString(),
        ipAddress: "127.0.0.1",
      };

      mockPrismaService.menuScan.create.mockResolvedValue({
        id: "incident-id",
      });
      mockPrismaService.dashboardAlert.create.mockResolvedValue({
        id: "alert-id",
      });

      const result = await service.reportIncident(dto);

      expect(result).toEqual({
        success: true,
        data: { id: "incident-id" },
        message: "Incident reported successfully",
      });
      expect(mockPrismaService.dashboardAlert.create).toHaveBeenCalledWith({
        data: {
          tenantId: "SYSTEM",
          alertType: "SALA_INCIDENT",
          severity: "CRITICAL",
          title: "HYGIENE reported in dining room",
          description: "Dirty table",
          entityType: "SALA",
          entityId: "incident-id",
          isResolved: false,
        },
      });
    });

    it("should not create alert for low severity incidents", async () => {
      const dto: IncidentDto = {
        digitalMenuId: "menu-id",
        type: "OTHER",
        description: "Minor issue",
        severity: "LOW",
        ipAddress: "127.0.0.1",
      };

      mockPrismaService.menuScan.create.mockResolvedValue({
        id: "incident-id",
      });

      await service.reportIncident(dto);

      expect(mockPrismaService.dashboardAlert.create).not.toHaveBeenCalled();
    });
  });

  describe("getSalaStats", () => {
    it("should calculate sala statistics", async () => {
      const mockScans = [
        {
          id: "1",
          interactionType: "view",
          ipAddress: "127.0.0.1",
          language: "es",
          scannedAt: new Date(),
          metadata: {},
        },
        {
          id: "2",
          interactionType: "rating",
          ipAddress: "127.0.0.1",
          language: "en",
          scannedAt: new Date(),
          metadata: { rating: 5 },
        },
        {
          id: "3",
          interactionType: "rating",
          ipAddress: "192.168.1.1",
          language: "es",
          scannedAt: new Date(),
          metadata: { rating: 4 },
        },
      ];

      mockPrismaService.menuScan.findMany.mockResolvedValue(mockScans);

      const result = await service.getSalaStats("tenant-id", {
        digitalMenuId: "menu-id",
      });

      expect(result.data).toEqual({
        totalScans: 3,
        uniqueScans: 2,
        byInteractionType: { view: 1, rating: 2 },
        byLanguage: { es: 2, en: 1 },
        avgRating: 4.5,
        ratingCount: 2,
        incidents: [],
        recentScans: mockScans,
      });
    });

    it("should filter scans by date range", async () => {
      const startDate = "2024-01-01";
      const endDate = "2024-12-31";

      mockPrismaService.menuScan.findMany.mockResolvedValue([]);

      await service.getSalaStats("tenant-id", {
        digitalMenuId: "menu-id",
        startDate,
        endDate,
      });

      expect(mockPrismaService.menuScan.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          digitalMenuId: "menu-id",
          scannedAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
        orderBy: { scannedAt: "desc" },
      });
    });
  });
});
