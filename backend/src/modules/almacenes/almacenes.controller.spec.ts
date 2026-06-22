import { Test, TestingModule } from "@nestjs/testing";
import { AlmacenesController } from "./almacenes.controller";
import { WarehousesService } from "./almacenes.service";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";

describe("AlmacenesController", () => {
  let controller: AlmacenesController;

  const mockWarehousesService = {
    createWarehouse: jest.fn(),
    getWarehouses: jest.fn(),
    getWarehouseById: jest.fn(),
    updateWarehouse: jest.fn(),
    deleteWarehouse: jest.fn(),
    getStock: jest.fn(),
    updateStock: jest.fn(),
    reserveStock: jest.fn(),
    releaseStock: jest.fn(),
    createStockMovement: jest.fn(),
    getStockMovements: jest.fn(),
    getStockMovementsByDateRange: jest.fn(),
    createInventory: jest.fn(),
    getInventories: jest.fn(),
    addInventoryItem: jest.fn(),
    updateInventoryItem: jest.fn(),
    completeInventory: jest.fn(),
  };

  const mockReq = {
    tenantId: "tenant-1",
    user: { id: "user-1", role: "ADMIN" },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlmacenesController],
      providers: [
        { provide: WarehousesService, useValue: mockWarehousesService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AlmacenesController>(AlmacenesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createWarehouse", () => {
    it("should create a warehouse successfully", async () => {
      const dto = {
        name: "Warehouse 1",
        location: "Location A",
        capacity: 1000,
        conservationZone: "DRY_GOODS",
        isActive: true,
      };
      const expectedResult = {
        success: true,
        data: { id: "warehouse-1", ...dto },
        message: "Warehouse created successfully",
      };

      mockWarehousesService.createWarehouse.mockResolvedValue(expectedResult);

      const result = await controller.createWarehouse(mockReq, dto);

      expect(result).toEqual(expectedResult);
      expect(mockWarehousesService.createWarehouse).toHaveBeenCalledWith(
        mockReq.tenantId,
        dto,
      );
    });

    it("should create warehouse with minimal data", async () => {
      const dto = { name: "Minimal Warehouse" };
      const expectedResult = {
        success: true,
        data: { id: "warehouse-2", name: dto.name, isActive: true },
        message: "Warehouse created successfully",
      };

      mockWarehousesService.createWarehouse.mockResolvedValue(expectedResult);

      const result = await controller.createWarehouse(mockReq, dto);

      expect(result.success).toBe(true);
    });
  });

  describe("getWarehouses", () => {
    it("should return all warehouses for tenant", async () => {
      const warehouses = [
        { id: "warehouse-1", name: "Warehouse 1", stocks: [] },
        { id: "warehouse-2", name: "Warehouse 2", stocks: [] },
      ];

      mockWarehousesService.getWarehouses.mockResolvedValue(warehouses);

      const result = await controller.getWarehouses(mockReq);

      expect(result).toEqual(warehouses);
      expect(mockWarehousesService.getWarehouses).toHaveBeenCalledWith(
        mockReq.tenantId,
      );
    });

    it("should return empty array if no warehouses", async () => {
      mockWarehousesService.getWarehouses.mockResolvedValue([]);

      const result = await controller.getWarehouses(mockReq);

      expect(result).toEqual([]);
    });
  });

  describe("getWarehouseById", () => {
    it("should return warehouse by ID with statistics", async () => {
      const warehouseId = "warehouse-1";
      const expectedResult = {
        success: true,
        data: {
          id: warehouseId,
          name: "Warehouse 1",
          stocks: [],
          movements: [],
          statistics: {
            totalStock: 100,
            totalCapacity: 1000,
            utilizationRate: 10,
            productCount: 5,
          },
        },
      };

      mockWarehousesService.getWarehouseById.mockResolvedValue(expectedResult);

      const result = await controller.getWarehouseById(mockReq, warehouseId);

      expect(result).toEqual(expectedResult);
      expect(mockWarehousesService.getWarehouseById).toHaveBeenCalledWith(
        warehouseId,
        mockReq.tenantId,
      );
    });

    it("should handle warehouse not found", async () => {
      const warehouseId = "non-existent";

      mockWarehousesService.getWarehouseById.mockRejectedValue(
        new Error("Warehouse not found"),
      );

      await expect(
        controller.getWarehouseById(mockReq, warehouseId),
      ).rejects.toThrow("Warehouse not found");
    });
  });

  describe("updateWarehouse", () => {
    it("should update warehouse successfully", async () => {
      const warehouseId = "warehouse-1";
      const dto = { name: "Updated Warehouse", capacity: 2000 };
      const expectedResult = {
        success: true,
        data: { id: warehouseId, ...dto },
        message: "Warehouse updated successfully",
      };

      mockWarehousesService.updateWarehouse.mockResolvedValue(expectedResult);

      const result = await controller.updateWarehouse(
        mockReq,
        warehouseId,
        dto,
      );

      expect(result).toEqual(expectedResult);
      expect(mockWarehousesService.updateWarehouse).toHaveBeenCalledWith(
        warehouseId,
        mockReq.tenantId,
        dto,
      );
    });
  });

  describe("deleteWarehouse", () => {
    it("should delete warehouse successfully", async () => {
      const warehouseId = "warehouse-1";
      const expectedResult = {
        success: true,
        message: "Warehouse deleted successfully",
      };

      mockWarehousesService.deleteWarehouse.mockResolvedValue(expectedResult);

      const result = await controller.deleteWarehouse(mockReq, warehouseId);

      expect(result).toEqual(expectedResult);
      expect(mockWarehousesService.deleteWarehouse).toHaveBeenCalledWith(
        warehouseId,
        mockReq.tenantId,
      );
    });

    it("should handle error when deleting warehouse with stock", async () => {
      const warehouseId = "warehouse-with-stock";

      mockWarehousesService.deleteWarehouse.mockRejectedValue(
        new Error("Cannot delete warehouse with active stock records"),
      );

      await expect(
        controller.deleteWarehouse(mockReq, warehouseId),
      ).rejects.toThrow("Cannot delete warehouse with active stock records");
    });
  });

  describe("getStock", () => {
    it("should return stock with query filters", async () => {
      const query = {
        warehouseId: "warehouse-1",
        productId: "product-1",
        includeLowStock: true,
        includeReserved: true,
      };
      const stocks = [
        {
          id: "stock-1",
          productId: "product-1",
          warehouseId: "warehouse-1",
          quantity: 50,
          availableQuantity: 40,
          isLowStock: false,
          isCriticalStock: false,
        },
      ];

      mockWarehousesService.getStock.mockResolvedValue(stocks);

      const result = await controller.getStock(mockReq, query);

      expect(result).toEqual(stocks);
      expect(mockWarehousesService.getStock).toHaveBeenCalledWith(
        mockReq.tenantId,
        query,
      );
    });

    it("should return all stock when no filters", async () => {
      const query = {};
      const stocks = [];

      mockWarehousesService.getStock.mockResolvedValue(stocks);

      const result = await controller.getStock(mockReq, query);

      expect(result).toEqual(stocks);
    });
  });

  describe("updateStock", () => {
    it("should update stock successfully", async () => {
      const dto = {
        productId: "product-1",
        warehouseId: "warehouse-1",
        quantity: 100,
        minimumStock: 10,
        maximumStock: 500,
      };
      const expectedResult = {
        success: true,
        data: { id: "stock-1", ...dto },
        message: "Stock updated successfully",
      };

      mockWarehousesService.updateStock.mockResolvedValue(expectedResult);

      const result = await controller.updateStock(mockReq, dto);

      expect(result).toEqual(expectedResult);
      expect(mockWarehousesService.updateStock).toHaveBeenCalledWith(
        mockReq.tenantId,
        dto,
      );
    });
  });

  describe("reserveStock", () => {
    it("should reserve stock successfully", async () => {
      const body = {
        productId: "product-1",
        quantity: 10,
        warehouseId: "warehouse-1",
      };
      const expectedResult = {
        success: true,
        data: { id: "stock-1", reservedStock: 10 },
        message: "Stock reserved successfully",
      };

      mockWarehousesService.reserveStock.mockResolvedValue(expectedResult);

      const result = await controller.reserveStock(mockReq, body);

      expect(result).toEqual(expectedResult);
      expect(mockWarehousesService.reserveStock).toHaveBeenCalledWith(
        mockReq.tenantId,
        body.productId,
        body.quantity,
        body.warehouseId,
      );
    });

    it("should reserve stock without specifying warehouse", async () => {
      const body = {
        productId: "product-1",
        quantity: 5,
      };
      const expectedResult = {
        success: true,
        data: { id: "stock-1", reservedStock: 5 },
        message: "Stock reserved successfully",
      };

      mockWarehousesService.reserveStock.mockResolvedValue(expectedResult);

      const result = await controller.reserveStock(mockReq, body);

      expect(mockWarehousesService.reserveStock).toHaveBeenCalledWith(
        mockReq.tenantId,
        body.productId,
        body.quantity,
        undefined,
      );
    });
  });

  describe("releaseStock", () => {
    it("should release reserved stock successfully", async () => {
      const body = {
        stockId: "stock-1",
        quantity: 5,
      };
      const expectedResult = {
        success: true,
        data: { id: "stock-1", reservedStock: 0 },
        message: "Stock released successfully",
      };

      mockWarehousesService.releaseStock.mockResolvedValue(expectedResult);

      const result = await controller.releaseStock(mockReq, body);

      expect(result).toEqual(expectedResult);
      expect(mockWarehousesService.releaseStock).toHaveBeenCalledWith(
        mockReq.tenantId,
        body.stockId,
        body.quantity,
      );
    });
  });

  describe("createStockMovement", () => {
    it("should create stock movement successfully", async () => {
      const dto = {
        productId: "product-1",
        warehouseId: "warehouse-1",
        type: "ENTRANCE",
        quantity: 50,
        unit: "kg",
        reason: "Purchase order",
        reference: "PO-123",
      };
      const expectedResult = {
        success: true,
        data: { id: "movement-1", ...dto },
        message: "Stock movement recorded successfully",
      };

      mockWarehousesService.createStockMovement.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.createStockMovement(mockReq, dto);

      expect(result).toEqual(expectedResult);
      expect(mockWarehousesService.createStockMovement).toHaveBeenCalledWith(
        mockReq.tenantId,
        dto,
      );
    });

    it("should create EXIT movement", async () => {
      const dto = {
        productId: "product-1",
        warehouseId: "warehouse-1",
        type: "EXIT",
        quantity: 20,
        unit: "kg",
        reason: "Production use",
      };
      const expectedResult = {
        success: true,
        data: { id: "movement-2", ...dto },
        message: "Stock movement recorded successfully",
      };

      mockWarehousesService.createStockMovement.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.createStockMovement(mockReq, dto);

      expect(result.success).toBe(true);
    });

    it("should create ADJUSTMENT movement", async () => {
      const dto = {
        productId: "product-1",
        type: "ADJUSTMENT",
        quantity: -5,
        unit: "kg",
        reason: "Inventory correction",
      };
      const expectedResult = {
        success: true,
        data: { id: "movement-3", ...dto },
        message: "Stock movement recorded successfully",
      };

      mockWarehousesService.createStockMovement.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.createStockMovement(mockReq, dto);

      expect(result.success).toBe(true);
    });
  });

  describe("getStockMovements", () => {
    it("should return stock movements with filters", async () => {
      const productId = "product-1";
      const warehouseId = "warehouse-1";
      const type = "ENTRANCE";
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-12-31");

      const movements = [
        {
          id: "movement-1",
          productId,
          warehouseId,
          type,
          quantity: 100,
          createdAt: new Date(),
        },
      ];

      mockWarehousesService.getStockMovements.mockResolvedValue(movements);

      const result = await controller.getStockMovements(
        mockReq,
        productId,
        warehouseId,
        type,
        startDate,
        endDate,
      );

      expect(result).toEqual(movements);
      expect(mockWarehousesService.getStockMovements).toHaveBeenCalledWith(
        mockReq.tenantId,
        {
          productId,
          warehouseId,
          type,
          startDate,
          endDate,
        },
      );
    });

    it("should return all movements when no filters", async () => {
      const movements = [];

      mockWarehousesService.getStockMovements.mockResolvedValue(movements);

      const result = await controller.getStockMovements(mockReq);

      expect(result).toEqual(movements);
      expect(mockWarehousesService.getStockMovements).toHaveBeenCalledWith(
        mockReq.tenantId,
        {
          productId: undefined,
          warehouseId: undefined,
          type: undefined,
          startDate: undefined,
          endDate: undefined,
        },
      );
    });
  });

  describe("getStockMovementsByDateRange", () => {
    it("should return movements grouped by date range", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-12-31");
      const expectedResult = {
        success: true,
        data: {
          movements: [],
          summary: {
            ENTRANCE: { count: 10, quantity: 500 },
            EXIT: { count: 8, quantity: 300 },
          },
          total: 18,
          dateRange: { startDate, endDate },
        },
      };

      mockWarehousesService.getStockMovementsByDateRange.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.getStockMovementsByDateRange(
        mockReq,
        startDate,
        endDate,
      );

      expect(result).toEqual(expectedResult);
      expect(
        mockWarehousesService.getStockMovementsByDateRange,
      ).toHaveBeenCalledWith(mockReq.tenantId, startDate, endDate);
    });
  });

  describe("createInventory", () => {
    it("should create inventory successfully", async () => {
      const dto = {
        name: "Annual Inventory 2024",
        warehouseId: "warehouse-1",
        notes: "Complete warehouse inventory",
      };
      const expectedResult = {
        success: true,
        data: { id: "inventory-1", ...dto, status: "PENDING" },
        message: "Inventory created successfully",
      };

      mockWarehousesService.createInventory.mockResolvedValue(expectedResult);

      const result = await controller.createInventory(mockReq, dto);

      expect(result).toEqual(expectedResult);
      expect(mockWarehousesService.createInventory).toHaveBeenCalledWith(
        mockReq.tenantId,
        dto,
      );
    });
  });

  describe("getInventories", () => {
    it("should return all inventories for tenant", async () => {
      const inventories = [
        {
          id: "inventory-1",
          name: "Inventory 1",
          warehouseId: "warehouse-1",
          status: "COMPLETED",
          items: [],
        },
        {
          id: "inventory-2",
          name: "Inventory 2",
          warehouseId: "warehouse-1",
          status: "PENDING",
          items: [],
        },
      ];

      mockWarehousesService.getInventories.mockResolvedValue(inventories);

      const result = await controller.getInventories(mockReq);

      expect(result).toEqual(inventories);
      expect(mockWarehousesService.getInventories).toHaveBeenCalledWith(
        mockReq.tenantId,
      );
    });
  });

  describe("addInventoryItem", () => {
    it("should add item to inventory successfully", async () => {
      const inventoryId = "inventory-1";
      const dto = {
        productId: "product-1",
        quantity: 50,
        unit: "kg",
        theoreticalQuantity: 55,
        notes: "Good condition",
        condition: "GOOD",
      };
      const expectedResult = {
        success: true,
        data: { id: "item-1", inventoryId, ...dto, difference: -5 },
        message: "Inventory item added successfully",
      };

      mockWarehousesService.addInventoryItem.mockResolvedValue(expectedResult);

      const result = await controller.addInventoryItem(
        mockReq,
        inventoryId,
        dto,
      );

      expect(result).toEqual(expectedResult);
      expect(mockWarehousesService.addInventoryItem).toHaveBeenCalledWith(
        inventoryId,
        mockReq.tenantId,
        dto,
      );
    });
  });

  describe("updateInventoryItem", () => {
    it("should update inventory item successfully", async () => {
      const itemId = "item-1";
      const body = {
        quantity: 48,
        notes: "Updated count",
        condition: "GOOD",
      };
      const expectedResult = {
        success: true,
        data: { id: itemId, ...body },
        message: "Inventory item updated successfully",
      };

      mockWarehousesService.updateInventoryItem.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.updateInventoryItem(
        mockReq,
        itemId,
        body,
      );

      expect(result).toEqual(expectedResult);
      expect(mockWarehousesService.updateInventoryItem).toHaveBeenCalledWith(
        itemId,
        mockReq.tenantId,
        body.quantity,
        body.notes,
        body.condition,
      );
    });

    it("should update inventory item without notes", async () => {
      const itemId = "item-1";
      const body = {
        quantity: 45,
        condition: "DAMAGED",
      };
      const expectedResult = {
        success: true,
        data: { id: itemId, ...body },
        message: "Inventory item updated successfully",
      };

      mockWarehousesService.updateInventoryItem.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.updateInventoryItem(
        mockReq,
        itemId,
        body,
      );

      expect(mockWarehousesService.updateInventoryItem).toHaveBeenCalledWith(
        itemId,
        mockReq.tenantId,
        body.quantity,
        undefined,
        body.condition,
      );
    });
  });

  describe("completeInventory", () => {
    it("should complete inventory and generate report", async () => {
      const inventoryId = "inventory-1";
      const expectedResult = {
        success: true,
        data: {
          id: inventoryId,
          status: "COMPLETED",
          completedAt: new Date(),
        },
        report: {
          totalItems: 10,
          itemsWithDifferences: 3,
          totalDiscrepancy: 15,
          items: [],
        },
        message: "Inventory completed successfully",
      };

      mockWarehousesService.completeInventory.mockResolvedValue(expectedResult);

      const result = await controller.completeInventory(mockReq, inventoryId);

      expect(result).toEqual(expectedResult);
      expect(mockWarehousesService.completeInventory).toHaveBeenCalledWith(
        inventoryId,
        mockReq.tenantId,
      );
    });

    it("should handle inventory not found error", async () => {
      const inventoryId = "non-existent";

      mockWarehousesService.completeInventory.mockRejectedValue(
        new Error("Inventory not found"),
      );

      await expect(
        controller.completeInventory(mockReq, inventoryId),
      ).rejects.toThrow("Inventory not found");
    });
  });
});
