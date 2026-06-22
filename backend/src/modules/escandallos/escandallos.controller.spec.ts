import { EscandallosController } from "./escandallos.controller";
import { EscandallosService } from "./escandallos.service";

describe("EscandallosController", () => {
  let controller: EscandallosController;
  let service: any;

  const mockEscandallosService = {
    getDetailedRecipeCost: jest.fn(),
    getCostVariations: jest.fn(),
    getCostProjections: jest.fn(),
    getCompleteCostAnalysis: jest.fn(),
    generateEscandalloReport: jest.fn(),
    convertUnits: jest.fn(),
  };

  beforeEach(() => {
    controller = new EscandallosController(mockEscandallosService as any);
    service = mockEscandallosService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getDetailedRecipeCost", () => {
    it("should return detailed recipe cost", async () => {
      const mockResult = {
        recipeId: "recipe-1",
        recipeName: "Test Recipe",
        totalCost: 50,
        costPerPortion: 12.5,
        costBreakdown: [],
      };

      mockEscandallosService.getDetailedRecipeCost.mockResolvedValue(
        mockResult,
      );

      const req = { tenantId: "tenant-1" };
      const result = await controller.getDetailedRecipeCost(req, "recipe-1");

      expect(service.getDetailedRecipeCost).toHaveBeenCalledWith(
        "tenant-1",
        "recipe-1",
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("getCostVariations", () => {
    it("should return cost variations", async () => {
      const mockVariations = [
        {
          recipeId: "recipe-1",
          recipeName: "Test Recipe",
          previousCost: 45,
          currentCost: 50,
          variation: 5,
          variationPercentage: 11.11,
          date: new Date(),
        },
      ];

      mockEscandallosService.getCostVariations.mockResolvedValue(
        mockVariations,
      );

      const req = { tenantId: "tenant-1" };
      const result = await controller.getCostVariations(req, "recipe-1");

      expect(service.getCostVariations).toHaveBeenCalledWith(
        "tenant-1",
        "recipe-1",
        undefined,
        undefined,
      );
      expect(result).toEqual(mockVariations);
    });

    it("should pass date parameters to service", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      mockEscandallosService.getCostVariations.mockResolvedValue([]);

      const req = { tenantId: "tenant-1" };
      await controller.getCostVariations(req, "recipe-1", startDate, endDate);

      expect(service.getCostVariations).toHaveBeenCalledWith(
        "tenant-1",
        "recipe-1",
        startDate,
        endDate,
      );
    });
  });

  describe("getCostProjections", () => {
    it("should return cost projections", async () => {
      const mockProjection = {
        recipeId: "recipe-1",
        recipeName: "Test Recipe",
        projectedCost: 52.5,
        confidence: 0.85,
        trend: "INCREASING",
        factors: {
          ingredientPriceTrend: 0.05,
          consumptionPattern: 0.02,
          seasonalFactor: 0.01,
        },
      };

      mockEscandallosService.getCostProjections.mockResolvedValue(
        mockProjection,
      );

      const req = { tenantId: "tenant-1" };
      const result = await controller.getCostProjections(req, "recipe-1");

      expect(service.getCostProjections).toHaveBeenCalledWith(
        "tenant-1",
        "recipe-1",
      );
      expect(result).toEqual(mockProjection);
    });
  });

  describe("getCompleteCostAnalysis", () => {
    it("should return complete cost analysis", async () => {
      const mockAnalysis = {
        recipeId: "recipe-1",
        recipeName: "Test Recipe",
        totalCost: 50,
        costPerPortion: 12.5,
        margin: 15,
        sellingPrice: 65,
        profitability: 30,
        variations: [],
        projections: [],
      };

      mockEscandallosService.getCompleteCostAnalysis.mockResolvedValue(
        mockAnalysis,
      );

      const req = { tenantId: "tenant-1" };
      const result = await controller.getCompleteCostAnalysis(req, "recipe-1");

      expect(service.getCompleteCostAnalysis).toHaveBeenCalledWith(
        "tenant-1",
        "recipe-1",
      );
      expect(result).toEqual(mockAnalysis);
    });
  });

  describe("generateEscandalloReport", () => {
    it("should generate report", async () => {
      const mockReport = {
        success: true,
        data: {
          generatedAt: new Date(),
          summary: {},
          analysis: [],
        },
        message: "Escandallo report generated successfully",
      };

      const dto = {
        recipeId: "recipe-1",
        includeVariations: true,
        includeProjections: true,
      };

      mockEscandallosService.generateEscandalloReport.mockResolvedValue(
        mockReport,
      );

      const req = { tenantId: "tenant-1" };
      const result = await controller.generateEscandalloReport(req, dto);

      expect(service.generateEscandalloReport).toHaveBeenCalledWith(
        "tenant-1",
        dto,
      );
      expect(result).toEqual(mockReport);
    });
  });

  describe("convertUnits", () => {
    it("should convert units", async () => {
      const mockConversion = {
        success: true,
        data: {
          original: { quantity: 1, unit: "kg" },
          converted: { quantity: 1000, unit: "g" },
          conversionRate: 1000,
        },
        message: "Unit conversion completed",
      };

      mockEscandallosService.convertUnits.mockResolvedValue(mockConversion);

      const req = { tenantId: "tenant-1" };
      const result = await controller.convertUnits(
        req,
        "kg",
        "g",
        1,
        "product-1",
      );

      expect(service.convertUnits).toHaveBeenCalledWith(
        "tenant-1",
        "kg",
        "g",
        1,
        "product-1",
      );
      expect(result).toEqual(mockConversion);
    });
  });
});
