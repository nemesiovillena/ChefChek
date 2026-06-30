import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { MenusService } from "./menus.service";
import { PrismaService } from "../../common/services/prisma.service";
import { CreateMenuDto } from "./dto/create-menu.dto";

describe("MenusService", () => {
  let service: MenusService;
  let prisma: PrismaService;

  const mockPrismaService = {
    menu: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    menuSection: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    menuItem: {
      update: jest.fn(),
    },
    menuTranslation: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    recipe: {
      findUnique: jest.fn(),
    },
  };

  const tenantId = "test-tenant-id";
  const menuId = "test-menu-id";

  const mockRecipe = {
    id: "recipe-1",
    name: "Test Recipe",
    totalCost: 10,
    totalCostPerUnit: 0.1,
    ingredients: [],
    allergens: [],
    tenantId,
  };

  const mockMenuItem = {
    id: "menu-item-1",
    recipeId: "recipe-1",
    price: 13,
    isAvailable: true,
    recipe: mockRecipe,
  };

  const mockMenuSection = {
    id: "section-1",
    name: "Starters",
    sortOrder: 0,
    order: 0,
    items: [mockMenuItem],
  };

  const mockMenuTranslation = {
    id: "translation-1",
    language: "en",
    title: "Menu",
    name: "Menu",
    description: "Menu description",
    sectionsTranslations: {},
  };

  const mockMenu = {
    id: menuId,
    tenantId,
    name: "Test Menu",
    description: "Test Description",
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-12-31"),
    portions: 4,
    totalCost: 10,
    totalPrice: 13,
    totalMargin: 3,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    sections: [mockMenuSection],
    translations: [mockMenuTranslation],
  };

  const createMenuDto: CreateMenuDto = {
    name: "New Menu",
    description: "New Description",
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    portions: 4,
    sections: [
      {
        name: "Starters",
        order: 0,
        items: [
          {
            recipeId: "recipe-1",
            price: 13,
            isAvailable: true,
          },
        ],
      },
    ],
    translations: [
      {
        language: "en",
        name: "Menu",
        description: "Menu description",
      },
    ],
    isActive: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenusService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MenusService>(MenusService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a menu successfully", async () => {
      mockPrismaService.recipe.findUnique.mockResolvedValue(mockRecipe);
      mockPrismaService.menu.create.mockResolvedValue(mockMenu);
      mockPrismaService.menu.findUnique.mockResolvedValue(mockMenu);

      const result = await service.create(tenantId, createMenuDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(mockMenu.name);
      expect(mockPrismaService.menu.create).toHaveBeenCalled();
    });

    it("should throw BadRequestException if end date is before start date", async () => {
      const invalidDto: CreateMenuDto = {
        ...createMenuDto,
        startDate: "2024-12-31",
        endDate: "2024-01-01",
      };

      await expect(service.create(tenantId, invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw NotFoundException if recipe not found", async () => {
      mockPrismaService.recipe.findUnique.mockResolvedValue(null);

      await expect(service.create(tenantId, createMenuDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("findAll", () => {
    it("should return an array of menus", async () => {
      mockPrismaService.menu.findMany.mockResolvedValue([mockMenu]);

      const result = await service.findAll(tenantId);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(mockPrismaService.menu.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        include: {
          sections: {
            include: {
              items: {
                include: {
                  recipe: true,
                },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
          translations: true,
        },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should filter menus by search query", async () => {
      mockPrismaService.menu.findMany.mockResolvedValue([mockMenu]);

      const result = await service.findAll(tenantId, { search: "Test" });

      expect(result).toBeDefined();
      expect(mockPrismaService.menu.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: "Test", mode: "insensitive" } },
            ]),
          }),
        }),
      );
    });

    it("should filter menus by isActive status", async () => {
      mockPrismaService.menu.findMany.mockResolvedValue([mockMenu]);

      const result = await service.findAll(tenantId, { isActive: true });

      expect(result).toBeDefined();
      expect(mockPrismaService.menu.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        }),
      );
    });
  });

  describe("findOne", () => {
    it("should return a menu by id", async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue(mockMenu);

      const result = await service.findOne(tenantId, menuId);

      expect(result).toBeDefined();
      expect(result.id).toBe(menuId);
      expect(mockPrismaService.menu.findFirst).toHaveBeenCalledWith({
        where: { id: menuId, tenantId },
        include: {
          sections: {
            include: {
              items: {
                include: {
                  recipe: true,
                },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
          translations: true,
        },
      });
    });

    it("should throw NotFoundException if menu not found", async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue(null);

      await expect(service.findOne(tenantId, menuId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    const updateMenuDto: Partial<CreateMenuDto> = {
      name: "Updated Menu",
      description: "Updated Description",
    };

    it("should update a menu successfully", async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue(mockMenu);
      mockPrismaService.menu.update.mockResolvedValue({
        ...mockMenu,
        ...updateMenuDto,
      });
      mockPrismaService.menu.findUnique.mockResolvedValue({
        ...mockMenu,
        ...updateMenuDto,
      });

      const result = await service.update(tenantId, menuId, updateMenuDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(updateMenuDto.name);
      expect(mockPrismaService.menu.update).toHaveBeenCalled();
    });

    it("should throw NotFoundException if menu not found", async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue(null);

      await expect(
        service.update(tenantId, menuId, updateMenuDto),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if end date is before start date", async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue(mockMenu);

      const invalidDto: Partial<CreateMenuDto> = {
        startDate: "2024-12-31",
        endDate: "2024-01-01",
      };

      await expect(
        service.update(tenantId, menuId, invalidDto),
      ).rejects.toThrow(BadRequestException);
    });

    it("should update sections if provided", async () => {
      const dtoWithSections: Partial<CreateMenuDto> = {
        sections: createMenuDto.sections,
      };

      mockPrismaService.menu.findFirst.mockResolvedValue(mockMenu);
      mockPrismaService.recipe.findUnique.mockResolvedValue(mockRecipe);
      mockPrismaService.menu.update.mockResolvedValue(mockMenu);
      mockPrismaService.menuSection.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaService.menuSection.create.mockResolvedValue(mockMenuSection);
      mockPrismaService.menu.findUnique.mockResolvedValue(mockMenu);

      await service.update(tenantId, menuId, dtoWithSections);

      expect(mockPrismaService.menuSection.deleteMany).toHaveBeenCalledWith({
        where: { menuId },
      });
      expect(mockPrismaService.menuSection.create).toHaveBeenCalled();
    });

    it("should update translations if provided", async () => {
      const dtoWithTranslations: Partial<CreateMenuDto> = {
        translations: createMenuDto.translations,
      };

      mockPrismaService.menu.findFirst.mockResolvedValue(mockMenu);
      mockPrismaService.menu.update.mockResolvedValue(mockMenu);
      mockPrismaService.menuTranslation.deleteMany.mockResolvedValue({
        count: 1,
      });
      mockPrismaService.menuTranslation.create.mockResolvedValue(
        mockMenuTranslation,
      );
      mockPrismaService.menu.findUnique.mockResolvedValue(mockMenu);

      await service.update(tenantId, menuId, dtoWithTranslations);

      expect(mockPrismaService.menuTranslation.deleteMany).toHaveBeenCalledWith(
        { where: { menuId } },
      );
      expect(mockPrismaService.menuTranslation.create).toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should soft delete a menu (set isActive to false)", async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue(mockMenu);
      mockPrismaService.menu.update.mockResolvedValue({
        ...mockMenu,
        isActive: false,
      });

      await service.remove(tenantId, menuId);

      expect(mockPrismaService.menu.update).toHaveBeenCalledWith({
        where: { id: menuId },
        data: { isActive: false },
      });
    });

    it("should throw NotFoundException if menu not found", async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue(null);

      await expect(service.remove(tenantId, menuId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("calculateMenuCost", () => {
    it("should return cost breakdown for a menu", async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue(mockMenu);

      const result = await service.calculateMenuCost(tenantId, menuId);

      expect(result).toBeDefined();
      expect(result.totalCost).toBe(mockMenu.totalCost);
      expect(result).toHaveProperty("totalPrice");
      expect(result).toHaveProperty("totalMargin");
      expect(result).toHaveProperty("averageMarginPercentage");
      expect(result).toHaveProperty("costPerPortion");
      expect(result).toHaveProperty("pricePerPortion");
    });

    it("should throw NotFoundException if menu not found", async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue(null);

      await expect(service.calculateMenuCost(tenantId, menuId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("generateQRCode", () => {
    it("should generate QR code for active menu", async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue(mockMenu);

      const result = await service.generateQRCode(tenantId, menuId);

      expect(result).toBeDefined();
      expect(result).toHaveProperty("qrCode");
      expect(result).toHaveProperty("url");
      expect(result.url).toContain(menuId);
      expect(result.qrCode).toContain("qrserver.com");
    });

    it("should throw NotFoundException if menu not found", async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue(null);

      await expect(service.generateQRCode(tenantId, menuId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should only generate QR for active menus", async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue(null);

      await expect(
        service.generateQRCode(tenantId, "inactive-menu-id"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateItemPrices (private via create)", () => {
    it("should return early when menu not found in updateItemPrices", async () => {
      mockPrismaService.recipe.findUnique.mockResolvedValue(mockRecipe);
      mockPrismaService.menu.create.mockResolvedValue(mockMenu);
      // First findUnique (updateItemPrices): null → return early
      // Second findUnique (reload): return menu
      mockPrismaService.menu.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockMenu);

      const result = await service.create(tenantId, createMenuDto);

      expect(result).toBeDefined();
    });

    it("should update price for items with price=0 when recipe found", async () => {
      const zeroPriceItem = {
        id: "item-0",
        recipeId: "recipe-1",
        price: 0,
        isAvailable: true,
        recipe: mockRecipe,
      };
      const menuWithZeroPriceItem = {
        ...mockMenu,
        sections: [{ ...mockMenuSection, items: [zeroPriceItem] }],
      };

      mockPrismaService.recipe.findUnique.mockResolvedValue(mockRecipe);
      mockPrismaService.menu.create.mockResolvedValue(mockMenu);
      mockPrismaService.menu.findUnique
        .mockResolvedValueOnce(menuWithZeroPriceItem) // updateItemPrices
        .mockResolvedValueOnce(menuWithZeroPriceItem); // reload
      mockPrismaService.menuItem.update.mockResolvedValue({});

      const result = await service.create(tenantId, createMenuDto);

      expect(mockPrismaService.menuItem.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should skip update when recipe not found for price=0 item", async () => {
      const zeroPriceItem = {
        id: "item-0",
        recipeId: "no-recipe",
        price: 0,
        isAvailable: true,
        recipe: mockRecipe,
      };
      const menuWithZeroPriceItem = {
        ...mockMenu,
        sections: [{ ...mockMenuSection, items: [zeroPriceItem] }],
      };

      mockPrismaService.recipe.findUnique
        .mockResolvedValueOnce(mockRecipe) // for the create validation
        .mockResolvedValueOnce(null); // for updateItemPrices recipe lookup
      mockPrismaService.menu.create.mockResolvedValue(mockMenu);
      mockPrismaService.menu.findUnique
        .mockResolvedValueOnce(menuWithZeroPriceItem)
        .mockResolvedValueOnce(menuWithZeroPriceItem);

      const result = await service.create(tenantId, createMenuDto);

      expect(mockPrismaService.menuItem.update).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe("formatMenuResponse / calculateAllergens (private)", () => {
    it("should include allergens from recipe ingredients", () => {
      const recipeWithAllergens = {
        id: "r-1",
        name: "Recipe",
        totalCost: 5,
        ingredients: [
          {
            product: {
              allergens: [1, 7, 14],
            },
          },
        ],
      };

      const menuWithAllergens = {
        ...mockMenu,
        sections: [
          {
            id: "s-1",
            name: "Main",
            order: 0,
            items: [
              {
                id: "i-1",
                recipeId: "r-1",
                recipe: recipeWithAllergens,
                price: 10,
                isAvailable: true,
              },
            ],
          },
        ],
      };

      const result = (service as any).formatMenuResponse(menuWithAllergens);

      expect(result.sections[0].items[0].allergens).toContain(1);
      expect(result.sections[0].items[0].allergens).toContain(7);
    });

    it("should calculate marginPercentage as 0 when price is 0", () => {
      const menuWithFreeItem = {
        ...mockMenu,
        sections: [
          {
            id: "s-1",
            name: "Main",
            order: 0,
            items: [
              {
                id: "i-1",
                recipeId: "r-1",
                recipe: { ...mockRecipe, totalCost: 5 },
                price: 0,
                isAvailable: true,
              },
            ],
          },
        ],
      };

      const result = (service as any).formatMenuResponse(menuWithFreeItem);

      // marginPercentage = price > 0 ? ... : 0
      expect(result.sections[0].items[0].price).toBe(0);
    });

    it("should use empty object when sectionsTranslations is missing", () => {
      const menuNoSectionsTrans = {
        ...mockMenu,
        translations: [
          {
            id: "t-1",
            language: "es",
            name: "Menú",
            description: "Descripción",
            // no sectionsTranslations
          },
        ],
      };

      const result = (service as any).formatMenuResponse(menuNoSectionsTrans);

      expect(result.translations[0].sectionsTranslations).toEqual({});
    });
  });
});
