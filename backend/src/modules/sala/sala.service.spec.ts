import { Test, TestingModule } from "@nestjs/testing";
import { SalaService } from "./sala.service";
import { PrismaService } from "../../common/services/prisma.service";
import {
  QrScanDto,
  FeedbackDto,
  InteractionDto,
  IncidentDto,
  SalaStatsDto,
} from "./dto/sala.dto";

describe("SalaService", () => {
  let service: SalaService;
  let prismaService: any;

  const mockPrismaService = {
    digitalMenuConfig: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    menuScan: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    dashboardAlert: {
      create: jest.fn(),
    },
  };

  const tenantId = "tenant-123";

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
    prismaService = mockPrismaService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("validateQrCode", () => {
    it("should validate a valid QR code successfully", async () => {
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

      prismaService.digitalMenuConfig.findFirst.mockResolvedValue(
        mockDigitalMenu,
      );
      prismaService.menuScan.create.mockResolvedValue({ id: "scan-id" });
      prismaService.digitalMenuConfig.update.mockResolvedValue({});

      const result = await service.validateQrCode(dto);

      expect(result).toEqual({
        isValid: true,
        digitalMenuId: "menu-id",
        menuId: "menu-content-id",
        tenantId: "tenant-id",
        restaurantName: "Test Restaurant",
      });
      expect(prismaService.digitalMenuConfig.findFirst).toHaveBeenCalledWith({
        where: {
          qrCodeUrl: { contains: "test-qr-code" },
          isActive: true,
        },
        include: {
          menu: {
            include: {
              items: {
                include: {
                  recipe: true,
                },
              },
              sections: {
                include: {
                  items: {
                    include: {
                      recipe: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      expect(prismaService.menuScan.create).toHaveBeenCalledWith({
        data: {
          digitalMenuId: "menu-id",
          ipAddress: "127.0.0.1",
          userAgent: "Mozilla/5.0",
          language: "es",
          interactionType: "scan",
          scannedAt: expect.any(Date),
        },
      });
      expect(prismaService.digitalMenuConfig.update).toHaveBeenCalledWith({
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

      prismaService.digitalMenuConfig.findFirst.mockResolvedValue(null);

      const result = await service.validateQrCode(dto);

      expect(result).toEqual({
        isValid: false,
        error: "QR code not found or expired",
      });
      expect(prismaService.menuScan.create).not.toHaveBeenCalled();
      expect(prismaService.digitalMenuConfig.update).not.toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      const dto: QrScanDto = {
        qrCode: "test-qr-code",
      };

      prismaService.digitalMenuConfig.findFirst.mockRejectedValue(
        new Error("Database error"),
      );

      const result = await service.validateQrCode(dto);

      expect(result).toEqual({
        isValid: false,
        error: "Error validating QR code",
      });
    });

    it("should use default language when not provided", async () => {
      const dto: QrScanDto = {
        qrCode: "test-qr-code",
      };

      const mockDigitalMenu = {
        id: "menu-id",
        name: "Test Restaurant",
        tenantId: "tenant-id",
        menuId: "menu-content-id",
        menu: { items: [], sections: [] },
      };

      prismaService.digitalMenuConfig.findFirst.mockResolvedValue(
        mockDigitalMenu,
      );
      prismaService.menuScan.create.mockResolvedValue({ id: "scan-id" });
      prismaService.digitalMenuConfig.update.mockResolvedValue({});

      await service.validateQrCode(dto);

      expect(prismaService.menuScan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            language: "es",
          }),
        }),
      );
    });
  });

  describe("submitFeedback", () => {
    it("should submit rating feedback successfully", async () => {
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

      prismaService.menuScan.create.mockResolvedValue({
        id: "feedback-id",
        interactionType: "rating",
      });

      const result = await service.submitFeedback(dto);

      expect(result).toEqual({
        success: true,
        data: { id: "feedback-id", interactionType: "rating" },
        message: "Feedback submitted successfully",
      });
      expect(prismaService.menuScan.create).toHaveBeenCalledWith({
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

    it("should submit comment feedback with lowercase interaction type", async () => {
      const dto: FeedbackDto = {
        digitalMenuId: "menu-id",
        type: "COMMENT",
        comment: "Needs improvement",
        ipAddress: "127.0.0.1",
      };

      prismaService.menuScan.create.mockResolvedValue({
        id: "feedback-id",
      });

      const result = await service.submitFeedback(dto);

      expect(result.success).toBe(true);
      expect(prismaService.menuScan.create).toHaveBeenCalledWith(
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

    it("should submit incident feedback", async () => {
      const dto: FeedbackDto = {
        digitalMenuId: "menu-id",
        type: "INCIDENT",
        comment: "Found foreign object",
        category: "HYGIENE",
      };

      prismaService.menuScan.create.mockResolvedValue({
        id: "feedback-id",
      });

      const result = await service.submitFeedback(dto);

      expect(result.success).toBe(true);
      expect(prismaService.menuScan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            interactionType: "incident",
          }),
        }),
      );
    });

    it("should submit suggestion feedback", async () => {
      const dto: FeedbackDto = {
        digitalMenuId: "menu-id",
        type: "SUGGESTION",
        comment: "Add more vegetarian options",
      };

      prismaService.menuScan.create.mockResolvedValue({
        id: "feedback-id",
      });

      const result = await service.submitFeedback(dto);

      expect(result.success).toBe(true);
      expect(prismaService.menuScan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            interactionType: "suggestion",
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

      const error = new Error("DB error");
      prismaService.menuScan.create.mockRejectedValue(error);

      await expect(service.submitFeedback(dto)).rejects.toThrow(error);
    });
  });

  describe("trackInteraction", () => {
    it("should track view_item interaction successfully", async () => {
      const dto: InteractionDto = {
        digitalMenuId: "menu-id",
        interactionType: "view_item",
        menuItemId: "item-id",
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0",
        language: "es",
        filteredByAllergens: ["gluten"],
      };

      prismaService.menuScan.create.mockResolvedValue({
        id: "interaction-id",
      });

      const result = await service.trackInteraction(dto);

      expect(result).toEqual({
        success: true,
        data: { id: "interaction-id" },
      });
      expect(prismaService.menuScan.create).toHaveBeenCalledWith({
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

    it("should track filter interaction with allergens", async () => {
      const dto: InteractionDto = {
        digitalMenuId: "menu-id",
        interactionType: "filter",
        filteredByAllergens: ["nuts", "dairy"],
      };

      prismaService.menuScan.create.mockResolvedValue({
        id: "interaction-id",
      });

      await service.trackInteraction(dto);

      expect(prismaService.menuScan.create).toHaveBeenCalledWith(
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

    it("should track view interaction", async () => {
      const dto: InteractionDto = {
        digitalMenuId: "menu-id",
        interactionType: "view",
      };

      prismaService.menuScan.create.mockResolvedValue({
        id: "interaction-id",
      });

      const result = await service.trackInteraction(dto);

      expect(result.success).toBe(true);
    });

    it("should track contact interaction", async () => {
      const dto: InteractionDto = {
        digitalMenuId: "menu-id",
        interactionType: "contact",
        metadata: { phone: "123456789" },
      };

      prismaService.menuScan.create.mockResolvedValue({
        id: "interaction-id",
      });

      const result = await service.trackInteraction(dto);

      expect(result.success).toBe(true);
      expect(prismaService.menuScan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              phone: "123456789",
            }),
          }),
        }),
      );
    });

    it("should track feedback interaction", async () => {
      const dto: InteractionDto = {
        digitalMenuId: "menu-id",
        interactionType: "feedback",
      };

      prismaService.menuScan.create.mockResolvedValue({
        id: "interaction-id",
      });

      const result = await service.trackInteraction(dto);

      expect(result.success).toBe(true);
    });

    it("should use default language when not provided", async () => {
      const dto: InteractionDto = {
        digitalMenuId: "menu-id",
        interactionType: "view",
      };

      prismaService.menuScan.create.mockResolvedValue({
        id: "interaction-id",
      });

      await service.trackInteraction(dto);

      expect(prismaService.menuScan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            language: "es",
          }),
        }),
      );
    });

    it("should handle tracking errors", async () => {
      const dto: InteractionDto = {
        digitalMenuId: "menu-id",
        interactionType: "view",
      };

      const error = new Error("Tracking error");
      prismaService.menuScan.create.mockRejectedValue(error);

      await expect(service.trackInteraction(dto)).rejects.toThrow(error);
    });
  });

  describe("reportIncident", () => {
    it("should report critical incident and create dashboard alert", async () => {
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

      prismaService.menuScan.create.mockResolvedValue({
        id: "incident-id",
      });
      prismaService.dashboardAlert.create.mockResolvedValue({
        id: "alert-id",
      });

      const result = await service.reportIncident(dto);

      expect(result).toEqual({
        success: true,
        data: { id: "incident-id" },
        message: "Incident reported successfully",
      });
      expect(prismaService.menuScan.create).toHaveBeenCalledWith({
        data: {
          digitalMenuId: "menu-id",
          interactionType: "incident",
          ipAddress: "127.0.0.1",
          userAgent: undefined,
          language: "es",
          metadata: {
            incidentType: "HYGIENE",
            location: "Table 5",
            description: "Dirty table",
            severity: "CRITICAL",
            customerName: "Jane Smith",
            customerContact: undefined,
            customerEmail: undefined,
            incidentDate: expect.any(String),
          },
          scannedAt: expect.any(Date),
        },
      });
      expect(prismaService.dashboardAlert.create).toHaveBeenCalledWith({
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

    it("should report HIGH severity incident and create dashboard alert", async () => {
      const dto: IncidentDto = {
        digitalMenuId: "menu-id",
        type: "SAFETY",
        description: "Slippery floor",
        severity: "HIGH",
      };

      prismaService.menuScan.create.mockResolvedValue({
        id: "incident-id",
      });
      prismaService.dashboardAlert.create.mockResolvedValue({
        id: "alert-id",
      });

      await service.reportIncident(dto);

      expect(prismaService.dashboardAlert.create).toHaveBeenCalled();
    });

    it("should not create alert for MEDIUM severity incidents", async () => {
      const dto: IncidentDto = {
        digitalMenuId: "menu-id",
        type: "SERVICE",
        description: "Slow service",
        severity: "MEDIUM",
      };

      prismaService.menuScan.create.mockResolvedValue({
        id: "incident-id",
      });

      await service.reportIncident(dto);

      expect(prismaService.dashboardAlert.create).not.toHaveBeenCalled();
    });

    it("should not create alert for LOW severity incidents", async () => {
      const dto: IncidentDto = {
        digitalMenuId: "menu-id",
        type: "OTHER",
        description: "Minor issue",
        severity: "LOW",
        ipAddress: "127.0.0.1",
      };

      prismaService.menuScan.create.mockResolvedValue({
        id: "incident-id",
      });

      await service.reportIncident(dto);

      expect(prismaService.dashboardAlert.create).not.toHaveBeenCalled();
    });

    it("should use current date when incidentDate not provided", async () => {
      const dto: IncidentDto = {
        digitalMenuId: "menu-id",
        type: "FACILITIES",
        description: "Broken chair",
        severity: "LOW",
      };

      prismaService.menuScan.create.mockResolvedValue({
        id: "incident-id",
      });

      await service.reportIncident(dto);

      expect(prismaService.menuScan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              incidentDate: expect.any(String),
            }),
          }),
        }),
      );
    });

    it("should handle incident reporting errors", async () => {
      const dto: IncidentDto = {
        digitalMenuId: "menu-id",
        type: "HYGIENE",
        description: "Test incident",
        severity: "LOW",
      };

      const error = new Error("Incident error");
      prismaService.menuScan.create.mockRejectedValue(error);

      await expect(service.reportIncident(dto)).rejects.toThrow(error);
    });
  });

  describe("getSalaStats", () => {
    it("should calculate sala statistics correctly", async () => {
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

      prismaService.menuScan.findMany.mockResolvedValue(mockScans);

      const dto: SalaStatsDto = {
        digitalMenuId: "menu-id",
      };

      const result = await service.getSalaStats(tenantId, dto);

      expect(result).toEqual({
        success: true,
        data: {
          totalScans: 3,
          uniqueScans: 2,
          byInteractionType: { view: 1, rating: 2 },
          byLanguage: { es: 2, en: 1 },
          avgRating: 4.5,
          ratingCount: 2,
          incidents: [],
          recentScans: mockScans,
        },
      });
    });

    it("should filter scans by date range", async () => {
      const startDate = "2024-01-01";
      const endDate = "2024-12-31";

      prismaService.menuScan.findMany.mockResolvedValue([]);

      const dto: SalaStatsDto = {
        digitalMenuId: "menu-id",
        startDate,
        endDate,
      };

      await service.getSalaStats(tenantId, dto);

      expect(prismaService.menuScan.findMany).toHaveBeenCalledWith({
        where: {
          digitalMenuId: "menu-id",
          scannedAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
        orderBy: { scannedAt: "desc" },
      });
    });

    it("should filter by startDate only", async () => {
      prismaService.menuScan.findMany.mockResolvedValue([]);

      const dto: SalaStatsDto = {
        digitalMenuId: "menu-id",
        startDate: "2024-01-01",
      };

      await service.getSalaStats(tenantId, dto);

      expect(prismaService.menuScan.findMany).toHaveBeenCalledWith({
        where: {
          digitalMenuId: "menu-id",
          scannedAt: {
            gte: new Date("2024-01-01"),
          },
        },
        orderBy: { scannedAt: "desc" },
      });
    });

    it("should filter by endDate only", async () => {
      prismaService.menuScan.findMany.mockResolvedValue([]);

      const dto: SalaStatsDto = {
        digitalMenuId: "menu-id",
        endDate: "2024-12-31",
      };

      await service.getSalaStats(tenantId, dto);

      expect(prismaService.menuScan.findMany).toHaveBeenCalledWith({
        where: {
          digitalMenuId: "menu-id",
          scannedAt: {
            lte: new Date("2024-12-31"),
          },
        },
        orderBy: { scannedAt: "desc" },
      });
    });

    it("should include incidents in statistics", async () => {
      const mockScans = [
        {
          id: "incident-1",
          interactionType: "incident",
          ipAddress: "127.0.0.1",
          language: "es",
          scannedAt: new Date("2024-06-01"),
          metadata: {
            incidentType: "HYGIENE",
            severity: "HIGH",
            description: "Dirty table",
            location: "Table 5",
          },
        },
      ];

      prismaService.menuScan.findMany.mockResolvedValue(mockScans);

      const dto: SalaStatsDto = {
        digitalMenuId: "menu-id",
      };

      const result = await service.getSalaStats(tenantId, dto);

      expect(result.data.incidents).toEqual([
        {
          id: "incident-1",
          type: "HYGIENE",
          severity: "HIGH",
          description: "Dirty table",
          location: "Table 5",
          reportedAt: expect.any(Date),
        },
      ]);
    });

    it("should return zero avgRating when no ratings exist", async () => {
      const mockScans = [
        {
          id: "1",
          interactionType: "view",
          ipAddress: "127.0.0.1",
          language: "es",
          scannedAt: new Date(),
          metadata: {},
        },
      ];

      prismaService.menuScan.findMany.mockResolvedValue(mockScans);

      const dto: SalaStatsDto = {
        digitalMenuId: "menu-id",
      };

      const result = await service.getSalaStats(tenantId, dto);

      expect(result.data.avgRating).toBe(0);
      expect(result.data.ratingCount).toBe(0);
    });

    it("should limit recentScans to 20 items", async () => {
      const mockScans = Array.from({ length: 25 }, (_, i) => ({
        id: `scan-${i}`,
        interactionType: "view",
        ipAddress: "127.0.0.1",
        language: "es",
        scannedAt: new Date(),
        metadata: {},
      }));

      prismaService.menuScan.findMany.mockResolvedValue(mockScans);

      const dto: SalaStatsDto = {
        digitalMenuId: "menu-id",
      };

      const result = await service.getSalaStats(tenantId, dto);

      expect(result.data.recentScans).toHaveLength(20);
    });

    it("should return empty stats for no scans", async () => {
      prismaService.menuScan.findMany.mockResolvedValue([]);

      const dto: SalaStatsDto = {
        digitalMenuId: "menu-id",
      };

      const result = await service.getSalaStats(tenantId, dto);

      expect(result.data).toEqual({
        totalScans: 0,
        uniqueScans: 0,
        byInteractionType: {},
        byLanguage: {},
        avgRating: 0,
        ratingCount: 0,
        incidents: [],
        recentScans: [],
      });
    });
  });

  describe("getAllFeedback", () => {
    it("should return all feedback for tenant", async () => {
      const mockFeedbacks = [
        {
          id: "feedback-1",
          interactionType: "rating",
          digitalMenuId: "menu-id",
          scannedAt: new Date(),
          metadata: { rating: 5 },
        },
        {
          id: "feedback-2",
          interactionType: "comment",
          digitalMenuId: "menu-id",
          scannedAt: new Date(),
          metadata: { comment: "Great!" },
        },
      ];

      prismaService.menuScan.findMany.mockResolvedValue(mockFeedbacks);

      const result = await service.getAllFeedback(tenantId);

      expect(result).toEqual({
        success: true,
        data: mockFeedbacks,
        count: 2,
      });
      expect(prismaService.menuScan.findMany).toHaveBeenCalledWith({
        where: {
          interactionType: { in: ["rating", "comment", "incident"] },
        },
        orderBy: { scannedAt: "desc" },
      });
    });

    it("should filter feedback by digitalMenuId when provided", async () => {
      const mockFeedbacks = [
        {
          id: "feedback-1",
          interactionType: "rating",
          digitalMenuId: "specific-menu-id",
          scannedAt: new Date(),
          metadata: { rating: 4 },
        },
      ];

      prismaService.menuScan.findMany.mockResolvedValue(mockFeedbacks);

      const result = await service.getAllFeedback(tenantId, "specific-menu-id");

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(prismaService.menuScan.findMany).toHaveBeenCalledWith({
        where: {
          interactionType: { in: ["rating", "comment", "incident"] },
          digitalMenuId: "specific-menu-id",
        },
        orderBy: { scannedAt: "desc" },
      });
    });

    it("should return empty array when no feedbacks exist", async () => {
      prismaService.menuScan.findMany.mockResolvedValue([]);

      const result = await service.getAllFeedback(tenantId);

      expect(result).toEqual({
        success: true,
        data: [],
        count: 0,
      });
    });

    it("should include incidents in feedback results", async () => {
      const mockFeedbacks = [
        {
          id: "incident-1",
          interactionType: "incident",
          digitalMenuId: "menu-id",
          scannedAt: new Date(),
          metadata: { incidentType: "HYGIENE" },
        },
      ];

      prismaService.menuScan.findMany.mockResolvedValue(mockFeedbacks);

      const result = await service.getAllFeedback(tenantId);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].interactionType).toBe("incident");
    });
  });

  describe("getIncidents", () => {
    it("should return all incidents for tenant", async () => {
      const mockIncidents = [
        {
          id: "incident-1",
          interactionType: "incident",
          digitalMenuId: "menu-id",
          scannedAt: new Date(),
          metadata: {
            incidentType: "HYGIENE",
            severity: "HIGH",
            description: "Dirty table",
          },
        },
        {
          id: "incident-2",
          interactionType: "incident",
          digitalMenuId: "menu-id",
          scannedAt: new Date(),
          metadata: {
            incidentType: "SAFETY",
            severity: "CRITICAL",
            description: "Slippery floor",
          },
        },
      ];

      prismaService.menuScan.findMany.mockResolvedValue(mockIncidents);

      const result = await service.getIncidents(tenantId);

      expect(result).toEqual({
        success: true,
        data: mockIncidents,
        count: 2,
      });
      expect(prismaService.menuScan.findMany).toHaveBeenCalledWith({
        where: {
          interactionType: "incident",
        },
        orderBy: { scannedAt: "desc" },
      });
    });

    it("should filter incidents by severity when provided", async () => {
      const mockIncidents = [
        {
          id: "incident-1",
          interactionType: "incident",
          digitalMenuId: "menu-id",
          scannedAt: new Date(),
          metadata: {
            incidentType: "HYGIENE",
            severity: "CRITICAL",
            description: "Critical issue",
          },
        },
      ];

      prismaService.menuScan.findMany.mockResolvedValue(mockIncidents);

      const result = await service.getIncidents(tenantId, "CRITICAL");

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(prismaService.menuScan.findMany).toHaveBeenCalledWith({
        where: {
          interactionType: "incident",
          metadata: {
            severity: "CRITICAL",
          },
        },
        orderBy: { scannedAt: "desc" },
      });
    });

    it("should return empty array when no incidents exist", async () => {
      prismaService.menuScan.findMany.mockResolvedValue([]);

      const result = await service.getIncidents(tenantId);

      expect(result).toEqual({
        success: true,
        data: [],
        count: 0,
      });
    });

    it("should filter by LOW severity", async () => {
      prismaService.menuScan.findMany.mockResolvedValue([]);

      await service.getIncidents(tenantId, "LOW");

      expect(prismaService.menuScan.findMany).toHaveBeenCalledWith({
        where: {
          interactionType: "incident",
          metadata: { severity: "LOW" },
        },
        orderBy: { scannedAt: "desc" },
      });
    });

    it("should filter by MEDIUM severity", async () => {
      prismaService.menuScan.findMany.mockResolvedValue([]);

      await service.getIncidents(tenantId, "MEDIUM");

      expect(prismaService.menuScan.findMany).toHaveBeenCalledWith({
        where: {
          interactionType: "incident",
          metadata: { severity: "MEDIUM" },
        },
        orderBy: { scannedAt: "desc" },
      });
    });
  });
});
