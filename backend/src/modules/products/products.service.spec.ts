import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { ProductsService } from "./products.service";
import { PrismaService } from "../../common/services/prisma.service";

describe("ProductsService", () => {
  let service: ProductsService;
  let prismaService: any;

  const mockPrismaService = {
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    supplier: {
      findMany: jest.fn(),
    },
    recipeIngredient: {
      findMany: jest.fn(),
    },
  };

  const tenantId = "tenant-123";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prismaService = mockPrismaService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a product successfully", async () => {
      const createDto = {
        name: "Tomate",
        description: "Tomate fresco",
        category: "cat-1",
        supplier: "supp-1",
        purchaseUnit: "Caja 10kg",
        storageUnit: "Kilogramos",
        recipeUnit: "Gramos",
        purchasePrice: 15.5,
        netPrice: 18.0,
        profitMargin: 10,
        wastePercentage: 5,
        yieldFactor: 0.95,
        allergens: [1, 2],
      };

      const mockProduct = {
        id: "prod-1",
        tenantId,
        name: "Tomate",
        description: "Tomate fresco",
        categoryId: "cat-1",
        supplierId: "supp-1",
        purchaseUnit: "Caja 10kg",
        storageUnit: "Kilogramos",
        recipeUnit: "Gramos",
        purchasePrice: 15.5,
        netPrice: 18.14,
        profitMargin: 10,
        wastePercentage: 5,
        yieldFactor: 0.95,
        allergens: [1, 2],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.product.create.mockResolvedValue(mockProduct);

      const result = await service.create(createDto, tenantId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProduct);
      expect(result.message).toBe("Product created successfully");
      expect(prismaService.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId,
            name: "Tomate",
            categoryId: "cat-1",
            supplierId: "supp-1",
            purchasePrice: 15.5,
          }),
        }),
      );
    });

    it("should create product with minimal required fields", async () => {
      const createDto = {
        name: "Cebolla",
        category: "cat-2",
        purchaseUnit: "Saco 25kg",
        storageUnit: "Kilogramos",
        recipeUnit: "Gramos",
        purchasePrice: 20.0,
      };

      const mockProduct = {
        id: "prod-2",
        tenantId,
        name: "Cebolla",
        categoryId: "cat-2",
        purchaseUnit: "Saco 25kg",
        storageUnit: "Kilogramos",
        recipeUnit: "Gramos",
        purchasePrice: 20.0,
        netPrice: 20.0,
        profitMargin: 0,
        wastePercentage: 0,
        yieldFactor: 1.0,
        allergens: [],
        isActive: true,
      };

      prismaService.product.create.mockResolvedValue(mockProduct);

      const result = await service.create(createDto, tenantId);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Cebolla");
    });
  });

  describe("findAll", () => {
    it("should return paginated products list", async () => {
      const mockProducts = [
        {
          id: "prod-1",
          name: "Tomate",
          categoryId: "cat-1",
          supplierId: "supp-1",
          purchaseUnit: "Caja 10kg",
          purchasePrice: 15.5,
          netPrice: 18.14,
          isActive: true,
          allergens: [],
        },
        {
          id: "prod-2",
          name: "Cebolla",
          categoryId: "cat-2",
          supplierId: null,
          purchaseUnit: "Saco 25kg",
          purchasePrice: 20.0,
          netPrice: 20.0,
          isActive: true,
          allergens: [],
        },
      ];

      prismaService.product.findMany.mockResolvedValue(mockProducts);
      prismaService.product.count.mockResolvedValue(2);

      const query = { page: 1, limit: 20 };
      const result = await service.findAll(query, tenantId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(1);
    });

    it("should filter by category", async () => {
      prismaService.product.findMany.mockResolvedValue([]);
      prismaService.product.count.mockResolvedValue(0);

      const query = { category: "cat-1" };
      await service.findAll(query, tenantId);

      expect(prismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categoryId: "cat-1",
          }),
        }),
      );
    });

    it("should filter by supplier", async () => {
      prismaService.product.findMany.mockResolvedValue([]);
      prismaService.product.count.mockResolvedValue(0);

      const query = { supplier: "supp-1" };
      await service.findAll(query, tenantId);

      expect(prismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            supplierId: "supp-1",
          }),
        }),
      );
    });

    it("should filter by search term", async () => {
      prismaService.product.findMany.mockResolvedValue([]);
      prismaService.product.count.mockResolvedValue(0);

      const query = { search: "Tomate" };
      await service.findAll(query, tenantId);

      expect(prismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: "Tomate", mode: "insensitive" } },
              { description: { contains: "Tomate", mode: "insensitive" } },
            ],
          }),
        }),
      );
    });

    it("should filter by isActive status", async () => {
      prismaService.product.findMany.mockResolvedValue([]);
      prismaService.product.count.mockResolvedValue(0);

      const query = { isActive: true };
      await service.findAll(query, tenantId);

      expect(prismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        }),
      );
    });

    it("should sort by specified field and order", async () => {
      prismaService.product.findMany.mockResolvedValue([]);
      prismaService.product.count.mockResolvedValue(0);

      const query = { sortBy: "name", sortOrder: "desc" as const };
      await service.findAll(query, tenantId);

      expect(prismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: "desc" },
        }),
      );
    });
  });

  describe("findOne", () => {
    it("should return a single product by id", async () => {
      const mockProduct = {
        id: "prod-1",
        tenantId,
        name: "Tomate",
        description: "Tomate fresco",
        categoryId: "cat-1",
        supplierId: "supp-1",
        purchaseUnit: "Caja 10kg",
        storageUnit: "Kilogramos",
        recipeUnit: "Gramos",
        purchasePrice: 15.5,
        netPrice: 18.14,
        profitMargin: 10,
        wastePercentage: 5,
        yieldFactor: 0.95,
        allergens: [],
        isActive: true,
      };

      prismaService.product.findFirst.mockResolvedValue(mockProduct);

      const result = await service.findOne("prod-1", tenantId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProduct);
      expect(result.message).toBe("Product retrieved successfully");
    });

    it("should throw NotFoundException when product not found", async () => {
      prismaService.product.findFirst.mockResolvedValue(null);

      await expect(service.findOne("nonexistent", tenantId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should only return product belonging to tenant", async () => {
      const mockProduct = {
        id: "prod-1",
        tenantId,
        name: "Tomate",
      };

      prismaService.product.findFirst.mockResolvedValue(mockProduct);

      await service.findOne("prod-1", tenantId);

      expect(prismaService.product.findFirst).toHaveBeenCalledWith({
        where: {
          id: "prod-1",
          tenantId,
        },
      });
    });
  });

  describe("update", () => {
    it("should update product successfully", async () => {
      const existingProduct = {
        id: "prod-1",
        tenantId,
        name: "Tomate",
        purchasePrice: 15.5,
        netPrice: 18.14,
        profitMargin: 10,
        wastePercentage: 5,
        yieldFactor: 0.95,
      };

      const updateDto = {
        name: "Tomate Cherry",
        purchasePrice: 18.0,
      };

      const updatedProduct = {
        ...existingProduct,
        name: "Tomate Cherry",
        purchasePrice: 18.0,
        netPrice: 21.06,
      };

      prismaService.product.findFirst.mockResolvedValue(existingProduct);
      prismaService.product.update.mockResolvedValue(updatedProduct);

      const result = await service.update("prod-1", updateDto, tenantId);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Tomate Cherry");
      expect(result.message).toBe("Product updated successfully");
    });

    it("should throw NotFoundException when updating nonexistent product", async () => {
      prismaService.product.findFirst.mockResolvedValue(null);

      await expect(
        service.update("nonexistent", { name: "Test" }, tenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it("should recalculate netPrice when purchasePrice changes", async () => {
      const existingProduct = {
        id: "prod-1",
        tenantId,
        purchasePrice: 15.5,
        wastePercentage: 5,
        profitMargin: 10,
      };

      const updateDto = { purchasePrice: 20.0 };

      prismaService.product.findFirst.mockResolvedValue(existingProduct);
      prismaService.product.update.mockResolvedValue({
        ...existingProduct,
        purchasePrice: 20.0,
        netPrice: 23.4,
      });

      await service.update("prod-1", updateDto, tenantId);

      expect(prismaService.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            netPrice: expect.any(Number),
          }),
        }),
      );
    });

    it("should map category to categoryId", async () => {
      const existingProduct = {
        id: "prod-1",
        tenantId,
        purchasePrice: 10,
        wastePercentage: 0,
        profitMargin: 0,
      };

      const updateDto = { category: "cat-5" };

      prismaService.product.findFirst.mockResolvedValue(existingProduct);
      prismaService.product.update.mockResolvedValue({});

      await service.update("prod-1", updateDto, tenantId);

      expect(prismaService.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categoryId: "cat-5",
          }),
        }),
      );
    });
  });

  describe("remove", () => {
    it("should delete product successfully", async () => {
      const mockProduct = {
        id: "prod-1",
        tenantId,
        name: "Tomate",
      };

      prismaService.product.findFirst.mockResolvedValue(mockProduct);
      prismaService.product.delete.mockResolvedValue(mockProduct);

      const result = await service.remove("prod-1", tenantId);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.message).toBe("Product deleted successfully");
      expect(prismaService.product.delete).toHaveBeenCalledWith({
        where: { id: "prod-1" },
      });
    });

    it("should throw NotFoundException when deleting nonexistent product", async () => {
      prismaService.product.findFirst.mockResolvedValue(null);

      await expect(service.remove("nonexistent", tenantId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("calculateProductCost", () => {
    it("should calculate product cost correctly", async () => {
      const mockProduct = {
        id: "prod-1",
        tenantId,
        name: "Tomate",
        purchaseUnit: "Caja 10kg",
        storageUnit: "Kilogramos",
        recipeUnit: "Gramos",
        purchasePrice: 15.5,
        netPrice: 18.14,
        wastePercentage: 5,
        yieldFactor: 0.95,
      };

      prismaService.product.findFirst.mockResolvedValue(mockProduct);

      const result = await service.calculateProductCost("prod-1", tenantId);

      expect(result.success).toBe(true);
      expect(result.data.productId).toBe("prod-1");
      expect(result.data.productName).toBe("Tomate");
      expect(result.data.costPerPurchaseUnit).toBe(15.5);
      expect(result.data.ucToUaFactor).toBe(10); // Caja 10kg -> Kilogramos
      expect(result.data.uaToUrFactor).toBe(1000); // Kilogramos -> Gramos
    });

    it("should throw NotFoundException for nonexistent product", async () => {
      prismaService.product.findFirst.mockResolvedValue(null);

      await expect(
        service.calculateProductCost("nonexistent", tenantId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getCategories", () => {
    it("should return distinct categories for tenant", async () => {
      const mockCategories = [
        { categoryId: "cat-1" },
        { categoryId: "cat-2" },
        { categoryId: "cat-3" },
      ];

      prismaService.product.findMany.mockResolvedValue(mockCategories);

      const result = await service.getCategories(tenantId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(["cat-1", "cat-2", "cat-3"]);
      expect(result.message).toBe("Categories retrieved successfully");
    });

    it("should filter out null categories", async () => {
      const mockCategories = [
        { categoryId: "cat-1" },
        { categoryId: null },
        { categoryId: "cat-2" },
      ];

      prismaService.product.findMany.mockResolvedValue(mockCategories);

      const result = await service.getCategories(tenantId);

      expect(result.data).toEqual(["cat-1", "cat-2"]);
    });
  });

  describe("getSuppliers", () => {
    it("should return distinct suppliers for tenant", async () => {
      const mockSuppliers = [
        { supplierId: "supp-1" },
        { supplierId: "supp-2" },
      ];

      prismaService.product.findMany.mockResolvedValue(mockSuppliers);

      const result = await service.getSuppliers(tenantId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(["supp-1", "supp-2"]);
      expect(result.message).toBe("Suppliers retrieved successfully");
    });

    it("should filter out null suppliers", async () => {
      const mockSuppliers = [{ supplierId: "supp-1" }, { supplierId: null }];

      prismaService.product.findMany.mockResolvedValue(mockSuppliers);

      const result = await service.getSuppliers(tenantId);

      expect(result.data).toEqual(["supp-1"]);
    });
  });
});
