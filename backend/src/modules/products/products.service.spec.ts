import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { ProductsService } from "./products.service";
import { PrismaService } from "../../common/services/prisma.service";
import { ProductSupplierOffersService } from "./product-supplier-offers.service";

describe("ProductsService", () => {
  let service: ProductsService;
  let prismaService: any;
  let productSupplierOffersService: jest.Mocked<ProductSupplierOffersService>;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
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
    stock: {
      create: jest.fn(),
      update: jest.fn(),
    },
    recipeIngredient: {
      findMany: jest.fn(),
    },
    productPriceHistory: {
      create: jest.fn(),
    },
    productSupplierOffer: {
      findFirst: jest.fn(),
    },
  };
  (mockPrismaService as any).$transaction = jest.fn((fn: any) =>
    fn(mockPrismaService),
  );

  const tenantId = "tenant-123";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ProductSupplierOffersService,
          useValue: {
            upsertOffer: jest.fn(),
            setPreferred: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prismaService = mockPrismaService;
    productSupplierOffersService = module.get(ProductSupplierOffersService);
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
        purchaseFormat: "Caja 10kg",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 10,
        unitSize: 10,
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
        purchaseFormat: "Caja 10kg",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 10,
        unitSize: 10,
        purchasePrice: 15.5,
        netPrice: 18.14,
        profitMargin: 10,
        wastePercentage: 5,
        yieldFactor: 0.95,
        allergens: [1, 2],
        isActive: true,
        purchaseFormats: [],
        nutritionalInfo: null,
        category: { id: "cat-1", name: "Alimentación" },
        supplier: { id: "supp-1", name: "Proveedor A" },
        stocks: [],
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
        purchaseFormat: "Saco 25kg",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 25,
        unitSize: 25,
        purchasePrice: 20.0,
      };

      const mockProduct = {
        id: "prod-2",
        tenantId,
        name: "Cebolla",
        categoryId: "cat-2",
        purchaseFormat: "Saco 25kg",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 25,
        unitSize: 25,
        purchasePrice: 20.0,
        netPrice: 20.0,
        profitMargin: 0,
        wastePercentage: 0,
        yieldFactor: 1.0,
        allergens: [],
        isActive: true,
        purchaseFormats: [],
        nutritionalInfo: null,
        category: null,
        supplier: null,
        stocks: [],
      };

      prismaService.product.create.mockResolvedValue(mockProduct);

      const result = await service.create(createDto, tenantId);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Cebolla");
    });

    it("should create product with nutritionalInfo", async () => {
      const createDto = {
        name: "Aceite",
        category: "cat-1",
        purchaseFormat: "l",
        referenceUnit: "L",
        unitsPerFormat: 1,
        referenceUnitSize: 1,
        unitSize: 1,
        purchasePrice: 5.0,
        nutritionalInfo: { fat: 100, saturatedFat: 14, energyKcal: 884 },
      };

      const mockProduct = {
        id: "prod-3",
        tenantId,
        name: "Aceite",
        purchasePrice: 5.0,
        purchaseFormats: [],
        nutritionalInfo: {
          id: "ni-1",
          fat: 100,
          saturatedFat: 14,
          energyKcal: 884,
        },
        stocks: [],
      };

      prismaService.product.create.mockResolvedValue(mockProduct);

      const result = await service.create(createDto, tenantId);

      expect(result.success).toBe(true);
      expect(prismaService.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nutritionalInfo: {
              create: { fat: 100, saturatedFat: 14, energyKcal: 884 },
            },
          }),
        }),
      );
    });

    it("should create stock record when minimumStock or maximumStock provided", async () => {
      const createDto = {
        name: "Harina",
        category: "cat-1",
        purchaseFormat: "kg",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 1,
        unitSize: 1,
        purchasePrice: 2.0,
        minimumStock: 5,
        maximumStock: 50,
      };

      const mockProduct = {
        id: "prod-4",
        tenantId,
        name: "Harina",
        purchasePrice: 2.0,
        purchaseFormats: [],
        nutritionalInfo: null,
        category: null,
        supplier: null,
        stocks: [],
      };

      prismaService.product.create.mockResolvedValue(mockProduct);
      prismaService.stock.create.mockResolvedValue({ id: "stock-1" });

      const result = await service.create(createDto, tenantId);

      expect(result.success).toBe(true);
      expect(prismaService.stock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: "prod-4",
          minimumStock: 5,
          maximumStock: 50,
          quantity: 0,
        }),
      });
    });

    it("should calculate unitSize from unitsPerFormat and referenceUnitSize on create", async () => {
      const createDto = {
        name: "Test Product",
        category: "cat-1",
        purchaseFormat: "Pack",
        referenceUnit: "kg",
        unitsPerFormat: 6,
        referenceUnitSize: 1.5,
        purchasePrice: 20.0,
      };

      const mockProduct = {
        id: "prod-5",
        tenantId,
        name: "Test Product",
        unitsPerFormat: 6,
        referenceUnitSize: 1.5,
        unitSize: 9,
        purchasePrice: 20.0,
        netPrice: 20.0,
        profitMargin: 0,
        wastePercentage: 0,
        yieldFactor: 1.0,
        allergens: [],
        isActive: true,
        purchaseFormats: [],
        nutritionalInfo: null,
        category: null,
        supplier: null,
        stocks: [],
      };

      prismaService.product.create.mockResolvedValue(mockProduct);

      const result = await service.create(createDto, tenantId);

      expect(result.success).toBe(true);
      expect(result.data.unitSize).toBe(9);
      expect(prismaService.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unitsPerFormat: 6,
            referenceUnitSize: 1.5,
            unitSize: 9,
          }),
        }),
      );
    });
  });

  describe("findAll", () => {
    // findAll ahora resuelve ids+total con $queryRaw (SQL crudo parametrizado,
    // ver products.service.ts) y solo hidrata los productos vía product.findMany
    // por id — los filtros (categoría/proveedor/búsqueda/activo) viven en el
    // WHERE de esa consulta cruda, no en el `where` de Prisma ORM.
    function mockIdsAndCount(ids: string[], total: number) {
      prismaService.$queryRaw
        .mockResolvedValueOnce(ids.map((id) => ({ id })))
        .mockResolvedValueOnce([{ count: BigInt(total) }]);
    }

    it("should return paginated products list", async () => {
      const mockProducts = [
        {
          id: "prod-1",
          name: "Tomate",
          categoryId: "cat-1",
          supplierId: "supp-1",
          purchaseFormat: "Caja 10kg",
          referenceUnit: "kg",
          unitsPerFormat: 1,
          referenceUnitSize: 10,
          unitSize: 10,
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
          purchaseFormat: "Saco 25kg",
          referenceUnit: "kg",
          unitsPerFormat: 1,
          referenceUnitSize: 25,
          unitSize: 25,
          purchasePrice: 20.0,
          netPrice: 20.0,
          isActive: true,
          allergens: [],
        },
      ];

      mockIdsAndCount(["prod-1", "prod-2"], 2);
      prismaService.product.findMany.mockResolvedValue(mockProducts);

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
      mockIdsAndCount([], 0);
      prismaService.product.findMany.mockResolvedValue([]);

      const query = { category: "cat-1" };
      await service.findAll(query, tenantId);

      const idsQuery = prismaService.$queryRaw.mock.calls[0][0];
      expect(idsQuery.sql).toContain('p."categoryId" = ANY');
      expect(idsQuery.values).toContainEqual(["cat-1"]);
    });

    it("should filter by supplier", async () => {
      mockIdsAndCount([], 0);
      prismaService.product.findMany.mockResolvedValue([]);

      const query = { supplier: "supp-1" };
      await service.findAll(query, tenantId);

      const idsQuery = prismaService.$queryRaw.mock.calls[0][0];
      expect(idsQuery.sql).toContain('p."supplierId" = ');
      expect(idsQuery.values).toContain("supp-1");
    });

    it("should filter by search term including barcode and brand", async () => {
      mockIdsAndCount([], 0);
      prismaService.product.findMany.mockResolvedValue([]);

      const query = { search: "Tomate" };
      await service.findAll(query, tenantId);

      const idsQuery = prismaService.$queryRaw.mock.calls[0][0];
      expect(idsQuery.sql).toContain("p.name ILIKE");
      expect(idsQuery.sql).toContain("p.barcode ILIKE");
      expect(idsQuery.sql).toContain("p.brand ILIKE");
      expect(idsQuery.values).toContain("%Tomate%");
    });

    it("should filter by isActive status", async () => {
      mockIdsAndCount([], 0);
      prismaService.product.findMany.mockResolvedValue([]);

      const query = { isActive: true };
      await service.findAll(query, tenantId);

      const idsQuery = prismaService.$queryRaw.mock.calls[0][0];
      expect(idsQuery.sql).toContain('p."isActive" = ');
      expect(idsQuery.values).toContain(true);
    });

    it("should sort by specified field and order", async () => {
      mockIdsAndCount([], 0);
      prismaService.product.findMany.mockResolvedValue([]);

      const query = { sortBy: "name", sortOrder: "desc" as const };
      await service.findAll(query, tenantId);

      const idsQuery = prismaService.$queryRaw.mock.calls[0][0];
      expect(idsQuery.sql).toContain("ORDER BY p.name DESC");
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
        purchaseFormat: "Caja 10kg",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 10,
        unitSize: 10,
        purchasePrice: 15.5,
        netPrice: 18.14,
        profitMargin: 10,
        wastePercentage: 5,
        yieldFactor: 0.95,
        allergens: [],
        isActive: true,
        purchaseFormats: [],
        nutritionalInfo: null,
        category: null,
        supplier: null,
        stocks: [],
      };

      prismaService.product.findFirst.mockResolvedValue(mockProduct);

      const result = await service.findOne("prod-1", tenantId);

      expect(result.success).toBe(true);
      // findOne deriva lastPurchaseDate/purchaseDateSource de albaranLines +
      // manualPurchaseDate (ambos ausentes aquí -> null/null).
      expect(result.data).toEqual({
        ...mockProduct,
        lastPurchaseDate: null,
        purchaseDateSource: null,
      });
      expect(result.message).toBe("Product retrieved successfully");
    });

    it("should throw NotFoundException when product not found", async () => {
      prismaService.product.findFirst.mockResolvedValue(null);

      await expect(service.findOne("nonexistent", tenantId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should only return product belonging to tenant", async () => {
      const mockProduct = { id: "prod-1", tenantId, name: "Tomate" };

      prismaService.product.findFirst.mockResolvedValue(mockProduct);

      await service.findOne("prod-1", tenantId);

      expect(prismaService.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "prod-1", tenantId },
        }),
      );
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
        stocks: [],
      };

      const updateDto = { name: "Tomate Cherry", purchasePrice: 18.0 };

      const updatedProduct = {
        ...existingProduct,
        name: "Tomate Cherry",
        purchasePrice: 18.0,
        netPrice: 21.06,
        purchaseFormats: [],
        nutritionalInfo: null,
        category: null,
        supplier: null,
        stocks: [],
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
        stocks: [],
      };

      const updateDto = { purchasePrice: 20.0 };

      prismaService.product.findFirst.mockResolvedValue(existingProduct);
      prismaService.product.update.mockResolvedValue({
        ...existingProduct,
        purchasePrice: 20.0,
        netPrice: 23.4,
        purchaseFormats: [],
        nutritionalInfo: null,
        category: null,
        supplier: null,
        stocks: [],
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
        stocks: [],
      };

      const updateDto = { category: "cat-5" };

      prismaService.product.findFirst.mockResolvedValue(existingProduct);
      prismaService.product.update.mockResolvedValue({
        purchaseFormats: [],
        nutritionalInfo: null,
        category: null,
        supplier: null,
        stocks: [],
      });

      await service.update("prod-1", updateDto, tenantId);

      expect(prismaService.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categoryId: "cat-5",
          }),
        }),
      );
    });

    it("should upsert nutritionalInfo on update", async () => {
      const existingProduct = {
        id: "prod-1",
        tenantId,
        purchasePrice: 10,
        wastePercentage: 0,
        profitMargin: 0,
        stocks: [],
      };

      const updateDto = { nutritionalInfo: { fat: 20, protein: 5 } };

      prismaService.product.findFirst.mockResolvedValue(existingProduct);
      prismaService.product.update.mockResolvedValue({
        purchaseFormats: [],
        nutritionalInfo: { fat: 20, protein: 5 },
        category: null,
        supplier: null,
        stocks: [],
      });

      await service.update("prod-1", updateDto, tenantId);

      expect(prismaService.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nutritionalInfo: {
              upsert: {
                create: { fat: 20, protein: 5 },
                update: { fat: 20, protein: 5 },
              },
            },
          }),
        }),
      );
    });

    it("should recalculate unitSize when unitsPerFormat or referenceUnitSize changes on update", async () => {
      const existingProduct = {
        id: "prod-1",
        tenantId,
        purchasePrice: 10,
        wastePercentage: 0,
        profitMargin: 0,
        unitsPerFormat: 1,
        referenceUnitSize: 1,
        unitSize: 1,
        stocks: [],
      };

      const updateDto = { unitsPerFormat: 4, referenceUnitSize: 2.5 };

      prismaService.product.findFirst.mockResolvedValue(existingProduct);
      prismaService.product.update.mockResolvedValue({
        ...existingProduct,
        unitsPerFormat: 4,
        referenceUnitSize: 2.5,
        unitSize: 10,
        purchaseFormats: [],
        nutritionalInfo: null,
        category: null,
        supplier: null,
        stocks: [],
      });

      const result = await service.update("prod-1", updateDto, tenantId);

      expect(result.success).toBe(true);
      expect(result.data.unitSize).toBe(10);
      expect(prismaService.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unitsPerFormat: 4,
            referenceUnitSize: 2.5,
          }),
        }),
      );
    });

    it("delegates to ProductSupplierOffersService when supplier + purchasePrice are both provided, without writing price fields on Product directly", async () => {
      const existingProduct = {
        id: "prod-1",
        tenantId,
        purchasePrice: 10,
        netPrice: 10,
        supplierId: "supplier-a",
        wastePercentage: 0,
        profitMargin: 0,
        stocks: [],
      };

      const updateDto = { supplier: "supplier-dialvi", purchasePrice: 6.53 };

      (productSupplierOffersService.upsertOffer as jest.Mock).mockResolvedValue(
        { id: "offer-dialvi", isPreferred: false },
      );
      prismaService.productSupplierOffer.findFirst.mockResolvedValue(null);
      prismaService.product.findFirst.mockResolvedValue(existingProduct);
      prismaService.product.update.mockResolvedValue({
        ...existingProduct,
        purchaseFormats: [],
        nutritionalInfo: null,
        category: null,
        supplier: null,
        stocks: [],
      });

      await service.update("prod-1", updateDto, tenantId);

      expect(productSupplierOffersService.upsertOffer).toHaveBeenCalledWith(
        "prod-1",
        "supplier-dialvi",
        tenantId,
        expect.objectContaining({ purchasePrice: 6.53 }),
      );
      // Dialvi no era la oferta preferente: se promueve explícitamente.
      expect(productSupplierOffersService.setPreferred).toHaveBeenCalledWith(
        "prod-1",
        "offer-dialvi",
        tenantId,
      );
      // El precio/proveedor ya lo sincronizó el offers service — el update
      // directo de Product no debe volver a escribir esos campos.
      expect(prismaService.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            purchasePrice: expect.anything(),
            supplierId: expect.anything(),
          }),
        }),
      );
    });

    it("does not call setPreferred when the offer is already the preferred one", async () => {
      const existingProduct = {
        id: "prod-1",
        tenantId,
        purchasePrice: 10,
        netPrice: 10,
        supplierId: "supplier-a",
        wastePercentage: 0,
        profitMargin: 0,
        stocks: [],
      };

      const updateDto = { supplier: "supplier-a", purchasePrice: 12 };

      (productSupplierOffersService.upsertOffer as jest.Mock).mockResolvedValue(
        { id: "offer-a", isPreferred: true },
      );
      prismaService.productSupplierOffer.findFirst.mockResolvedValue(null);
      prismaService.product.findFirst.mockResolvedValue(existingProduct);
      prismaService.product.update.mockResolvedValue({
        ...existingProduct,
        purchaseFormats: [],
        nutritionalInfo: null,
        category: null,
        supplier: null,
        stocks: [],
      });

      await service.update("prod-1", updateDto, tenantId);

      expect(productSupplierOffersService.setPreferred).not.toHaveBeenCalled();
    });

    it("routes a price edit to the CURRENTLY preferred offer, ignoring a stale supplier in the DTO (regression: modal reverting the preferred supplier on save)", async () => {
      const existingProduct = {
        id: "prod-1",
        tenantId,
        purchasePrice: 6.53,
        netPrice: 6.53,
        supplierId: "supplier-dialvi",
        wastePercentage: 0,
        profitMargin: 0,
        stocks: [],
      };

      // El DTO trae el proveedor que estaba seleccionado cuando se abrió el
      // modal ("supplier-a"), pero mientras tanto el usuario marcó Dialvi
      // como preferente desde la pestaña Proveedor y Stock (acción
      // independiente e inmediata). El precio editado en "Formato y Precio"
      // debe aplicarse a Dialvi (el preferente real ahora), no a supplier-a.
      const updateDto = { supplier: "supplier-a", purchasePrice: 6.9 };

      prismaService.productSupplierOffer.findFirst.mockResolvedValue({
        id: "offer-dialvi",
        supplierId: "supplier-dialvi",
        isPreferred: true,
      });
      (productSupplierOffersService.upsertOffer as jest.Mock).mockResolvedValue(
        { id: "offer-dialvi", isPreferred: true },
      );
      prismaService.product.findFirst.mockResolvedValue(existingProduct);
      prismaService.product.update.mockResolvedValue({
        ...existingProduct,
        purchaseFormats: [],
        nutritionalInfo: null,
        category: null,
        supplier: null,
        stocks: [],
      });

      await service.update("prod-1", updateDto, tenantId);

      expect(productSupplierOffersService.upsertOffer).toHaveBeenCalledWith(
        "prod-1",
        "supplier-dialvi",
        tenantId,
        expect.objectContaining({ purchasePrice: 6.9 }),
      );
      expect(productSupplierOffersService.setPreferred).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should delete product successfully", async () => {
      const mockProduct = { id: "prod-1", tenantId, name: "Tomate" };

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
        purchaseFormat: "Caja 10kg",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 10,
        unitSize: 10,
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
      expect(result.data.referencePrice).toBeDefined();
      expect(result.data.purchaseFormat).toBe("Caja 10kg");
      expect(result.data.referenceUnit).toBe("kg");
      expect(result.data.unitSize).toBe(10);
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
    it("should return active suppliers for tenant from Supplier table", async () => {
      const mockSuppliers = [
        { id: "supp-1", name: "Proveedor A" },
        { id: "supp-2", name: "Proveedor B" },
      ];

      prismaService.supplier.findMany.mockResolvedValue(mockSuppliers);

      const result = await service.getSuppliers(tenantId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSuppliers);
      expect(result.message).toBe("Suppliers retrieved successfully");
      expect(prismaService.supplier.findMany).toHaveBeenCalledWith({
        where: { tenantId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
    });

    it("should return empty array when no suppliers found", async () => {
      prismaService.supplier.findMany.mockResolvedValue([]);

      const result = await service.getSuppliers(tenantId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("should handle large page numbers gracefully", async () => {
      prismaService.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);
      prismaService.product.findMany.mockResolvedValue([]);

      const query = { page: 100, limit: 20 };
      const result = await service.findAll(query, tenantId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
      expect(result.meta.page).toBe(100);
    });

    it("should handle zero limit by using default", async () => {
      prismaService.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);
      prismaService.product.findMany.mockResolvedValue([]);

      const query = { limit: 0 } as any;
      const result = await service.findAll(query, tenantId);

      expect(result.success).toBe(true);
      expect(result.meta.limit).toBe(0);
    });

    it("should handle very long product names", async () => {
      const longName = "A".repeat(500);
      const createDto = {
        name: longName,
        category: "cat-1",
        purchaseFormat: "Kg",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 1,
        unitSize: 1,
        purchasePrice: 10.0,
      };

      prismaService.product.create.mockResolvedValue({
        id: "prod-1",
        tenantId,
        name: longName,
        categoryId: "cat-1",
        purchaseFormat: "Kg",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 1,
        unitSize: 1,
        purchasePrice: 10.0,
        netPrice: 10.0,
        profitMargin: 0,
        wastePercentage: 0,
        yieldFactor: 1.0,
        allergens: [],
        isActive: true,
        purchaseFormats: [],
        nutritionalInfo: null,
        category: null,
        supplier: null,
        stocks: [],
      });

      const result = await service.create(createDto, tenantId);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe(longName);
    });

    it("should handle very small purchase prices", async () => {
      const createDto = {
        name: "Product",
        category: "cat-1",
        purchaseFormat: "g",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 0.001,
        unitSize: 0.001,
        purchasePrice: 0.001,
      };

      prismaService.product.create.mockResolvedValue({
        id: "prod-1",
        tenantId,
        name: "Product",
        categoryId: "cat-1",
        purchasePrice: 0.001,
        netPrice: 0.001,
        profitMargin: 0,
        wastePercentage: 0,
        yieldFactor: 1.0,
        allergens: [],
        isActive: true,
        purchaseFormats: [],
        nutritionalInfo: null,
        category: null,
        supplier: null,
        stocks: [],
      });

      const result = await service.create(createDto, tenantId);

      expect(result.success).toBe(true);
      expect(result.data.purchasePrice).toBe(0.001);
    });

    it("should handle very large profit margins", async () => {
      const createDto = {
        name: "Product",
        category: "cat-1",
        purchaseFormat: "Kg",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 1,
        unitSize: 1,
        purchasePrice: 10.0,
        profitMargin: 500,
      };

      prismaService.product.create.mockResolvedValue({
        id: "prod-1",
        tenantId,
        name: "Product",
        categoryId: "cat-1",
        purchasePrice: 10.0,
        netPrice: 60.0,
        profitMargin: 500,
        wastePercentage: 0,
        yieldFactor: 1.0,
        allergens: [],
        isActive: true,
        purchaseFormats: [],
        nutritionalInfo: null,
        category: null,
        supplier: null,
        stocks: [],
      });

      const result = await service.create(createDto, tenantId);

      expect(result.success).toBe(true);
      expect(result.data.profitMargin).toBe(500);
      expect(result.data.netPrice).toBe(60.0);
    });

    it("should handle zero profit margin correctly", async () => {
      const createDto = {
        name: "Product",
        category: "cat-1",
        purchaseFormat: "Kg",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 1,
        unitSize: 1,
        purchasePrice: 10.0,
        profitMargin: 0,
      };

      prismaService.product.create.mockResolvedValue({
        id: "prod-1",
        tenantId,
        name: "Product",
        categoryId: "cat-1",
        purchasePrice: 10.0,
        netPrice: 10.0,
        profitMargin: 0,
        wastePercentage: 0,
        yieldFactor: 1.0,
        allergens: [],
        isActive: true,
        purchaseFormats: [],
        nutritionalInfo: null,
        category: null,
        supplier: null,
        stocks: [],
      });

      const result = await service.create(createDto, tenantId);

      expect(result.success).toBe(true);
      expect(result.data.netPrice).toBe(10.0);
    });

    it("should handle very high waste percentages", async () => {
      const createDto = {
        name: "Product",
        category: "cat-1",
        purchaseFormat: "Kg",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 1,
        unitSize: 1,
        purchasePrice: 10.0,
        wastePercentage: 75,
      };

      prismaService.product.create.mockResolvedValue({
        id: "prod-1",
        tenantId,
        name: "Product",
        categoryId: "cat-1",
        purchasePrice: 10.0,
        netPrice: 40.0,
        profitMargin: 0,
        wastePercentage: 75,
        yieldFactor: 0.25,
        allergens: [],
        isActive: true,
        purchaseFormats: [],
        nutritionalInfo: null,
        category: null,
        supplier: null,
        stocks: [],
      });

      const result = await service.create(createDto, tenantId);

      expect(result.success).toBe(true);
      expect(result.data.wastePercentage).toBe(75);
      expect(result.data.yieldFactor).toBe(0.25);
    });

    it("should handle yield factor calculation correctly", async () => {
      const createDto = {
        name: "Product",
        category: "cat-1",
        purchaseFormat: "Kg",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 1,
        unitSize: 1,
        purchasePrice: 10.0,
        yieldFactor: 0.8,
      };

      prismaService.product.create.mockResolvedValue({
        id: "prod-1",
        tenantId,
        name: "Product",
        categoryId: "cat-1",
        purchasePrice: 10.0,
        netPrice: 10.0,
        profitMargin: 0,
        wastePercentage: 0,
        yieldFactor: 0.8,
        allergens: [],
        isActive: true,
        purchaseFormats: [],
        nutritionalInfo: null,
        category: null,
        supplier: null,
        stocks: [],
      });

      const result = await service.create(createDto, tenantId);

      expect(result.success).toBe(true);
      expect(result.data.yieldFactor).toBe(0.8);
    });

    it("should handle empty allergens array", async () => {
      const createDto = {
        name: "Product",
        category: "cat-1",
        purchaseFormat: "Kg",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 1,
        unitSize: 1,
        purchasePrice: 10.0,
        allergens: [],
      };

      prismaService.product.create.mockResolvedValue({
        id: "prod-1",
        tenantId,
        name: "Product",
        categoryId: "cat-1",
        purchasePrice: 10.0,
        netPrice: 10.0,
        profitMargin: 0,
        wastePercentage: 0,
        yieldFactor: 1.0,
        allergens: [],
        isActive: true,
        purchaseFormats: [],
        nutritionalInfo: null,
        category: null,
        supplier: null,
        stocks: [],
      });

      const result = await service.create(createDto, tenantId);

      expect(result.success).toBe(true);
      expect(result.data.allergens).toEqual([]);
    });

    it("should handle update with yield factor override", async () => {
      const existingProduct = {
        id: "prod-1",
        tenantId,
        purchasePrice: 10,
        wastePercentage: 0,
        profitMargin: 0,
        yieldFactor: 1.0,
        stocks: [],
      };

      const updateDto = { yieldFactor: 0.5 };

      prismaService.product.findFirst.mockResolvedValue(existingProduct);
      prismaService.product.update.mockResolvedValue({
        ...existingProduct,
        yieldFactor: 0.5,
        purchaseFormats: [],
        nutritionalInfo: null,
        category: null,
        supplier: null,
        stocks: [],
      });

      await service.update("prod-1", updateDto, tenantId);

      expect(prismaService.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            yieldFactor: 0.5,
          }),
        }),
      );
    });

    it("should handle update with waste percentage zero", async () => {
      const existingProduct = {
        id: "prod-1",
        tenantId,
        purchasePrice: 10,
        wastePercentage: 20,
        profitMargin: 0,
        stocks: [],
      };

      const updateDto = { wastePercentage: 0 };

      prismaService.product.findFirst.mockResolvedValue(existingProduct);
      prismaService.product.update.mockResolvedValue({
        ...existingProduct,
        wastePercentage: 0,
        yieldFactor: 1.0,
        purchaseFormats: [],
        nutritionalInfo: null,
        category: null,
        supplier: null,
        stocks: [],
      });

      await service.update("prod-1", updateDto, tenantId);

      expect(prismaService.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            wastePercentage: 0,
            yieldFactor: 1.0,
          }),
        }),
      );
    });
  });
});
