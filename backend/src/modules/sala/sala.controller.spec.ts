import { Test, TestingModule } from "@nestjs/testing";
import { SalaController } from "./sala.controller";
import { SalaService } from "./sala.service";
import {
  FeedbackDto,
  QrScanDto,
  InteractionDto,
  IncidentDto,
  SalaStatsDto,
} from "./dto/sala.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";

describe("SalaController", () => {
  let controller: SalaController;

  const mockSalaService = {
    validateQrCode: jest.fn(),
    submitFeedback: jest.fn(),
    trackInteraction: jest.fn(),
    reportIncident: jest.fn(),
    getSalaStats: jest.fn(),
    getAllFeedback: jest.fn(),
    getIncidents: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalaController],
      providers: [
        {
          provide: SalaService,
          useValue: mockSalaService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SalaController>(SalaController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("validateQrCode", () => {
    it("should validate a QR code successfully", async () => {
      const qrScanDto: QrScanDto = {
        qrCode: "qr-code-123",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        language: "es",
      };

      const expectedResult = {
        isValid: true,
        digitalMenuId: "menu-1",
        menuId: "menu-id-1",
        tenantId: "tenant-1",
        restaurantName: "Test Restaurant",
      };

      mockSalaService.validateQrCode.mockResolvedValue(expectedResult);

      const result = await controller.validateQrCode(qrScanDto);

      expect(mockSalaService.validateQrCode).toHaveBeenCalledWith(qrScanDto);
      expect(result.isValid).toBe(true);
      expect(result.digitalMenuId).toBe("menu-1");
    });

    it("should return invalid for non-existent QR code", async () => {
      const qrScanDto: QrScanDto = {
        qrCode: "invalid-qr",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      };

      const expectedResult = {
        isValid: false,
        error: "QR code not found or expired",
      };

      mockSalaService.validateQrCode.mockResolvedValue(expectedResult);

      const result = await controller.validateQrCode(qrScanDto);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("QR code not found or expired");
    });

    it("should handle validation error", async () => {
      const qrScanDto: QrScanDto = {
        qrCode: "error-qr",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      };

      const expectedResult = {
        isValid: false,
        error: "Error validating QR code",
      };

      mockSalaService.validateQrCode.mockResolvedValue(expectedResult);

      const result = await controller.validateQrCode(qrScanDto);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Error");
    });

    it("should validate QR code without optional fields", async () => {
      const qrScanDto: QrScanDto = {
        qrCode: "qr-code-456",
        ipAddress: "192.168.1.2",
        userAgent: "Chrome",
      };

      const expectedResult = {
        isValid: true,
        digitalMenuId: "menu-2",
        menuId: "menu-id-2",
        tenantId: "tenant-1",
        restaurantName: "Restaurant 2",
      };

      mockSalaService.validateQrCode.mockResolvedValue(expectedResult);

      const result = await controller.validateQrCode(qrScanDto);

      expect(result.isValid).toBe(true);
    });
  });

  describe("submitFeedback", () => {
    it("should submit feedback successfully", async () => {
      const feedbackDto: FeedbackDto = {
        digitalMenuId: "menu-1",
        type: "RATING",
        rating: 5,
        comment: "Excellent food!",
        category: "FOOD_QUALITY",
        menuItemId: "item-1",
        customerName: "John Doe",
        customerEmail: "john@test.com",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      };

      const expectedResult = {
        success: true,
        data: {
          id: "scan-1",
          digitalMenuId: "menu-1",
          interactionType: "rating",
        },
        message: "Feedback submitted successfully",
      };

      mockSalaService.submitFeedback.mockResolvedValue(expectedResult);

      const result = await controller.submitFeedback(feedbackDto);

      expect(mockSalaService.submitFeedback).toHaveBeenCalledWith(feedbackDto);
      expect(result.success).toBe(true);
      expect(result.message).toBe("Feedback submitted successfully");
    });

    it("should submit comment feedback", async () => {
      const feedbackDto: FeedbackDto = {
        digitalMenuId: "menu-1",
        type: "COMMENT",
        comment: "Great service!",
        category: "SERVICE",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      };

      const expectedResult = {
        success: true,
        data: { id: "scan-2" },
        message: "Feedback submitted successfully",
      };

      mockSalaService.submitFeedback.mockResolvedValue(expectedResult);

      const result = await controller.submitFeedback(feedbackDto);

      expect(result.success).toBe(true);
    });

    it("should submit feedback without optional fields", async () => {
      const feedbackDto: FeedbackDto = {
        digitalMenuId: "menu-1",
        type: "RATING",
        rating: 4,
        ipAddress: "192.168.1.1",
        userAgent: "Chrome",
      };

      const expectedResult = {
        success: true,
        data: { id: "scan-3" },
        message: "Feedback submitted successfully",
      };

      mockSalaService.submitFeedback.mockResolvedValue(expectedResult);

      const result = await controller.submitFeedback(feedbackDto);

      expect(mockSalaService.submitFeedback).toHaveBeenCalledWith(feedbackDto);
      expect(result.success).toBe(true);
    });
  });

  describe("trackInteraction", () => {
    it("should track interaction successfully", async () => {
      const interactionDto: InteractionDto = {
        digitalMenuId: "menu-1",
        interactionType: "VIEW_ITEM",
        menuItemId: "item-1",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        language: "es",
      };

      const expectedResult = {
        success: true,
        data: {
          id: "interaction-1",
          digitalMenuId: "menu-1",
          interactionType: "VIEW_ITEM",
        },
      };

      mockSalaService.trackInteraction.mockResolvedValue(expectedResult);

      const result = await controller.trackInteraction(interactionDto);

      expect(mockSalaService.trackInteraction).toHaveBeenCalledWith(
        interactionDto,
      );
      expect(result.success).toBe(true);
    });

    it("should track allergen filter interaction", async () => {
      const interactionDto: InteractionDto = {
        digitalMenuId: "menu-1",
        interactionType: "FILTER_ALLERGENS",
        filteredByAllergens: ["gluten", "nuts"],
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      };

      const expectedResult = {
        success: true,
        data: { id: "interaction-2" },
      };

      mockSalaService.trackInteraction.mockResolvedValue(expectedResult);

      const result = await controller.trackInteraction(interactionDto);

      expect(result.success).toBe(true);
    });

    it("should track interaction with metadata", async () => {
      const interactionDto: InteractionDto = {
        digitalMenuId: "menu-1",
        interactionType: "VIEW_SECTION",
        metadata: { sectionId: "section-1", duration: 30 },
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      };

      const expectedResult = {
        success: true,
        data: { id: "interaction-3" },
      };

      mockSalaService.trackInteraction.mockResolvedValue(expectedResult);

      const result = await controller.trackInteraction(interactionDto);

      expect(mockSalaService.trackInteraction).toHaveBeenCalledWith(
        interactionDto,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("reportIncident", () => {
    it("should report incident successfully", async () => {
      const incidentDto: IncidentDto = {
        digitalMenuId: "menu-1",
        type: "FOOD_QUALITY",
        description: "Customer reported stomach issues",
        severity: "HIGH",
        location: "Table 5",
        customerName: "Jane Doe",
        customerContact: "+1234567890",
        customerEmail: "jane@test.com",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      };

      const expectedResult = {
        success: true,
        data: {
          id: "incident-1",
          interactionType: "incident",
        },
        message: "Incident reported successfully",
      };

      mockSalaService.reportIncident.mockResolvedValue(expectedResult);

      const result = await controller.reportIncident(incidentDto);

      expect(mockSalaService.reportIncident).toHaveBeenCalledWith(incidentDto);
      expect(result.success).toBe(true);
      expect(result.message).toBe("Incident reported successfully");
    });

    it("should report critical incident", async () => {
      const incidentDto: IncidentDto = {
        digitalMenuId: "menu-1",
        type: "SAFETY",
        description: "Severe allergic reaction",
        severity: "CRITICAL",
        location: "Table 10",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      };

      const expectedResult = {
        success: true,
        data: { id: "incident-2" },
        message: "Incident reported successfully",
      };

      mockSalaService.reportIncident.mockResolvedValue(expectedResult);

      const result = await controller.reportIncident(incidentDto);

      expect(result.success).toBe(true);
    });

    it("should report low severity incident", async () => {
      const incidentDto: IncidentDto = {
        digitalMenuId: "menu-1",
        type: "SERVICE",
        description: "Slow service",
        severity: "LOW",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      };

      const expectedResult = {
        success: true,
        data: { id: "incident-3" },
        message: "Incident reported successfully",
      };

      mockSalaService.reportIncident.mockResolvedValue(expectedResult);

      const result = await controller.reportIncident(incidentDto);

      expect(result.success).toBe(true);
    });

    it("should report incident with date", async () => {
      const incidentDto: IncidentDto = {
        digitalMenuId: "menu-1",
        type: "HYGIENE",
        description: "Unclean table",
        severity: "MEDIUM",
        incidentDate: new Date().toISOString(),
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      };

      const expectedResult = {
        success: true,
        data: { id: "incident-4" },
        message: "Incident reported successfully",
      };

      mockSalaService.reportIncident.mockResolvedValue(expectedResult);

      const result = await controller.reportIncident(incidentDto);

      expect(result.success).toBe(true);
    });
  });

  describe("getSalaStats", () => {
    it("should return sala stats with required params", async () => {
      const tenantId = "tenant-1";
      const dto: SalaStatsDto = {
        digitalMenuId: "menu-1",
      };

      const expectedResult = {
        success: true,
        data: {
          totalScans: 150,
          uniqueScans: 120,
          byInteractionType: {
            scan: 100,
            rating: 30,
            incident: 5,
          },
          byLanguage: {
            es: 100,
            en: 50,
          },
          avgRating: 4.5,
          ratingCount: 30,
          incidents: [],
          recentScans: [],
        },
      };

      mockSalaService.getSalaStats.mockResolvedValue(expectedResult);

      const result = await controller.getSalaStats(tenantId, dto);

      expect(mockSalaService.getSalaStats).toHaveBeenCalledWith(tenantId, dto);
      expect(result.success).toBe(true);
      expect(result.data.totalScans).toBe(150);
    });

    it("should return sala stats with date range", async () => {
      const tenantId = "tenant-1";
      const dto: SalaStatsDto = {
        digitalMenuId: "menu-1",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      };

      const expectedResult = {
        success: true,
        data: {
          totalScans: 50,
          uniqueScans: 40,
          byInteractionType: {},
          byLanguage: {},
          avgRating: 0,
          ratingCount: 0,
          incidents: [],
          recentScans: [],
        },
      };

      mockSalaService.getSalaStats.mockResolvedValue(expectedResult);

      const result = await controller.getSalaStats(tenantId, dto);

      expect(result.success).toBe(true);
    });

    it("should return stats with incidents", async () => {
      const tenantId = "tenant-1";
      const dto: SalaStatsDto = {
        digitalMenuId: "menu-1",
      };

      const expectedResult = {
        success: true,
        data: {
          totalScans: 100,
          uniqueScans: 80,
          byInteractionType: { incident: 5 },
          byLanguage: {},
          avgRating: 4.0,
          ratingCount: 20,
          incidents: [
            {
              id: "incident-1",
              type: "FOOD_POISONING",
              severity: "HIGH",
              description: "Test incident",
              location: "Table 1",
              reportedAt: new Date(),
            },
          ],
          recentScans: [],
        },
      };

      mockSalaService.getSalaStats.mockResolvedValue(expectedResult);

      const result = await controller.getSalaStats(tenantId, dto);

      expect(result.data.incidents).toHaveLength(1);
    });
  });

  describe("getAllFeedback", () => {
    it("should return all feedback for tenant", async () => {
      const tenantId = "tenant-1";

      const expectedResult = {
        success: true,
        data: [
          {
            id: "feedback-1",
            digitalMenuId: "menu-1",
            interactionType: "rating",
            metadata: { rating: 5 },
          },
          {
            id: "feedback-2",
            digitalMenuId: "menu-1",
            interactionType: "comment",
            metadata: { comment: "Great!" },
          },
        ],
        count: 2,
      };

      mockSalaService.getAllFeedback.mockResolvedValue(expectedResult);

      const result = await controller.getAllFeedback(tenantId);

      expect(mockSalaService.getAllFeedback).toHaveBeenCalledWith(
        tenantId,
        undefined,
      );
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
    });

    it("should return feedback filtered by digital menu", async () => {
      const tenantId = "tenant-1";
      const digitalMenuId = "menu-1";

      const expectedResult = {
        success: true,
        data: [
          {
            id: "feedback-1",
            digitalMenuId: "menu-1",
            interactionType: "rating",
          },
        ],
        count: 1,
      };

      mockSalaService.getAllFeedback.mockResolvedValue(expectedResult);

      const result = await controller.getAllFeedback(tenantId, digitalMenuId);

      expect(mockSalaService.getAllFeedback).toHaveBeenCalledWith(
        tenantId,
        digitalMenuId,
      );
      expect(result.count).toBe(1);
    });

    it("should return empty array if no feedback", async () => {
      const tenantId = "tenant-1";

      const expectedResult = {
        success: true,
        data: [],
        count: 0,
      };

      mockSalaService.getAllFeedback.mockResolvedValue(expectedResult);

      const result = await controller.getAllFeedback(tenantId);

      expect(result.data).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });

  describe("getIncidents", () => {
    it("should return all incidents for tenant", async () => {
      const tenantId = "tenant-1";

      const expectedResult = {
        success: true,
        data: [
          {
            id: "incident-1",
            interactionType: "incident",
            metadata: {
              incidentType: "FOOD_POISONING",
              severity: "HIGH",
            },
          },
          {
            id: "incident-2",
            interactionType: "incident",
            metadata: {
              incidentType: "SERVICE_COMPLAINT",
              severity: "LOW",
            },
          },
        ],
        count: 2,
      };

      mockSalaService.getIncidents.mockResolvedValue(expectedResult);

      const result = await controller.getIncidents(tenantId);

      expect(mockSalaService.getIncidents).toHaveBeenCalledWith(
        tenantId,
        undefined,
      );
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
    });

    it("should return incidents filtered by severity", async () => {
      const tenantId = "tenant-1";
      const severity = "HIGH";

      const expectedResult = {
        success: true,
        data: [
          {
            id: "incident-1",
            interactionType: "incident",
            metadata: {
              incidentType: "FOOD_POISONING",
              severity: "HIGH",
            },
          },
        ],
        count: 1,
      };

      mockSalaService.getIncidents.mockResolvedValue(expectedResult);

      const result = await controller.getIncidents(tenantId, severity);

      expect(mockSalaService.getIncidents).toHaveBeenCalledWith(
        tenantId,
        severity,
      );
      expect(result.count).toBe(1);
    });

    it("should return empty array if no incidents", async () => {
      const tenantId = "tenant-1";

      const expectedResult = {
        success: true,
        data: [],
        count: 0,
      };

      mockSalaService.getIncidents.mockResolvedValue(expectedResult);

      const result = await controller.getIncidents(tenantId);

      expect(result.data).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it("should filter by critical severity", async () => {
      const tenantId = "tenant-1";
      const severity = "CRITICAL";

      const expectedResult = {
        success: true,
        data: [],
        count: 0,
      };

      mockSalaService.getIncidents.mockResolvedValue(expectedResult);

      const result = await controller.getIncidents(tenantId, severity);

      expect(mockSalaService.getIncidents).toHaveBeenCalledWith(
        tenantId,
        "CRITICAL",
      );
      expect(result.success).toBe(true);
    });
  });
});
