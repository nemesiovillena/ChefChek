import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  Min,
  Max,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsPositive,
} from "class-validator";

// DTO para crear almacén
export class CreateWarehouseDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  capacity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  conservationZone?: string; // FROZEN, REFRIGERATED, DRY_GOODS, AMBIENT

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// DTO para actualizar almacén
export class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  conservationZone?: string;
}

// DTO para movimiento de stock
export class CreateStockMovementDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsString()
  @IsNotEmpty()
  type: string; // ENTRANCE, EXIT, ADJUSTMENT

  @IsNumber()
  quantity: number;

  @IsString()
  @IsNotEmpty()
  unit: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string; // Número de albarán, orden de compra, etc.
}

// DTO para stock
export class StockDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsNumber()
  reservedStock?: number;

  @IsOptional()
  @IsNumber()
  minimumStock?: number;

  @IsOptional()
  @IsNumber()
  maximumStock?: number;

  @IsOptional()
  @IsNumber()
  reorderLevel?: number;
}

// DTO para inventario
export class CreateInventoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @IsString()
  @MaxLength(500)
  notes?: string;
}

// DTO para item de inventario
export class InventoryItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  quantity: number;

  @IsString()
  @IsNotEmpty()
  unit: string;

  @IsOptional()
  @IsNumber()
  theoreticalQuantity?: number; // Stock teórico esperado

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  condition?: string; // GOOD, DAMAGED, EXPIRED
}

// DTO para consulta de stock
export class StockQueryDto {
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsBoolean()
  includeLowStock?: boolean;

  @IsOptional()
  @IsBoolean()
  includeReserved?: boolean;
}

// DTO para reporte de diferencias de inventario
export class InventoryDifferenceDto {
  @IsString()
  inventoryId: string;
  @IsArray()
  @IsString({ each: true })
  itemIds: string[];
}
