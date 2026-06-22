import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { WarehousesService } from "./almacenes.service";
import { PrismaService } from "../../common/services/prisma.service";

describe("WarehousesService", () => {
  let service: WarehousesService;
  let prismaService: any;

  const mockPrismaService = {
    warehouse: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    stock: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    alert: {
      create: jest.fn(),
    },
    inventory: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    inventoryItem: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const tenantId = "tenant-123";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehousesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<WarehousesService>(WarehousesService);
    prismaService = mockPrismaService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createWarehouse", () => {
    it("should create a warehouse successfully", async () => {
      const createDto = {
        name: "Almacén Principal",
        location: "Planta Baja",
        capacity: 1000,
        conservationZone: "DRY_GOODS",
        isActive: true,
      };

      const mockWarehouse = {
        id: "wh-1",
        tenantId,
        name: "Almacén Principal",
        location: "Planta Baja",
        capacity: 1000,
        conservationZone: "DRY_GOODS",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaService.warehouse.create.mockResolvedValue(mockWarehouse);

      const result = await service.createWarehouse(tenantId, createDto);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockWarehouse);
      expect(result.message).toBe("Warehouse created successfully");
      expect(prismaService.warehouse.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          name: "Almacén Principal",
          capacity: 1000,
          isActive: true,
        }),
      });
    });

    it("should create warehouse with default isActive true", async () => {
      const createDto = {
        name: "Nuevo Almacén",
        location: "Segunda Planta",
      };

      const mockWarehouse = {
        id: "wh-2",
        tenantId,
        name: "Nuevo Almacén",
        location: "Segunda Planta",
        isActive: true,
      };

      prismaService.warehouse.create.mockResolvedValue(mockWarehouse);

      const result = await service.createWarehouse(tenantId, createDto);

      expect(result.data.isActive).toBe(true);
    });
  });

  describe("getWarehouses", () => {
    it("should return all warehouses for tenant", async () => {
      const mockWarehouses = [
        {
          id: "wh-1",
          tenantId,
          name: "Almacén Principal",
          stocks: [],
        },
        {
          id: "wh-2",
          tenantId,
          name: "Almacén Secundario",
          stocks: [
            { id: "stock-1", quantity: 100, product: { name: "Tomate" } },
          ],
        },
      ];

      prismaService.warehouse.findMany.mockResolvedValue(mockWarehouses);

      const result = await service.getWarehouses(tenantId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Almacén Principal");
      expect(result[1].stocks).toHaveLength(1);
      expect(prismaService.warehouse.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        include: {
          stocks: {
            include: { product: true },
          },
        },
        orderBy: { name: "asc" },
      });
    });
  });

  describe("getWarehouseById", () => {
    it("should return warehouse with statistics", async () => {
      const mockWarehouse = {
        id: "wh-1",
        tenantId,
        name: "Almacén Principal",
        capacity: 1000,
        stocks: [
          { quantity: 200, product: { name: "Tomate" } },
          { quantity: 300, product: { name: "Cebolla" } },
        ],
        movements: [
          { id: "mov-1", type: "ENTRANCE", quantity: 100 },
          { id: "mov-2", type: "EXIT", quantity: 50 },
        ],
      };

      prismaService.warehouse.findFirst.mockResolvedValue(mockWarehouse);

      const result = await service.getWarehouseById("wh-1", tenantId);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Almacén Principal");
      expect(result.data.statistics.totalStock).toBe(500);
      expect(result.data.statistics.totalCapacity).toBe(1000);
      expect(result.data.statistics.utilizationRate).toBe(50);
      expect(result.data.statistics.productCount).toBe(2);
    });

    it("should throw NotFoundException when warehouse not found", async () => {
      prismaService.warehouse.findFirst.mockResolvedValue(null);

      await expect(
        service.getWarehouseById("nonexistent", tenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it("should calculate utilization rate correctly with zero capacity", async () => {
      const mockWarehouse = {
        id: "wh-1",
        tenantId,
        name: "Almacén sin capacidad definida",
        capacity: null,
        stocks: [{ quantity: 100 }],
        movements: [],
      };

      prismaService.warehouse.findFirst.mockResolvedValue(mockWarehouse);

      const result = await service.getWarehouseById("wh-1", tenantId);

      expect(result.data.statistics.utilizationRate).toBe(0);
    });
  });

  describe("updateWarehouse", () => {
    it("should update warehouse successfully", async () => {
      const existingWarehouse = {
        id: "wh-1",
        tenantId,
        name: "Almacén Principal",
        capacity: 1000,
      };

      const updateDto = {
        name: "Almacén Principal Actualizado",
        capacity: 1500,
      };

      prismaService.warehouse.findFirst.mockResolvedValue(existingWarehouse);
      prismaService.warehouse.update.mockResolvedValue({
        ...existingWarehouse,
        ...updateDto,
      });

      const result = await service.updateWarehouse("wh-1", tenantId, updateDto);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Almacén Principal Actualizado");
      expect(result.data.capacity).toBe(1500);
    });

    it("should throw NotFoundException when updating nonexistent warehouse", async () => {
      prismaService.warehouse.findFirst.mockResolvedValue(null);

      await expect(
        service.updateWarehouse("nonexistent", tenantId, { name: "Test" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("deleteWarehouse", () => {
    it("should delete warehouse without stock", async () => {
      const mockWarehouse = {
        id: "wh-1",
        tenantId,
        name: "Almacén Vacío",
        stocks: [],
      };

      prismaService.warehouse.findFirst.mockResolvedValue(mockWarehouse);
      prismaService.warehouse.delete.mockResolvedValue(mockWarehouse);

      const result = await service.deleteWarehouse("wh-1", tenantId);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Warehouse deleted successfully");
    });

    it("should throw NotFoundException when deleting nonexistent warehouse", async () => {
      prismaService.warehouse.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteWarehouse("nonexistent", tenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException when warehouse has stock", async () => {
      const mockWarehouse = {
        id: "wh-1",
        tenantId,
        name: "Almacén con Stock",
        stocks: [{ id: "stock-1", quantity: 100 }],
      };

      prismaService.warehouse.findFirst.mockResolvedValue(mockWarehouse);

      await expect(service.deleteWarehouse("wh-1", tenantId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("getStock", () => {
    it("should return stock for tenant", async () => {
      const mockStocks = [
        {
          id: "stock-1",
          tenantId,
          productId: "prod-1",
          warehouseId: "wh-1",
          quantity: 100,
          reservedStock: 20,
          minimumStock: 10,
          product: { name: "Tomate" },
          warehouse: { name: "Principal" },
        },
      ];

      prismaService.stock.findMany.mockResolvedValue(mockStocks);

      const result = await service.getStock(tenantId, {});

      expect(result).toHaveLength(1);
      expect(result[0].availableQuantity).toBe(80);
      expect(result[0].isLowStock).toBe(false);
    });

    it("should filter by warehouseId", async () => {
      prismaService.stock.findMany.mockResolvedValue([]);

      await service.getStock(tenantId, { warehouseId: "wh-1" });

      expect(prismaService.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            warehouseId: "wh-1",
          }),
        }),
      );
    });

    it("should filter by productId", async () => {
      prismaService.stock.findMany.mockResolvedValue([]);

      await service.getStock(tenantId, { productId: "prod-1" });

      expect(prismaService.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            productId: "prod-1",
          }),
        }),
      );
    });

    it("should identify low stock correctly", async () => {
      const mockStocks = [
        {
          quantity: 5,
          reservedStock: 0,
          minimumStock: 10,
          product: {},
          warehouse: {},
        },
      ];

      prismaService.stock.findMany.mockResolvedValue(mockStocks);

      const result = await service.getStock(tenantId, {});

      expect(result[0].isLowStock).toBe(true);
      expect(result[0].isCriticalStock).toBe(true);
    });
  });

  describe("updateStock", () => {
    it("should update stock quantity successfully", async () => {
      const existingStock = {
        id: "stock-1",
        tenantId,
        productId: "prod-1",
        warehouseId: "wh-1",
        quantity: 100,
        reservedStock: 10,
        minimumStock: 20,
        product: { name: "Tomate" },
      };

      const updateDto = {
        productId: "prod-1",
        warehouseId: "wh-1",
        quantity: 150,
      };

      prismaService.stock.findFirst.mockResolvedValue(existingStock);
      prismaService.stock.update.mockResolvedValue({
        ...existingStock,
        quantity: 150,
      });
      prismaService.alert.create.mockResolvedValue({});

      const result = await service.updateStock(tenantId, updateDto);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Stock updated successfully");
    });

    it("should throw NotFoundException when stock not found", async () => {
      prismaService.stock.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStock(tenantId, {
          productId: "nonexistent",
          warehouseId: "wh-1",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException when reserving more than available", async () => {
      const existingStock = {
        id: "stock-1",
        quantity: 100,
        reservedStock: 50,
      };

      prismaService.stock.findFirst.mockResolvedValue(existingStock);

      await expect(
        service.updateStock(tenantId, {
          productId: "prod-1",
          warehouseId: "wh-1",
          reservedStock: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("reserveStock", () => {
    it("should reserve stock successfully", async () => {
      const existingStock = {
        id: "stock-1",
        tenantId,
        productId: "prod-1",
        quantity: 100,
        reservedStock: 20,
      };

      prismaService.stock.findFirst.mockResolvedValue(existingStock);
      prismaService.stock.update.mockResolvedValue({
        ...existingStock,
        reservedStock: 50,
      });

      const result = await service.reserveStock(tenantId, "prod-1", 30, "wh-1");

      expect(result.success).toBe(true);
      expect(result.message).toBe("Stock reserved successfully");
      expect(prismaService.stock.update).toHaveBeenCalledWith({
        where: { id: "stock-1" },
        data: { reservedStock: 50 },
      });
    });

    it("should throw NotFoundException when stock not found", async () => {
      prismaService.stock.findFirst.mockResolvedValue(null);

      await expect(
        service.reserveStock(tenantId, "nonexistent", 10),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException when insufficient stock", async () => {
      const existingStock = {
        id: "stock-1",
        quantity: 100,
        reservedStock: 80,
      };

      prismaService.stock.findFirst.mockResolvedValue(existingStock);

      await expect(
        service.reserveStock(tenantId, "prod-1", 50),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("releaseStock", () => {
    it("should release stock successfully", async () => {
      const existingStock = {
        id: "stock-1",
        tenantId,
        reservedStock: 50,
      };

      prismaService.stock.findFirst.mockResolvedValue(existingStock);
      prismaService.stock.update.mockResolvedValue({
        ...existingStock,
        reservedStock: 30,
      });

      const result = await service.releaseStock(tenantId, "stock-1", 20);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Stock released successfully");
    });

    it("should not go below zero when releasing more than reserved", async () => {
      const existingStock = {
        id: "stock-1",
        tenantId,
        reservedStock: 10,
      };

      prismaService.stock.findFirst.mockResolvedValue(existingStock);
      prismaService.stock.update.mockResolvedValue({
        ...existingStock,
        reservedStock: 0,
      });

      await service.releaseStock(tenantId, "stock-1", 50);

      expect(prismaService.stock.update).toHaveBeenCalledWith({
        where: { id: "stock-1" },
        data: { reservedStock: 0 },
      });
    });

    it("should throw NotFoundException when stock not found", async () => {
      prismaService.stock.findFirst.mockResolvedValue(null);

      await expect(
        service.releaseStock(tenantId, "nonexistent", 10),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("createStockMovement", () => {
    it("should create entrance movement successfully", async () => {
      const movementDto = {
        productId: "prod-1",
        warehouseId: "wh-1",
        type: "ENTRANCE",
        quantity: 50,
        unit: "kg",
        reason: "Compra proveedor",
        reference: "ALB-123",
      };

      const mockMovement = {
        id: "mov-1",
        ...movementDto,
        tenantId,
        createdAt: new Date(),
      };

      const existingStock = {
        id: "stock-1",
        quantity: 100,
      };

      prismaService.stockMovement.create.mockResolvedValue(mockMovement);
      prismaService.stock.findFirst.mockResolvedValue(existingStock);
      prismaService.stock.update.mockResolvedValue({});

      const result = await service.createStockMovement(tenantId, movementDto);

      expect(result.success).toBe(true);
      expect(result.data.type).toBe("ENTRANCE");
      expect(result.message).toBe("Stock movement recorded successfully");
    });

    it("should create exit movement when stock available", async () => {
      const movementDto = {
        productId: "prod-1",
        warehouseId: "wh-1",
        type: "EXIT",
        quantity: 30,
        unit: "kg",
        reason: "Uso en cocina",
      };

      const mockMovement = {
        id: "mov-1",
        ...movementDto,
        tenantId,
      };

      const stocks = [{ quantity: 100, reservedStock: 10 }];

      const existingStock = {
        id: "stock-1",
        quantity: 100,
      };

      prismaService.stock.findMany.mockResolvedValue(stocks);
      prismaService.stockMovement.create.mockResolvedValue(mockMovement);
      prismaService.stock.findFirst.mockResolvedValue(existingStock);
      prismaService.stock.update.mockResolvedValue({});

      const result = await service.createStockMovement(tenantId, movementDto);

      expect(result.success).toBe(true);
    });

    it("should throw BadRequestException for exit with insufficient stock", async () => {
      const movementDto = {
        productId: "prod-1",
        type: "EXIT",
        quantity: 100,
        unit: "kg",
      };

      const stocks = [{ quantity: 50, reservedStock: 30 }];

      prismaService.stock.findMany.mockResolvedValue(stocks);

      await expect(
        service.createStockMovement(tenantId, movementDto),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
