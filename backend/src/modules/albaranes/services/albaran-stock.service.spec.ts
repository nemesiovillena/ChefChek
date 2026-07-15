import { Test, TestingModule } from "@nestjs/testing";
import { AlbaranStockService } from "./albaran-stock.service";
import { PrismaService } from "../../../common/services/prisma.service";
import { NotificationsService } from "../../core/notifications.service";
import { ProductSupplierOffersService } from "../../products/product-supplier-offers.service";
import { PriceAgreementService } from "../../compras/services/price-agreement.service";
import { LineStatus, LineMatchStatus, AlbaranStatus } from "@prisma/client";

describe("AlbaranStockService", () => {
  let service: AlbaranStockService;
  let prisma: jest.Mocked<PrismaService>;
  let notifications: jest.Mocked<NotificationsService>;
  let productSupplierOffersService: jest.Mocked<ProductSupplierOffersService>;
  let priceAgreementService: { evaluateAndRecord: jest.Mock };

  const mockTenantId = "tenant-123";
  const mockAlbaranId = "albaran-123";
  const mockProductId = "product-123";
  const mockWarehouseId = "warehouse-123";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlbaranStockService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((fn) =>
              fn({
                stockMovement: {
                  findFirst: jest.fn(),
                  create: jest.fn(),
                },
                albaran: {
                  findFirst: jest.fn(),
                },
                product: {
                  findFirst: jest.fn(),
                  update: jest.fn(),
                  create: jest.fn(),
                },
                stock: {
                  findFirst: jest.fn(),
                  update: jest.fn(),
                  create: jest.fn(),
                },
                albaranLine: {
                  update: jest.fn(),
                },
                productPriceHistory: {
                  create: jest.fn(),
                },
                productSupplierOffer: {
                  findFirst: jest.fn().mockResolvedValue(null),
                },
              }),
            ),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            createNotification: jest.fn(),
          },
        },
        {
          provide: ProductSupplierOffersService,
          useValue: {
            upsertOffer: jest.fn(),
          },
        },
        {
          provide: PriceAgreementService,
          useValue: {
            evaluateAndRecord: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AlbaranStockService>(AlbaranStockService);
    prisma = module.get(PrismaService);
    notifications = module.get(NotificationsService);
    productSupplierOffersService = module.get(ProductSupplierOffersService);
    priceAgreementService = module.get(PriceAgreementService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("processStockOnConfirmation", () => {
    it("should skip if stock movements already exist (idempotency)", async () => {
      const mockTx = {
        stockMovement: {
          findFirst: jest.fn().mockResolvedValue({ id: "existing" }),
        },
        albaran: { findFirst: jest.fn() },
        product: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
        stock: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
        albaranLine: { update: jest.fn() },
        productSupplierOffer: { findFirst: jest.fn().mockResolvedValue(null) },
      };

      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(mockTx));

      await service.processStockOnConfirmation(mockAlbaranId, mockTenantId);

      expect(mockTx.stockMovement.findFirst).toHaveBeenCalledWith({
        where: { reason: { contains: mockAlbaranId } },
      });
      expect(mockTx.albaran.findFirst).not.toHaveBeenCalled();
    });

    it("should handle albaran not found", async () => {
      const mockTx = {
        stockMovement: { findFirst: jest.fn().mockResolvedValue(null) },
        albaran: { findFirst: jest.fn().mockResolvedValue(null) },
        product: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
        stock: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
        albaranLine: { update: jest.fn() },
        productSupplierOffer: { findFirst: jest.fn().mockResolvedValue(null) },
      };

      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(mockTx));

      await service.processStockOnConfirmation(mockAlbaranId, mockTenantId);

      expect(mockTx.albaran.findFirst).toHaveBeenCalledWith({
        where: { id: mockAlbaranId, tenantId: mockTenantId },
        include: { lines: true, supplier: true },
      });
    });

    it("should handle empty albaran with no confirmed lines", async () => {
      const mockAlbaran = {
        id: mockAlbaranId,
        tenantId: mockTenantId,
        internalNumber: "ALB-001",
        supplierId: "supplier-123",
        warehouseId: mockWarehouseId,
        lines: [
          {
            id: "line-1",
            lineStatus: LineStatus.RECHAZADO,
            matchedProductId: null,
            description: "Rejected product",
            quantity: 10,
            unit: "kg",
            unitPrice: 5,
          },
        ],
      };

      const mockTx = {
        stockMovement: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
        },
        albaran: { findFirst: jest.fn().mockResolvedValue(mockAlbaran) },
        product: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
        stock: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
        albaranLine: { update: jest.fn() },
        productSupplierOffer: { findFirst: jest.fn().mockResolvedValue(null) },
      };

      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(mockTx));

      await service.processStockOnConfirmation(mockAlbaranId, mockTenantId);

      expect(mockTx.product.findFirst).not.toHaveBeenCalled();
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });

    it("should process CONFIRMADO line with matched product, upsert the supplier's offer and update stock", async () => {
      const mockProduct = {
        id: mockProductId,
        name: "Test Product",
        purchasePrice: 4.5,
        netPrice: 4.5,
      };

      const mockAlbaran = {
        id: mockAlbaranId,
        tenantId: mockTenantId,
        internalNumber: "ALB-001",
        supplierId: "supplier-123",
        warehouseId: mockWarehouseId,
        lines: [
          {
            id: "line-1",
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: mockProductId,
            description: "Test Product",
            quantity: 10,
            unit: "kg",
            unitPrice: 5,
          },
        ],
      };

      const mockTx = {
        stockMovement: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "movement-1" }),
        },
        albaran: { findFirst: jest.fn().mockResolvedValue(mockAlbaran) },
        product: {
          findFirst: jest.fn().mockResolvedValue(mockProduct),
          update: jest.fn().mockResolvedValue(mockProduct),
          create: jest.fn(),
        },
        stock: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "stock-1" }),
          update: jest.fn(),
        },
        albaranLine: { update: jest.fn() },
        productSupplierOffer: { findFirst: jest.fn().mockResolvedValue(null) },
        productPriceHistory: { create: jest.fn() },
      };

      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(mockTx));
      (productSupplierOffersService.upsertOffer as jest.Mock).mockResolvedValue(
        { isPreferred: true, purchasePrice: 5 },
      );

      await service.processStockOnConfirmation(mockAlbaranId, mockTenantId);

      expect(mockTx.product.findFirst).toHaveBeenCalled();
      expect(productSupplierOffersService.upsertOffer).toHaveBeenCalledWith(
        mockProductId,
        "supplier-123",
        mockTenantId,
        { purchasePrice: 5, netPrice: 5 },
        mockTx,
        mockAlbaranId,
      );
      // El precio plano ya no se sobreescribe directamente: lo hace
      // ProductSupplierOffersService cuando la oferta es la preferente.
      expect(mockTx.product.update).not.toHaveBeenCalled();
      expect(mockTx.stockMovement.create).toHaveBeenCalled();
      expect(mockTx.stock.create).toHaveBeenCalledWith({
        data: {
          tenantId: mockTenantId,
          productId: mockProductId,
          warehouseId: mockWarehouseId,
          quantity: 10,
        },
      });
    });

    it("does not overwrite Product's flat price when the line's supplier offer is not the preferred one", async () => {
      const mockProduct = {
        id: mockProductId,
        name: "Mozzarella",
        purchasePrice: 10,
        netPrice: 10,
      };

      const mockAlbaran = {
        id: mockAlbaranId,
        tenantId: mockTenantId,
        internalNumber: "ALB-001",
        supplierId: "supplier-dialvi",
        warehouseId: mockWarehouseId,
        lines: [
          {
            id: "line-1",
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: mockProductId,
            description: "Mozzarella",
            quantity: 10,
            unit: "kg",
            unitPrice: 6.53,
          },
        ],
      };

      const mockTx = {
        stockMovement: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "movement-1" }),
        },
        albaran: { findFirst: jest.fn().mockResolvedValue(mockAlbaran) },
        product: {
          findFirst: jest.fn().mockResolvedValue(mockProduct),
          update: jest.fn(),
          create: jest.fn(),
        },
        stock: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "stock-1" }),
          update: jest.fn(),
        },
        albaranLine: { update: jest.fn() },
        productSupplierOffer: { findFirst: jest.fn().mockResolvedValue(null) },
        productPriceHistory: { create: jest.fn() },
      };

      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(mockTx));
      // Dialvi no es el proveedor preferente de este producto: su oferta se
      // actualiza, pero el precio plano vigente del producto no cambia.
      (productSupplierOffersService.upsertOffer as jest.Mock).mockResolvedValue(
        { isPreferred: false, purchasePrice: 6.53 },
      );

      await service.processStockOnConfirmation(mockAlbaranId, mockTenantId);

      expect(productSupplierOffersService.upsertOffer).toHaveBeenCalledWith(
        mockProductId,
        "supplier-dialvi",
        mockTenantId,
        { purchasePrice: 6.53, netPrice: 6.53 },
        mockTx,
        mockAlbaranId,
      );
      expect(mockTx.product.update).not.toHaveBeenCalled();
      expect(notifications.createNotification).not.toHaveBeenCalled();
    });

    it("falls back to a direct Product update when the albarán has no supplier assigned", async () => {
      const mockProduct = {
        id: mockProductId,
        name: "Test Product",
        purchasePrice: 4.5,
        netPrice: 4.5,
      };

      const mockAlbaran = {
        id: mockAlbaranId,
        tenantId: mockTenantId,
        internalNumber: "ALB-001",
        supplierId: null,
        warehouseId: mockWarehouseId,
        lines: [
          {
            id: "line-1",
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: mockProductId,
            description: "Test Product",
            quantity: 10,
            unit: "kg",
            unitPrice: 5,
          },
        ],
      };

      const mockTx = {
        stockMovement: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "movement-1" }),
        },
        albaran: { findFirst: jest.fn().mockResolvedValue(mockAlbaran) },
        product: {
          findFirst: jest.fn().mockResolvedValue(mockProduct),
          update: jest.fn().mockResolvedValue(mockProduct),
          create: jest.fn(),
        },
        stock: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "stock-1" }),
          update: jest.fn(),
        },
        albaranLine: { update: jest.fn() },
        productSupplierOffer: { findFirst: jest.fn().mockResolvedValue(null) },
        productPriceHistory: { create: jest.fn() },
      };

      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(mockTx));

      await service.processStockOnConfirmation(mockAlbaranId, mockTenantId);

      expect(productSupplierOffersService.upsertOffer).not.toHaveBeenCalled();
      expect(mockTx.product.update).toHaveBeenCalledWith({
        where: { id: mockProductId },
        data: { previousPurchasePrice: 4.5, purchasePrice: 5, netPrice: 5 },
      });
      expect(mockTx.productPriceHistory.create).toHaveBeenCalledWith({
        data: {
          tenantId: mockTenantId,
          productId: mockProductId,
          supplierId: null,
          albaranId: mockAlbaranId,
          previousPrice: 4.5,
          newPrice: 5,
        },
      });
    });

    it("should update existing stock record instead of creating new one", async () => {
      const mockProduct = {
        id: mockProductId,
        name: "Test Product",
        purchasePrice: 5,
        netPrice: 5,
      };

      const mockExistingStock = {
        id: "stock-123",
        productId: mockProductId,
        warehouseId: mockWarehouseId,
        quantity: 50,
      };

      const mockAlbaran = {
        id: mockAlbaranId,
        tenantId: mockTenantId,
        internalNumber: "ALB-001",
        supplierId: "supplier-123",
        warehouseId: mockWarehouseId,
        lines: [
          {
            id: "line-1",
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: mockProductId,
            description: "Test Product",
            quantity: 10,
            unit: "kg",
            unitPrice: 5,
          },
        ],
      };

      const mockTx = {
        stockMovement: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "movement-1" }),
        },
        albaran: { findFirst: jest.fn().mockResolvedValue(mockAlbaran) },
        product: {
          findFirst: jest.fn().mockResolvedValue(mockProduct),
          update: jest.fn().mockResolvedValue(mockProduct),
          create: jest.fn(),
        },
        stock: {
          findFirst: jest.fn().mockResolvedValue(mockExistingStock),
          update: jest
            .fn()
            .mockResolvedValue({ ...mockExistingStock, quantity: 60 }),
          create: jest.fn(),
        },
        albaranLine: { update: jest.fn() },
        productSupplierOffer: { findFirst: jest.fn().mockResolvedValue(null) },
        productPriceHistory: { create: jest.fn() },
      };

      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(mockTx));
      (productSupplierOffersService.upsertOffer as jest.Mock).mockResolvedValue(
        { isPreferred: true, purchasePrice: 5 },
      );

      await service.processStockOnConfirmation(mockAlbaranId, mockTenantId);

      expect(mockTx.stock.update).toHaveBeenCalledWith({
        where: { id: "stock-123" },
        data: { quantity: { increment: 10 } },
      });
      expect(mockTx.stock.create).not.toHaveBeenCalled();
    });

    it("should create new product for CONFIRMADO line without matchedProductId", async () => {
      const mockNewProduct = {
        id: "new-product-123",
        name: "New Product",
        purchasePrice: 7.5,
        netPrice: 7.5,
      };

      const mockAlbaran = {
        id: mockAlbaranId,
        tenantId: mockTenantId,
        internalNumber: "ALB-001",
        supplierId: "supplier-123",
        warehouseId: mockWarehouseId,
        lines: [
          {
            id: "line-1",
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: null,
            description: "New Product",
            quantity: 5,
            unit: "L",
            unitPrice: 7.5,
          },
        ],
      };

      const mockTx = {
        stockMovement: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "movement-1" }),
        },
        albaran: { findFirst: jest.fn().mockResolvedValue(mockAlbaran) },
        product: {
          findFirst: jest.fn(),
          update: jest.fn(),
          create: jest.fn().mockResolvedValue(mockNewProduct),
        },
        stock: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "stock-1" }),
          update: jest.fn(),
        },
        albaranLine: {
          update: jest.fn().mockResolvedValue({}),
        },
        productSupplierOffer: { findFirst: jest.fn().mockResolvedValue(null) },
      };

      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(mockTx));

      await service.processStockOnConfirmation(mockAlbaranId, mockTenantId);

      expect(mockTx.product.create).toHaveBeenCalledWith({
        data: {
          tenantId: mockTenantId,
          name: "New Product",
          description: "Creado desde albarán ALB-001",
          purchaseFormat: "L",
          referenceUnit: "L",
          unitsPerFormat: 1,
          referenceUnitSize: 1,
          unitSize: 1,
          purchasePrice: 7.5,
          netPrice: 7.5,
          supplierId: "supplier-123",
          wastePercentage: 0,
          yieldFactor: 1.0,
          allergens: [],
        },
      });

      expect(mockTx.albaranLine.update).toHaveBeenCalledWith({
        where: { id: "line-1" },
        data: {
          matchedProductId: "new-product-123",
          matchStatus: LineMatchStatus.MATCH_ALTO,
        },
      });
    });

    it("should notify price change >10%", async () => {
      const mockProduct = {
        id: mockProductId,
        name: "Test Product",
        purchasePrice: 4,
        netPrice: 4,
      };

      const mockAlbaran = {
        id: mockAlbaranId,
        tenantId: mockTenantId,
        internalNumber: "ALB-001",
        supplierId: "supplier-123",
        warehouseId: mockWarehouseId,
        lines: [
          {
            id: "line-1",
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: mockProductId,
            description: "Test Product",
            quantity: 10,
            unit: "kg",
            unitPrice: 5,
          },
        ],
      };

      const mockTx = {
        stockMovement: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "movement-1" }),
        },
        albaran: { findFirst: jest.fn().mockResolvedValue(mockAlbaran) },
        product: {
          findFirst: jest.fn().mockResolvedValue(mockProduct),
          update: jest.fn().mockResolvedValue(mockProduct),
          create: jest.fn(),
        },
        stock: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "stock-1" }),
          update: jest.fn(),
        },
        albaranLine: { update: jest.fn() },
        productSupplierOffer: { findFirst: jest.fn().mockResolvedValue(null) },
        productPriceHistory: { create: jest.fn() },
      };

      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(mockTx));
      (productSupplierOffersService.upsertOffer as jest.Mock).mockResolvedValue(
        { isPreferred: true, purchasePrice: 5 },
      );

      await service.processStockOnConfirmation(mockAlbaranId, mockTenantId);

      expect(notifications.createNotification).toHaveBeenCalledWith(
        mockTenantId,
        expect.objectContaining({
          type: "WARNING",
          title: "Cambio de precio: Test Product",
        }),
      );
    });

    it("should send ERROR notification for price change >25%", async () => {
      const mockProduct = {
        id: mockProductId,
        name: "Test Product",
        purchasePrice: 3,
        netPrice: 3,
      };

      const mockAlbaran = {
        id: mockAlbaranId,
        tenantId: mockTenantId,
        internalNumber: "ALB-001",
        supplierId: "supplier-123",
        warehouseId: mockWarehouseId,
        lines: [
          {
            id: "line-1",
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: mockProductId,
            description: "Test Product",
            quantity: 10,
            unit: "kg",
            unitPrice: 5,
          },
        ],
      };

      const mockTx = {
        stockMovement: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "movement-1" }),
        },
        albaran: { findFirst: jest.fn().mockResolvedValue(mockAlbaran) },
        product: {
          findFirst: jest.fn().mockResolvedValue(mockProduct),
          update: jest.fn().mockResolvedValue(mockProduct),
          create: jest.fn(),
        },
        stock: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "stock-1" }),
          update: jest.fn(),
        },
        albaranLine: { update: jest.fn() },
        productSupplierOffer: { findFirst: jest.fn().mockResolvedValue(null) },
        productPriceHistory: { create: jest.fn() },
      };

      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(mockTx));
      (productSupplierOffersService.upsertOffer as jest.Mock).mockResolvedValue(
        { isPreferred: true, purchasePrice: 5 },
      );

      await service.processStockOnConfirmation(mockAlbaranId, mockTenantId);

      expect(notifications.createNotification).toHaveBeenCalledWith(
        mockTenantId,
        expect.objectContaining({
          type: "ERROR",
          severity: "ERROR",
        }),
      );
    });

    it("should skip product not found", async () => {
      const mockAlbaran = {
        id: mockAlbaranId,
        tenantId: mockTenantId,
        internalNumber: "ALB-001",
        supplierId: "supplier-123",
        warehouseId: mockWarehouseId,
        lines: [
          {
            id: "line-1",
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: "non-existent-product",
            description: "Missing Product",
            quantity: 10,
            unit: "kg",
            unitPrice: 5,
          },
        ],
      };

      const mockTx = {
        stockMovement: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
        },
        albaran: { findFirst: jest.fn().mockResolvedValue(mockAlbaran) },
        product: {
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
          create: jest.fn(),
        },
        stock: {
          findFirst: jest.fn(),
          update: jest.fn(),
          create: jest.fn(),
        },
        albaranLine: { update: jest.fn() },
        productSupplierOffer: { findFirst: jest.fn().mockResolvedValue(null) },
      };

      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(mockTx));

      await service.processStockOnConfirmation(mockAlbaranId, mockTenantId);

      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
      expect(mockTx.stock.create).not.toHaveBeenCalled();
    });

    it("should process multiple confirmed lines", async () => {
      const mockProduct1 = {
        id: "product-1",
        name: "Product 1",
        purchasePrice: 5,
        netPrice: 5,
      };

      const mockProduct2 = {
        id: "product-2",
        name: "Product 2",
        purchasePrice: 10,
        netPrice: 10,
      };

      const mockAlbaran = {
        id: mockAlbaranId,
        tenantId: mockTenantId,
        internalNumber: "ALB-001",
        supplierId: "supplier-123",
        warehouseId: mockWarehouseId,
        lines: [
          {
            id: "line-1",
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: "product-1",
            description: "Product 1",
            quantity: 10,
            unit: "kg",
            unitPrice: 5,
          },
          {
            id: "line-2",
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: "product-2",
            description: "Product 2",
            quantity: 5,
            unit: "L",
            unitPrice: 10,
          },
        ],
      };

      const mockTx = {
        stockMovement: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "movement-1" }),
        },
        albaran: { findFirst: jest.fn().mockResolvedValue(mockAlbaran) },
        product: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(mockProduct1)
            .mockResolvedValueOnce(mockProduct2),
          update: jest.fn(),
          create: jest.fn(),
        },
        stock: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "stock-1" }),
          update: jest.fn(),
        },
        albaranLine: { update: jest.fn() },
        productSupplierOffer: { findFirst: jest.fn().mockResolvedValue(null) },
        productPriceHistory: { create: jest.fn() },
      };

      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(mockTx));
      (productSupplierOffersService.upsertOffer as jest.Mock).mockResolvedValue(
        { isPreferred: true },
      );

      await service.processStockOnConfirmation(mockAlbaranId, mockTenantId);

      expect(mockTx.stockMovement.create).toHaveBeenCalledTimes(2);
      expect(mockTx.stock.create).toHaveBeenCalledTimes(2);
    });

    it("should handle warehouse null", async () => {
      const mockProduct = {
        id: mockProductId,
        name: "Test Product",
        purchasePrice: 5,
        netPrice: 5,
      };

      const mockAlbaran = {
        id: mockAlbaranId,
        tenantId: mockTenantId,
        internalNumber: "ALB-001",
        supplierId: "supplier-123",
        warehouseId: null,
        lines: [
          {
            id: "line-1",
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: mockProductId,
            description: "Test Product",
            quantity: 10,
            unit: "kg",
            unitPrice: 5,
          },
        ],
      };

      const mockTx = {
        stockMovement: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "movement-1" }),
        },
        albaran: { findFirst: jest.fn().mockResolvedValue(mockAlbaran) },
        product: {
          findFirst: jest.fn().mockResolvedValue(mockProduct),
          update: jest.fn().mockResolvedValue(mockProduct),
          create: jest.fn(),
        },
        stock: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "stock-1" }),
          update: jest.fn(),
        },
        albaranLine: { update: jest.fn() },
        productSupplierOffer: { findFirst: jest.fn().mockResolvedValue(null) },
        productPriceHistory: { create: jest.fn() },
      };

      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(mockTx));
      (productSupplierOffersService.upsertOffer as jest.Mock).mockResolvedValue(
        { isPreferred: true, purchasePrice: 5 },
      );

      await service.processStockOnConfirmation(mockAlbaranId, mockTenantId);

      expect(mockTx.stock.findFirst).toHaveBeenCalledWith({
        where: {
          productId: mockProductId,
          warehouseId: null,
          tenantId: mockTenantId,
        },
      });
    });
  });
});
