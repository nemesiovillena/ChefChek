import { Test, TestingModule } from "@nestjs/testing";
import { MenusController } from "./menus.controller";
import { MenusService } from "./menus.service";
import { CreateMenuDto } from "./dto/create-menu.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard } from "../../guards/module.guard";

describe("MenusController", () => {
  let controller: MenusController;
  let service: MenusService;

  const mockMenusService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    calculateMenuCost: jest.fn(),
    generateQRCode: jest.fn(),
  };

  const mockReq = {
    tenantId: "tenant-test-123",
    user: { id: "user-1", role: "ADMIN" },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MenusController],
      providers: [{ provide: MenusService, useValue: mockMenusService }],
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

    controller = module.get<MenusController>(MenusController);
    service = module.get<MenusService>(MenusService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a menu and return success response", async () => {
      const createDto: CreateMenuDto = {
        name: "Test Menu",
        description: "Test Description",
        portions: 4,
        sections: [
          {
            name: "Starters",
            order: 1,
            items: [{ recipeId: "recipe-1", price: 10 }],
          },
        ],
      };

      const mockMenu = {
        id: "menu-1",
        ...createDto,
        tenantId: mockReq.tenantId,
        totalCost: 8,
        totalPrice: 10,
        totalMargin: 2,
      };

      mockMenusService.create.mockResolvedValue(mockMenu);

      const result = await controller.create(mockReq, createDto);

      expect(mockMenusService.create).toHaveBeenCalledWith(
        mockReq.tenantId,
        createDto,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockMenu);
      expect(result.message).toBe("Menu created successfully");
    });
  });

  describe("findAll", () => {
    it("should return list of menus", async () => {
      const mockMenus = [
        { id: "menu-1", name: "Menu 1" },
        { id: "menu-2", name: "Menu 2" },
      ];

      mockMenusService.findAll.mockResolvedValue(mockMenus);

      const result = await controller.findAll(mockReq, {});

      expect(mockMenusService.findAll).toHaveBeenCalledWith(
        mockReq.tenantId,
        {},
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockMenus);
    });

    it("should filter menus by search term", async () => {
      const query = { search: "test" };
      mockMenusService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(mockReq, query);

      expect(mockMenusService.findAll).toHaveBeenCalledWith(
        mockReq.tenantId,
        query,
      );
      expect(result.success).toBe(true);
    });

    it("should filter menus by isActive status", async () => {
      const query = { isActive: true };
      const mockMenus = [{ id: "menu-1", name: "Active Menu" }];

      mockMenusService.findAll.mockResolvedValue(mockMenus);

      const result = await controller.findAll(mockReq, query);

      expect(mockMenusService.findAll).toHaveBeenCalledWith(
        mockReq.tenantId,
        query,
      );
      expect(result.data).toEqual(mockMenus);
    });
  });

  describe("findOne", () => {
    it("should return a menu by ID", async () => {
      const menuId = "menu-1";
      const mockMenu = { id: menuId, name: "Test Menu", sections: [] };

      mockMenusService.findOne.mockResolvedValue(mockMenu);

      const result = await controller.findOne(mockReq, menuId);

      expect(mockMenusService.findOne).toHaveBeenCalledWith(
        mockReq.tenantId,
        menuId,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockMenu);
    });
  });

  describe("update", () => {
    it("should update a menu", async () => {
      const menuId = "menu-1";
      const updateDto: Partial<CreateMenuDto> = { name: "Updated Menu" };
      const mockUpdated = { id: menuId, name: "Updated Menu", sections: [] };

      mockMenusService.update.mockResolvedValue(mockUpdated);

      const result = await controller.update(mockReq, menuId, updateDto);

      expect(mockMenusService.update).toHaveBeenCalledWith(
        mockReq.tenantId,
        menuId,
        updateDto,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdated);
    });

    it("should update menu with new sections", async () => {
      const menuId = "menu-1";
      const updateDto: Partial<CreateMenuDto> = {
        sections: [
          {
            name: "Main Course",
            order: 1,
            items: [{ recipeId: "recipe-2", price: 20 }],
          },
        ],
      };

      const mockUpdated = {
        id: menuId,
        name: "Test Menu",
        sections: updateDto.sections,
      };

      mockMenusService.update.mockResolvedValue(mockUpdated);

      const result = await controller.update(mockReq, menuId, updateDto);

      expect(mockMenusService.update).toHaveBeenCalledWith(
        mockReq.tenantId,
        menuId,
        updateDto,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("remove", () => {
    it("should delete a menu", async () => {
      const menuId = "menu-1";

      mockMenusService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(mockReq, menuId);

      expect(mockMenusService.remove).toHaveBeenCalledWith(
        mockReq.tenantId,
        menuId,
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe("Menu deleted successfully");
    });
  });

  describe("calculateCost", () => {
    it("should calculate menu cost with breakdown", async () => {
      const menuId = "menu-1";
      const mockCostBreakdown = {
        totalCost: 100,
        totalPrice: 150,
        totalMargin: 50,
        averageMarginPercentage: 33.33,
        costPerPortion: 25,
        pricePerPortion: 37.5,
      };

      mockMenusService.calculateMenuCost.mockResolvedValue(mockCostBreakdown);

      const result = await controller.calculateCost(mockReq, menuId);

      expect(mockMenusService.calculateMenuCost).toHaveBeenCalledWith(
        mockReq.tenantId,
        menuId,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCostBreakdown);
    });
  });

  describe("generateQRCode", () => {
    it("should generate QR code for menu", async () => {
      const menuId = "menu-1";
      const mockQRData = {
        qrCode:
          "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=http://localhost:3000/menu/menu-1",
        url: "http://localhost:3000/menu/menu-1",
      };

      mockMenusService.generateQRCode.mockResolvedValue(mockQRData);

      const result = await controller.generateQRCode(mockReq, menuId);

      expect(mockMenusService.generateQRCode).toHaveBeenCalledWith(
        mockReq.tenantId,
        menuId,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockQRData);
    });
  });
});
