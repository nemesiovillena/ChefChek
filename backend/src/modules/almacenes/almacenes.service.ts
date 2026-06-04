import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  CreateStockMovementDto,
  StockDto,
  CreateInventoryDto,
  InventoryItemDto,
  StockQueryDto,
  InventoryDifferenceDto,
} from "./dto/almacenes.dto";

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  // Gestión de Almacenes
  async createWarehouse(tenantId: string, dto: CreateWarehouseDto) {
    const warehouse = await this.prisma.warehouse.create({
      data: {
        tenantId,
        ...dto,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    return {
      success: true,
      data: warehouse,
      message: "Warehouse created successfully",
    };
  }

  async getWarehouses(tenantId: string): Promise<any[]> {
    return await this.prisma.warehouse.findMany({
      where: { tenantId },
      include: {
        stocks: {
          include: { product: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  async getWarehouseById(warehouseId: string, tenantId: string): Promise<any> {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId },
      include: {
        stocks: {
          include: { product: true },
        },
        movements: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    if (!warehouse) {
      throw new NotFoundException("Warehouse not found");
    }

    // Calcular stock total
    const totalStock = warehouse.stocks.reduce(
      (sum, stock) => sum + stock.quantity,
      0,
    );
    const totalCapacity = warehouse.capacity || 0;
    const utilizationRate =
      totalCapacity > 0 ? (totalStock / totalCapacity) * 100 : 0;

    return {
      success: true,
      data: {
        ...warehouse,
        statistics: {
          totalStock,
          totalCapacity,
          utilizationRate: Math.min(utilizationRate, 100),
          productCount: warehouse.stocks.length,
        },
      },
    };
  }

  async updateWarehouse(
    warehouseId: string,
    tenantId: string,
    dto: UpdateWarehouseDto,
  ): Promise<any> {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId },
    });

    if (!warehouse) {
      throw new NotFoundException("Warehouse not found");
    }

    const updated = await this.prisma.warehouse.update({
      where: { id: warehouseId },
      data: dto as any,
    });

    return {
      success: true,
      data: updated,
      message: "Warehouse updated successfully",
    };
  }

  async deleteWarehouse(warehouseId: string, tenantId: string): Promise<any> {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId },
      include: { stocks: true },
    });

    if (!warehouse) {
      throw new NotFoundException("Warehouse not found");
    }

    if (warehouse.stocks.length > 0) {
      throw new BadRequestException(
        "Cannot delete warehouse with active stock records. Please transfer or clear stock first.",
      );
    }

    await this.prisma.warehouse.delete({
      where: { id: warehouseId },
    });

    return {
      success: true,
      message: "Warehouse deleted successfully",
    };
  }

  // Control de Stock
  async getStock(tenantId: string, query: StockQueryDto): Promise<any[]> {
    const where: any = { tenantId };

    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.includeLowStock) {
      where.quantity = { lte: this.prisma.stock.fields.minimumStock };
    }

    const stocks = await this.prisma.stock.findMany({
      where,
      include: {
        product: true,
        warehouse: true,
      },
      orderBy: { quantity: "asc" },
    });

    // Filtrar reservados si se solicita
    const result =
      query.includeReserved !== false
        ? stocks
        : stocks.filter((s) => s.quantity > s.reservedStock);

    // Calcular stock disponible
    const stocksWithAvailability = result.map((stock) => ({
      ...stock,
      availableQuantity: Math.max(0, stock.quantity - stock.reservedStock),
      isLowStock: stock.quantity <= stock.minimumStock,
      isCriticalStock: stock.quantity <= stock.minimumStock * 0.5,
    }));

    return stocksWithAvailability;
  }

  async updateStock(tenantId: string, dto: StockDto): Promise<any> {
    const stock = await this.prisma.stock.findFirst({
      where: {
        productId: dto.productId,
        warehouseId: dto.warehouseId,
      },
      include: { product: true },
    });

    if (!stock) {
      throw new NotFoundException("Stock not found");
    }

    // Verificar si estamos intentando reservar más de lo disponible
    if (dto.reservedStock !== undefined) {
      const availableQuantity = stock.quantity - stock.reservedStock;
      const newReservedStock = dto.reservedStock;

      if (newReservedStock > availableQuantity) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${availableQuantity}, Requested: ${newReservedStock}`,
        );
      }
    }

    const updatedStock = await this.prisma.stock.update({
      where: { id: stock.id },
      data: {
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.reservedStock !== undefined && {
          reservedStock: dto.reservedStock,
        }),
        ...(dto.minimumStock !== undefined && {
          minimumStock: dto.minimumStock,
        }),
        ...(dto.maximumStock !== undefined && {
          maximumStock: dto.maximumStock,
        }),
        ...(dto.reorderLevel !== undefined && {
          reorderLevel: dto.reorderLevel,
        }),
        lastUpdated: new Date(),
      },
    });

    // Verificar si hay alertas de stock bajo
    if (dto.quantity !== undefined) {
      await this.checkLowStockAlert(updatedStock);
    }

    return {
      success: true,
      data: updatedStock,
      message: "Stock updated successfully",
    };
  }

  async reserveStock(
    tenantId: string,
    productId: string,
    quantity: number,
    warehouseId?: string,
  ): Promise<any> {
    const where: any = {
      productId,
      tenantId,
    };

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    const stock = await this.prisma.stock.findFirst({
      where,
    });

    if (!stock) {
      throw new NotFoundException("Stock not found");
    }

    const availableQuantity = stock.quantity - stock.reservedStock;

    if (availableQuantity < quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${availableQuantity}, Requested: ${quantity}`,
      );
    }

    const updated = await this.prisma.stock.update({
      where: { id: stock.id },
      data: {
        reservedStock: stock.reservedStock + quantity,
      },
    });

    return {
      success: true,
      data: updated,
      message: "Stock reserved successfully",
    };
  }

  async releaseStock(
    tenantId: string,
    stockId: string,
    quantity: number,
  ): Promise<any> {
    const stock = await this.prisma.stock.findFirst({
      where: { id: stockId, tenantId },
    });

    if (!stock) {
      throw new NotFoundException("Stock not found");
    }

    const newReservedStock = Math.max(0, stock.reservedStock - quantity);

    const updated = await this.prisma.stock.update({
      where: { id: stock.id },
      data: {
        reservedStock: newReservedStock,
      },
    });

    return {
      success: true,
      data: updated,
      message: "Stock released successfully",
    };
  }

  // Movimientos de Stock
  async createStockMovement(
    tenantId: string,
    dto: CreateStockMovementDto,
  ): Promise<any> {
    // Verificar stock disponible para salidas
    if (dto.type === "EXIT") {
      await this.verifyStockAvailability(
        dto.productId,
        dto.quantity,
        dto.warehouseId,
      );
    }

    const movement = await this.prisma.stockMovement.create({
      data: dto as any,
    });

    // Actualizar stock correspondiente
    await this.updateStockFromMovement(movement);

    return {
      success: true,
      data: movement,
      message: "Stock movement recorded successfully",
    };
  }

  async getStockMovements(
    tenantId: string,
    filters?: {
      productId?: string;
      warehouseId?: string;
      type?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<any[]> {
    const where: any = {
      product: {
        tenantId,
      },
    };

    if (filters?.productId) {
      where.productId = filters.productId;
    }

    if (filters?.warehouseId) {
      where.warehouseId = filters.warehouseId;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        (where.createdAt as any).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.createdAt as any).lte = filters.endDate;
      }
    }

    return await this.prisma.stockMovement.findMany({
      where,
      include: {
        product: true,
        warehouse: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async getStockMovementsByDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const movements = await this.getStockMovements(tenantId, {
      startDate,
      endDate,
    });

    // Agrupar por tipo
    const summary = movements.reduce((acc, movement) => {
      if (!acc[movement.type]) {
        acc[movement.type] = { count: 0, quantity: 0 };
      }
      acc[movement.type].count++;
      acc[movement.type].quantity += movement.quantity;
      return acc;
    }, {});

    return {
      success: true,
      data: {
        movements,
        summary,
        total: movements.length,
        dateRange: { startDate, endDate },
      },
    };
  }

  // Inventarios
  async createInventory(
    tenantId: string,
    dto: CreateInventoryDto,
  ): Promise<any> {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, tenantId },
    });

    if (!warehouse) {
      throw new NotFoundException("Warehouse not found");
    }

    const inventory = await (this.prisma as any).inventory.create({
      data: {
        tenantId,
        warehouseId: dto.warehouseId,
        name: dto.name,
        notes: dto.notes,
        status: "PENDING",
        createdBy: tenantId,
        createdAt: new Date(),
      },
    });

    return {
      success: true,
      data: inventory,
      message: "Inventory created successfully",
    };
  }

  async getInventories(tenantId: string): Promise<any[]> {
    return await (this.prisma as any).inventory.findMany({
      where: { tenantId },
      include: {
        warehouse: true,
        items: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async addInventoryItem(
    inventoryId: string,
    tenantId: string,
    dto: InventoryItemDto,
  ): Promise<any> {
    const inventory = await (this.prisma as any).inventory.findFirst({
      where: { id: inventoryId, tenantId },
    });

    if (!inventory) {
      throw new NotFoundException("Inventory not found");
    }

    const item = await (this.prisma as any).inventoryItem.create({
      data: {
        inventoryId,
        productId: dto.productId,
        quantity: dto.quantity,
        unit: dto.unit,
        theoreticalQuantity: dto.theoreticalQuantity,
        notes: dto.notes,
        condition: dto.condition || "GOOD",
        actualQuantity: dto.quantity, // Inicialmente el actual es igual al reportado
        difference: dto.theoreticalQuantity
          ? dto.quantity - dto.theoreticalQuantity
          : 0,
        createdAt: new Date(),
      },
    });

    return {
      success: true,
      data: item,
      message: "Inventory item added successfully",
    };
  }

  async updateInventoryItem(
    itemId: string,
    tenantId: string,
    quantity: number,
    notes?: string,
    condition?: string,
  ): Promise<any> {
    const item = await (this.prisma as any).inventoryItem.findFirst({
      where: { id: itemId },
      include: { inventory: true },
    });

    if (!item || item.inventory.tenantId !== tenantId) {
      throw new NotFoundException("Inventory item not found");
    }

    const theoreticalQuantity = item.theoreticalQuantity || 0;
    const difference = quantity - theoreticalQuantity;

    const updated = await (this.prisma as any).inventoryItem.update({
      where: { id: itemId },
      data: {
        actualQuantity: quantity,
        difference,
        notes,
        ...(condition && { condition }),
      },
    });

    return {
      success: true,
      data: updated,
      message: "Inventory item updated successfully",
    };
  }

  async completeInventory(inventoryId: string, tenantId: string): Promise<any> {
    const inventory = await (this.prisma as any).inventory.findFirst({
      where: { id: inventoryId, tenantId },
      include: {
        items: true,
        warehouse: true,
      },
    });

    if (!inventory) {
      throw new NotFoundException("Inventory not found");
    }

    // Calcular diferencias
    const items = inventory.items.filter((item: any) => item.difference !== 0);

    // Actualizar el inventario
    const updatedInventory = await (this.prisma as any).inventory.update({
      where: { id: inventoryId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    // Crear reporte de diferencias
    const report = {
      totalItems: inventory.items.length,
      itemsWithDifferences: items.length,
      totalDiscrepancy: items.reduce(
        (sum, item) => sum + Math.abs(item.difference),
        0,
      ),
      items: items.map((item: any) => ({
        productId: item.productId,
        theoretical: item.theoreticalQuantity,
        actual: item.actualQuantity,
        difference: item.difference,
        percentageDifference: item.theoreticalQuantity
          ? (item.difference / item.theoreticalQuantity) * 100
          : 0,
      })),
    };

    return {
      success: true,
      data: updatedInventory,
      report,
      message: "Inventory completed successfully",
    };
  }

  private async verifyStockAvailability(
    productId: string,
    quantity: number,
    warehouseId?: string,
  ): Promise<void> {
    const where: any = {
      productId,
    };

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    const stocks = await this.prisma.stock.findMany({
      where,
    });

    const totalAvailable = stocks.reduce(
      (sum, stock) => sum + (stock.quantity - stock.reservedStock),
      0,
    );

    if (totalAvailable < quantity) {
      throw new BadRequestException(
        `Insufficient stock. Total Available: ${totalAvailable}, Requested: ${quantity}`,
      );
    }
  }

  private async updateStockFromMovement(movement: any): Promise<void> {
    const stock = await this.prisma.stock.findFirst({
      where: {
        productId: movement.productId,
        warehouseId: movement.warehouseId,
      },
    });

    if (!stock) {
      // Crear stock si no existe
      await this.prisma.stock.create({
        data: {
          tenantId: movement.tenantId,
          productId: movement.productId,
          warehouseId: movement.warehouseId,
          quantity: movement.type === "ENTRANCE" ? movement.quantity : 0,
          minimumStock: 0,
          maximumStock: null,
          reorderLevel: 0,
        },
      });
      return;
    }

    const newQuantity =
      movement.type === "ENTRANCE"
        ? stock.quantity + movement.quantity
        : stock.quantity - movement.quantity;

    await this.prisma.stock.update({
      where: { id: stock.id },
      data: {
        quantity: Math.max(0, newQuantity),
        lastUpdated: new Date(),
      },
    });
  }

  private async checkLowStockAlert(stock: any): Promise<void> {
    if (stock.quantity <= stock.minimumStock) {
      await (this.prisma as any).alert.create({
        data: {
          tenantId: stock.tenantId,
          type: "STOCK",
          alertType: "STOCK_LOW",
          severity:
            stock.quantity <= stock.minimumStock * 0.5 ? "HIGH" : "MEDIUM",
          message: `Low stock alert for product ID ${stock.productId} in warehouse ${stock.warehouseId}. Current: ${stock.quantity}, Minimum: ${stock.minimumStock}`,
          isResolved: false,
          createdBy: "system",
        } as any,
      });
    }
  }
}
