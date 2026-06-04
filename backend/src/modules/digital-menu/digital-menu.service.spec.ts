import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { DigitalMenuService } from "./digital-menu.service";
import { PrismaService } from "../../common/services/prisma.service";
import {
  CreateDigitalMenuConfigDto,
  UpdateDigitalMenuConfigDto,
  GenerateQRCodeDto,
  PublicMenuQueryDto,
  RegisterScanDto,
} from "./dto/digital-menu.dto";

describe("DigitalMenuService", () => {
  let service: DigitalMenuService;
  let mockPrismaService: any;

  const tenantId = "test-tenant-id";
  const configId = "test-config-id";
  const menuId = "test-menu-id";

  const mockMenu = {
    id: menuId,
    tenantId,
    name: "Test Menu",
    description: "Test Description",
    items: [],
    sections: [],
    translations: [],
  };

  const mockDigitalMenuConfig = {
    id: configId,
    tenantId,
    menuId,
    name: "Test Digital Menu",
    isActive: true,
    primaryColor: "#FF5733",
    secondaryColor: "#00FF00",
    fontFamily: "Arial",
    logoUrl: "https://example.com/logo.png",
    isOpen: true,
    openingHours: {},
    showPrices: true,
    showAllergens: true,
    showDescriptions: true,
    enableAllergenFilter: true,
    qrCodeUrl:
      "http://localhost:3000/api/v1/digital-menu/public/test-config-id?format=png&size=300",
    scanCount: 0,
    lastScannedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    menu: mockMenu,
  };

  const mockScan = {
    id: "scan-id",
    digitalMenuId: configId,
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0",
    referrer: "https://example.com",
    language: "es",
    filteredByAllergens: [1, 2],
    interactionType: "scan",
    metadata: {},
    scannedAt: new Date(),
  };

  beforeEach(async () => {
    mockPrismaService = {
      menu: {
        findFirst: jest.fn(),
      },
      digitalMenuConfig: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      menuScan: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DigitalMenuService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DigitalMenuService>(DigitalMenuService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createConfig", () => {
    const createDto: CreateDigitalMenuConfigDto = {
      name: "Test Digital Menu",
      menuId,
      isActive: true,
      primaryColor: "#FF5733",
      secondaryColor: "#00FF00",
      showPrices: true,
      showAllergens: true,
      showDescriptions: true,
      enableAllergenFilter: true,
    };

    it("should create digital menu config successfully", async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue(mockMenu);
      mockPrismaService.digitalMenuConfig.create.mockResolvedValue(
        mockDigitalMenuConfig,
      );
      mockPrismaService.digitalMenuConfig.update.mockResolvedValue({
        ...mockDigitalMenuConfig,
        qrCodeUrl:
          "http://localhost:3000/api/v1/digital-menu/public/test-config-id?format=png&size=300",
      });

      const result = await service.createConfig(tenantId, createDto);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.name).toBe("Test Digital Menu");
      expect(result.message).toBe("Digital menu config created successfully");
      expect(mockPrismaService.menu.findFirst).toHaveBeenCalledWith({
        where: { id: menuId, tenantId },
      });
      expect(mockPrismaService.digitalMenuConfig.create).toHaveBeenCalled();
    });

    it("should throw NotFoundException if menu not found", async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue(null);

      await expect(service.createConfig(tenantId, createDto)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrismaService.menu.findFirst).toHaveBeenCalledWith({
        where: { id: menuId, tenantId },
      });
      expect(mockPrismaService.digitalMenuConfig.create).not.toHaveBeenCalled();
    });
  });

  describe("getDigitalMenus", () => {
    it("should retrieve all digital menu configs for tenant", async () => {
      mockPrismaService.digitalMenuConfig.findMany.mockResolvedValue([
        mockDigitalMenuConfig,
      ]);

      const result = await service.getDigitalMenus(tenantId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(configId);
      expect(result.message).toBe("Digital menus retrieved successfully");
      expect(mockPrismaService.digitalMenuConfig.findMany).toHaveBeenCalledWith(
        {
          where: { tenantId },
          include: {
            menu: {
              include: {
                items: {
                  include: {
                    recipe: true,
                  },
                },
                translations: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      );
    });

    it("should return empty array if no configs found", async () => {
      mockPrismaService.digitalMenuConfig.findMany.mockResolvedValue([]);

      const result = await service.getDigitalMenus(tenantId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe("getDigitalMenuById", () => {
    it("should retrieve digital menu config by id", async () => {
      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(
        mockDigitalMenuConfig,
      );

      const result = await service.getDigitalMenuById(configId, tenantId);

      expect(result.success).toBe(true);
      expect(result.data.id).toBe(configId);
      expect(result.message).toBe("Digital menu config retrieved successfully");
      expect(
        mockPrismaService.digitalMenuConfig.findFirst,
      ).toHaveBeenCalledWith({
        where: { id: configId, tenantId },
        include: {
          menu: {
            include: {
              items: {
                include: {
                  recipe: true,
                },
              },
              translations: true,
            },
          },
        },
      });
    });

    it("should throw NotFoundException if config not found", async () => {
      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(null);

      await expect(
        service.getDigitalMenuById(configId, tenantId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateDigitalMenu", () => {
    const updateDto: UpdateDigitalMenuConfigDto = {
      name: "Updated Menu",
      primaryColor: "#000000",
    };

    it("should update digital menu config successfully", async () => {
      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(
        mockDigitalMenuConfig,
      );
      mockPrismaService.digitalMenuConfig.update.mockResolvedValue({
        ...mockDigitalMenuConfig,
        ...updateDto,
      });

      const result = await service.updateDigitalMenu(
        configId,
        tenantId,
        updateDto,
      );

      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Updated Menu");
      expect(result.message).toBe("Digital menu config updated successfully");
      expect(mockPrismaService.digitalMenuConfig.update).toHaveBeenCalledWith({
        where: { id: configId },
        data: updateDto,
      });
    });

    it("should verify new menuId if provided", async () => {
      const updateWithMenu: UpdateDigitalMenuConfigDto = {
        menuId: "new-menu-id",
      };

      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(
        mockDigitalMenuConfig,
      );
      mockPrismaService.menu.findFirst.mockResolvedValue({ id: "new-menu-id" });
      mockPrismaService.digitalMenuConfig.update.mockResolvedValue(
        mockDigitalMenuConfig,
      );

      await service.updateDigitalMenu(configId, tenantId, updateWithMenu);

      expect(mockPrismaService.menu.findFirst).toHaveBeenCalledWith({
        where: { id: "new-menu-id", tenantId },
      });
    });

    it("should throw NotFoundException if config not found", async () => {
      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(null);

      await expect(
        service.updateDigitalMenu(configId, tenantId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException if new menu not found", async () => {
      const updateWithMenu: UpdateDigitalMenuConfigDto = {
        menuId: "invalid-menu-id",
      };

      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(
        mockDigitalMenuConfig,
      );
      mockPrismaService.menu.findFirst.mockResolvedValue(null);

      await expect(
        service.updateDigitalMenu(configId, tenantId, updateWithMenu),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("deleteDigitalMenu", () => {
    it("should delete digital menu config successfully", async () => {
      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(
        mockDigitalMenuConfig,
      );
      mockPrismaService.digitalMenuConfig.delete.mockResolvedValue(
        mockDigitalMenuConfig,
      );

      const result = await service.deleteDigitalMenu(configId, tenantId);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Digital menu config deleted successfully");
      expect(mockPrismaService.digitalMenuConfig.delete).toHaveBeenCalledWith({
        where: { id: configId },
      });
    });

    it("should throw NotFoundException if config not found", async () => {
      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteDigitalMenu(configId, tenantId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("toggleDigitalMenuStatus", () => {
    it("should toggle status from active to inactive", async () => {
      const activeConfig = { ...mockDigitalMenuConfig, isActive: true };
      const updatedConfig = { ...mockDigitalMenuConfig, isActive: false };

      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(
        activeConfig,
      );
      mockPrismaService.digitalMenuConfig.update.mockResolvedValue(
        updatedConfig,
      );

      const result = await service.toggleDigitalMenuStatus(configId, tenantId);

      expect(result.success).toBe(true);
      expect(result.data.isActive).toBe(false);
      expect(result.message).toBe("Digital menu deactivated successfully");
      expect(mockPrismaService.digitalMenuConfig.update).toHaveBeenCalledWith({
        where: { id: configId },
        data: { isActive: false },
      });
    });

    it("should toggle status from inactive to active", async () => {
      const inactiveConfig = { ...mockDigitalMenuConfig, isActive: false };
      const updatedConfig = { ...mockDigitalMenuConfig, isActive: true };

      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(
        inactiveConfig,
      );
      mockPrismaService.digitalMenuConfig.update.mockResolvedValue(
        updatedConfig,
      );

      const result = await service.toggleDigitalMenuStatus(configId, tenantId);

      expect(result.success).toBe(true);
      expect(result.data.isActive).toBe(true);
      expect(result.message).toBe("Digital menu activated successfully");
    });

    it("should throw NotFoundException if config not found", async () => {
      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(null);

      await expect(
        service.toggleDigitalMenuStatus(configId, tenantId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("generateQRCode", () => {
    const qrDto: GenerateQRCodeDto = {
      digitalMenuId: configId,
      format: "png",
      size: 300,
    };

    it("should generate QR code successfully with default values", async () => {
      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(
        mockDigitalMenuConfig,
      );
      mockPrismaService.digitalMenuConfig.update.mockResolvedValue({
        ...mockDigitalMenuConfig,
        qrCodeUrl:
          "http://localhost:3000/api/v1/digital-menu/public/test-config-id?format=png&size=300",
      });

      const result = await service.generateQRCode(configId, tenantId, qrDto);

      expect(result.success).toBe(true);
      expect(result.data.qrCodeUrl).toBeDefined();
      expect(result.data.format).toBe("png");
      expect(result.data.size).toBe(300);
      expect(result.message).toBe("QR code generated successfully");
    });

    it("should generate QR code with custom format and size", async () => {
      const customDto: GenerateQRCodeDto = {
        digitalMenuId: configId,
        format: "svg",
        size: 500,
      };

      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(
        mockDigitalMenuConfig,
      );
      mockPrismaService.digitalMenuConfig.update.mockResolvedValue(
        mockDigitalMenuConfig,
      );

      const result = await service.generateQRCode(
        configId,
        tenantId,
        customDto,
      );

      expect(result.data.format).toBe("svg");
      expect(result.data.size).toBe(500);
    });

    it("should use default format and size if not provided", async () => {
      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(
        mockDigitalMenuConfig,
      );
      mockPrismaService.digitalMenuConfig.update.mockResolvedValue(
        mockDigitalMenuConfig,
      );

      const result = await service.generateQRCode(configId, tenantId);

      expect(result.data.format).toBe("png");
      expect(result.data.size).toBe(300);
    });

    it("should throw NotFoundException if config not found", async () => {
      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(null);

      await expect(
        service.generateQRCode(configId, tenantId, qrDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getPublicMenu", () => {
    const query: PublicMenuQueryDto = {
      language: "es",
    };

    const mockConfigWithSections = {
      ...mockDigitalMenuConfig,
      menu: {
        ...mockMenu,
        sections: [
          {
            id: "section-1",
            name: "Starters",
            sortOrder: 1,
            items: [
              {
                id: "item-1",
                recipe: {
                  id: "recipe-1",
                  name: "Salad",
                  allergens: [1, 2],
                },
              },
            ],
          },
        ],
      },
    };

    it("should retrieve public menu successfully", async () => {
      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(
        mockConfigWithSections,
      );
      mockPrismaService.menuScan.create.mockResolvedValue(mockScan);
      mockPrismaService.digitalMenuConfig.update.mockResolvedValue(
        mockConfigWithSections,
      );

      const result = await service.getPublicMenu(configId, query);

      expect(result.success).toBe(true);
      expect(result.data.config).toBeDefined();
      expect(result.data.config.name).toBe("Test Digital Menu");
      expect(result.data.menu).toBeDefined();
      expect(result.message).toBe("Public menu retrieved successfully");
      expect(
        mockPrismaService.digitalMenuConfig.findFirst,
      ).toHaveBeenCalledWith({
        where: { id: configId, isActive: true },
        include: expect.objectContaining({
          menu: expect.any(Object),
        }),
      });
    });

    it("should filter items by allergens when specified", async () => {
      const queryWithAllergens: PublicMenuQueryDto = {
        language: "es",
        filteredByAllergens: [1],
      };

      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(
        mockConfigWithSections,
      );
      mockPrismaService.menuScan.create.mockResolvedValue(mockScan);
      mockPrismaService.digitalMenuConfig.update.mockResolvedValue(
        mockConfigWithSections,
      );

      const result = await service.getPublicMenu(configId, queryWithAllergens);

      expect(result.success).toBe(true);
      expect(result.data.menu.sections).toBeDefined();
    });

    it("should throw NotFoundException if config not found or inactive", async () => {
      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(null);

      await expect(service.getPublicMenu(configId, query)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("registerScan", () => {
    const scanDto: RegisterScanDto = {
      digitalMenuId: configId,
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      referrer: "https://example.com",
      language: "es",
      interactionType: "scan",
    };

    it("should register scan successfully", async () => {
      mockPrismaService.menuScan.create.mockResolvedValue(mockScan);
      mockPrismaService.digitalMenuConfig.update.mockResolvedValue(
        mockDigitalMenuConfig,
      );

      const result = await service.registerScan(configId, scanDto);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.message).toBe("Scan registered successfully");
      expect(mockPrismaService.menuScan.create).toHaveBeenCalledWith({
        data: {
          digitalMenuId: configId,
          ...scanDto,
        },
      });
      expect(mockPrismaService.digitalMenuConfig.update).toHaveBeenCalledWith({
        where: { id: configId },
        data: {
          scanCount: { increment: 1 },
          lastScannedAt: expect.any(Date),
        },
      });
    });

    it("should register scan with filtered allergens", async () => {
      const scanWithAllergens: RegisterScanDto = {
        ...scanDto,
        filteredByAllergens: [1, 2, 3],
      };

      mockPrismaService.menuScan.create.mockResolvedValue({
        ...mockScan,
        filteredByAllergens: [1, 2, 3],
      });
      mockPrismaService.digitalMenuConfig.update.mockResolvedValue(
        mockDigitalMenuConfig,
      );

      const result = await service.registerScan(configId, scanWithAllergens);

      expect(result.success).toBe(true);
    });
  });

  describe("getAnalytics", () => {
    it("should retrieve analytics successfully", async () => {
      const scans = [
        {
          ...mockScan,
          ipAddress: "192.168.1.1",
          language: "es",
          interactionType: "scan",
        },
        {
          ...mockScan,
          ipAddress: "192.168.1.2",
          language: "en",
          interactionType: "filter",
        },
        {
          ...mockScan,
          ipAddress: "192.168.1.1",
          language: "es",
          interactionType: "scan",
        },
      ];

      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(
        mockDigitalMenuConfig,
      );
      mockPrismaService.menuScan.findMany.mockResolvedValue(scans);

      const result = await service.getAnalytics(configId, tenantId);

      expect(result.success).toBe(true);
      expect(result.data.summary.totalScans).toBe(3);
      expect(result.data.summary.uniqueScans).toBe(2);
      expect(result.data.scansByLanguage).toEqual({ es: 2, en: 1 });
      expect(result.data.scansByType).toEqual({ scan: 2, filter: 1 });
      expect(result.message).toBe("Analytics retrieved successfully");
      expect(mockPrismaService.menuScan.findMany).toHaveBeenCalledWith({
        where: { digitalMenuId: configId },
        orderBy: { scannedAt: "desc" },
        take: 1000,
      });
    });

    it("should calculate average scans per user correctly", async () => {
      const scans = [
        { ...mockScan, ipAddress: "192.168.1.1" },
        { ...mockScan, ipAddress: "192.168.1.1" },
        { ...mockScan, ipAddress: "192.168.1.2" },
      ];

      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(
        mockDigitalMenuConfig,
      );
      mockPrismaService.menuScan.findMany.mockResolvedValue(scans);

      const result = await service.getAnalytics(configId, tenantId);

      expect(result.data.summary.totalScans).toBe(3);
      expect(result.data.summary.uniqueScans).toBe(2);
      expect(result.data.summary.avgScansPerUser).toBe(1.5);
    });

    it("should throw NotFoundException if config not found", async () => {
      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(null);

      await expect(service.getAnalytics(configId, tenantId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should handle empty scans array", async () => {
      mockPrismaService.digitalMenuConfig.findFirst.mockResolvedValue(
        mockDigitalMenuConfig,
      );
      mockPrismaService.menuScan.findMany.mockResolvedValue([]);

      const result = await service.getAnalytics(configId, tenantId);

      expect(result.data.summary.totalScans).toBe(0);
      expect(result.data.summary.uniqueScans).toBe(0);
      expect(result.data.summary.avgScansPerUser).toBe(0);
    });
  });
});
