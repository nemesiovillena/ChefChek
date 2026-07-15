import { Test, TestingModule } from "@nestjs/testing";
import { DigitalMenuController } from "./digital-menu.controller";
import { DigitalMenuService } from "./digital-menu.service";
import {
  CreateDigitalMenuConfigDto,
  UpdateDigitalMenuConfigDto,
  GenerateQRCodeDto,
  PublicMenuQueryDto,
  RegisterScanDto,
} from "./dto/digital-menu.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard } from "../../guards/module.guard";

describe("DigitalMenuController", () => {
  let controller: DigitalMenuController;
  let service: DigitalMenuService;

  const mockDigitalMenuService = {
    createConfig: jest.fn(),
    getDigitalMenus: jest.fn(),
    getDigitalMenuById: jest.fn(),
    updateDigitalMenu: jest.fn(),
    deleteDigitalMenu: jest.fn(),
    toggleDigitalMenuStatus: jest.fn(),
    generateQRCode: jest.fn(),
    getAnalytics: jest.fn(),
    getPublicMenu: jest.fn(),
    registerScan: jest.fn(),
  };

  const mockReq = {
    tenantId: "tenant-test-123",
    user: { id: "user-1", role: "ADMIN" },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DigitalMenuController],
      providers: [
        { provide: DigitalMenuService, useValue: mockDigitalMenuService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ModuleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DigitalMenuController>(DigitalMenuController);
    service = module.get<DigitalMenuService>(DigitalMenuService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createConfig", () => {
    it("should create a digital menu config", async () => {
      const createDto: CreateDigitalMenuConfigDto = {
        menuId: "menu-1",
        name: "Main Menu QR",
        primaryColor: "#FF5733",
        showPrices: true,
      };

      const mockConfig = {
        id: "config-1",
        ...createDto,
        qrCodeUrl: "http://test.com/qr",
      };

      mockDigitalMenuService.createConfig.mockResolvedValue({
        success: true,
        data: mockConfig,
      });

      const result = await controller.createConfig(mockReq, createDto);

      expect(mockDigitalMenuService.createConfig).toHaveBeenCalledWith(
        mockReq.tenantId,
        createDto,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockConfig);
    });
  });

  describe("getDigitalMenus", () => {
    it("should return list of digital menu configs", async () => {
      const mockConfigs = [
        { id: "config-1", name: "Main Menu QR" },
        { id: "config-2", name: "Summer Menu QR" },
      ];

      mockDigitalMenuService.getDigitalMenus.mockResolvedValue({
        success: true,
        data: mockConfigs,
      });

      const result = await controller.getDigitalMenus(mockReq);

      expect(mockDigitalMenuService.getDigitalMenus).toHaveBeenCalledWith(
        mockReq.tenantId,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockConfigs);
    });
  });

  describe("getDigitalMenuById", () => {
    it("should return a digital menu config by ID", async () => {
      const configId = "config-1";
      const mockConfig = { id: configId, name: "Main Menu QR" };

      mockDigitalMenuService.getDigitalMenuById.mockResolvedValue({
        success: true,
        data: mockConfig,
      });

      const result = await controller.getDigitalMenuById(mockReq, configId);

      expect(mockDigitalMenuService.getDigitalMenuById).toHaveBeenCalledWith(
        configId,
        mockReq.tenantId,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockConfig);
    });
  });

  describe("updateDigitalMenu", () => {
    it("should update a digital menu config", async () => {
      const configId = "config-1";
      const updateDto: UpdateDigitalMenuConfigDto = {
        name: "Updated Menu QR",
        primaryColor: "#00FF00",
      };

      const mockUpdated = { id: configId, ...updateDto };

      mockDigitalMenuService.updateDigitalMenu.mockResolvedValue({
        success: true,
        data: mockUpdated,
      });

      const result = await controller.updateDigitalMenu(
        mockReq,
        configId,
        updateDto,
      );

      expect(mockDigitalMenuService.updateDigitalMenu).toHaveBeenCalledWith(
        configId,
        mockReq.tenantId,
        updateDto,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdated);
    });
  });

  describe("deleteDigitalMenu", () => {
    it("should delete a digital menu config", async () => {
      const configId = "config-1";

      mockDigitalMenuService.deleteDigitalMenu.mockResolvedValue({
        success: true,
        message: "Digital menu config deleted successfully",
      });

      const result = await controller.deleteDigitalMenu(mockReq, configId);

      expect(mockDigitalMenuService.deleteDigitalMenu).toHaveBeenCalledWith(
        configId,
        mockReq.tenantId,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("toggleDigitalMenuStatus", () => {
    it("should toggle digital menu status", async () => {
      const configId = "config-1";

      mockDigitalMenuService.toggleDigitalMenuStatus.mockResolvedValue({
        success: true,
        data: { id: configId, isActive: true },
        message: "Digital menu activated successfully",
      });

      const result = await controller.toggleDigitalMenuStatus(
        mockReq,
        configId,
      );

      expect(
        mockDigitalMenuService.toggleDigitalMenuStatus,
      ).toHaveBeenCalledWith(configId, mockReq.tenantId);
      expect(result.success).toBe(true);
    });
  });

  describe("generateQRCode", () => {
    it("should generate QR code for digital menu", async () => {
      const configId = "config-1";
      const qrDto: GenerateQRCodeDto = {
        digitalMenuId: "menu-1",
        format: "png",
        size: 400,
      };

      const mockQRData = {
        qrCodeUrl: "http://test.com/qr/config-1?format=png&size=400",
        format: "png",
        size: 400,
      };

      mockDigitalMenuService.generateQRCode.mockResolvedValue({
        success: true,
        data: mockQRData,
      });

      const result = await controller.generateQRCode(mockReq, configId, qrDto);

      expect(mockDigitalMenuService.generateQRCode).toHaveBeenCalledWith(
        configId,
        mockReq.tenantId,
        qrDto,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockQRData);
    });

    it("should generate QR code with default options", async () => {
      const configId = "config-1";

      mockDigitalMenuService.generateQRCode.mockResolvedValue({
        success: true,
        data: { qrCodeUrl: "http://test.com/qr", format: "png", size: 300 },
      });

      await controller.generateQRCode(mockReq, configId);

      expect(mockDigitalMenuService.generateQRCode).toHaveBeenCalledWith(
        configId,
        mockReq.tenantId,
        undefined,
      );
    });
  });

  describe("getAnalytics", () => {
    it("should return analytics for digital menu", async () => {
      const configId = "config-1";
      const mockAnalytics = {
        summary: {
          totalScans: 100,
          uniqueScans: 75,
          avgScansPerUser: 1.33,
        },
        scansByLanguage: { es: 80, en: 20 },
        scansByType: { scan: 100 },
      };

      mockDigitalMenuService.getAnalytics.mockResolvedValue({
        success: true,
        data: mockAnalytics,
      });

      const result = await controller.getAnalytics(mockReq, configId);

      expect(mockDigitalMenuService.getAnalytics).toHaveBeenCalledWith(
        configId,
        mockReq.tenantId,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAnalytics);
    });
  });

  describe("getPublicMenu", () => {
    it("should return public menu view (no auth required)", async () => {
      const configId = "config-1";
      const query: PublicMenuQueryDto = {};

      const mockPublicMenu = {
        config: { name: "Main Menu", showPrices: true },
        menu: { id: "menu-1", name: "Menu", sections: [] },
      };

      mockDigitalMenuService.getPublicMenu.mockResolvedValue({
        success: true,
        data: mockPublicMenu,
      });

      const result = await controller.getPublicMenu(configId, query);

      expect(mockDigitalMenuService.getPublicMenu).toHaveBeenCalledWith(
        configId,
        query,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPublicMenu);
    });

    it("should filter menu by language", async () => {
      const configId = "config-1";
      const query: PublicMenuQueryDto = { language: "en" };

      mockDigitalMenuService.getPublicMenu.mockResolvedValue({
        success: true,
        data: { config: {}, menu: {} },
      });

      await controller.getPublicMenu(configId, query);

      expect(mockDigitalMenuService.getPublicMenu).toHaveBeenCalledWith(
        configId,
        query,
      );
    });

    it("should filter menu by allergens", async () => {
      const configId = "config-1";
      const query: PublicMenuQueryDto = { filteredByAllergens: [1, 2] };

      mockDigitalMenuService.getPublicMenu.mockResolvedValue({
        success: true,
        data: { config: {}, menu: {} },
      });

      await controller.getPublicMenu(configId, query);

      expect(mockDigitalMenuService.getPublicMenu).toHaveBeenCalledWith(
        configId,
        query,
      );
    });
  });

  describe("registerScan", () => {
    it("should register a QR scan (no auth required)", async () => {
      const configId = "config-1";
      const scanDto: RegisterScanDto = {
        digitalMenuId: configId,
        language: "es",
        interactionType: "scan",
      };

      const mockScan = { id: "scan-1", ...scanDto, scannedAt: new Date() };

      mockDigitalMenuService.registerScan.mockResolvedValue({
        success: true,
        data: mockScan,
      });

      const result = await controller.registerScan(configId, scanDto);

      expect(mockDigitalMenuService.registerScan).toHaveBeenCalledWith(
        configId,
        scanDto,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockScan);
    });
  });
});
