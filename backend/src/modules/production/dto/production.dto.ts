import {
  IsString,
  IsEnum,
  IsArray,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDate,
} from "class-validator";

enum BatchStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

enum BatchPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

enum KitchenZone {
  HOT_KITCHEN = "HOT_KITCHEN",
  COLD_KITCHEN = "COLD_KITCHEN",
  PASTRY_KITCHEN = "PASTRY_KITCHEN",
  GRILL_STATION = "GRILL_STATION",
  FRYING_STATION = "FRYING_STATION",
  PLATING_STATION = "PLATING_STATION",
  SERVICE_STATION = "SERVICE_STATION",
}

enum OrderStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
}

enum ItemStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  READY = "READY",
  VERIFIED = "VERIFIED",
}

enum ChecklistCategory {
  EQUIPMENT = "EQUIPMENT",
  INGREDIENTS = "INGREDIENTS",
  TOOLS = "TOOLS",
  SANITATION = "SANITATION",
}

enum TaskType {
  PREPARATION = "PREPARATION",
  COOKING = "COOKING",
  PLATING = "PLATING",
  QUALITY_CHECK = "QUALITY_CHECK",
}

enum TaskStatus {
  ASSIGNED = "ASSIGNED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  ON_HOLD = "ON_HOLD",
}

enum AlertType {
  DELAY = "DELAY",
  QUALITY = "QUALITY",
  STAFFING = "STAFFING",
  EQUIPMENT = "EQUIPMENT",
  INGREDIENTS = "INGREDIENTS",
}

enum ProgressStatus {
  ON_SCHEDULE = "ON_SCHEDULE",
  DELAYED = "DELAYED",
  AHEAD = "AHEAD",
  CRITICAL = "CRITICAL",
}

export class CreateWorkBatchDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDate()
  scheduledDate: Date;

  @IsString()
  scheduledTime: string;

  @IsEnum(BatchPriority)
  priority: BatchPriority;

  @IsArray()
  @IsString({ each: true })
  responsible: string[];

  @IsEnum(KitchenZone)
  kitchenZone: KitchenZone;
}

export class CreateProductionOrderDto {
  @IsString()
  batchId: string;

  @IsString()
  recipeId: string;

  @IsString()
  recipeName: string;

  @IsNumber()
  quantity: number;

  @IsString()
  unit: string;

  @IsNumber()
  estimatedTime: number;

  @IsArray()
  ingredients: ProductionIngredientDto[];
}

export class ProductionIngredientDto {
  @IsString()
  productId: string;

  @IsString()
  productName: string;

  @IsNumber()
  quantity: number;

  @IsString()
  unit: string;

  @IsBoolean()
  isAvailable: boolean;
}

export class CreateMiseEnPlaceItemDto {
  @IsString()
  orderId: string;

  @IsString()
  description: string;

  @IsNumber()
  quantity: number;

  @IsString()
  unit: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateMiseEnPlaceSheetDto {
  @IsString()
  batchId: string;

  @IsString()
  orderId: string;

  @IsEnum(KitchenZone)
  zone: KitchenZone;

  @IsArray()
  checklists: CreateChecklistItemDto[];
}

export class CreateChecklistItemDto {
  @IsString()
  item: string;

  @IsString()
  description: string;

  @IsEnum(ChecklistCategory)
  category: ChecklistCategory;
}

export class CreateTaskAssignmentDto {
  @IsString()
  batchId: string;

  @IsString()
  orderId: string;

  @IsString()
  taskId: string;

  @IsString()
  assignedTo: string;

  @IsEnum(TaskType)
  taskType: TaskType;

  @IsNumber()
  estimatedTime: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependencies?: string[];
}

export class UpdateTaskAssignmentDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsNumber()
  actualTime?: number;
}

export class UpdateAlertDto {
  @IsOptional()
  @IsString()
  resolvedBy?: string;

  @IsOptional()
  @IsString()
  resolution?: string;
}

export class GenerateProductionReportDto {
  @IsDate()
  startDate: Date;

  @IsDate()
  endDate: Date;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  batchIds?: string[];

  @IsOptional()
  @IsEnum(KitchenZone)
  zone?: KitchenZone;
}
