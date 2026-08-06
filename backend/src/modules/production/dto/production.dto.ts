import {
  IsString,
  IsEnum,
  IsArray,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDate,
  IsEmail,
} from "class-validator";
import { Type } from "class-transformer";

export enum BatchPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum KitchenZone {
  HOT_KITCHEN = "HOT_KITCHEN",
  COLD_KITCHEN = "COLD_KITCHEN",
  PASTRY_KITCHEN = "PASTRY_KITCHEN",
  GRILL_STATION = "GRILL_STATION",
  FRYING_STATION = "FRYING_STATION",
  PLATING_STATION = "PLATING_STATION",
  SERVICE_STATION = "SERVICE_STATION",
}

enum ChecklistCategory {
  EQUIPMENT = "EQUIPMENT",
  INGREDIENTS = "INGREDIENTS",
  TOOLS = "TOOLS",
  SANITATION = "SANITATION",
}

export enum TaskType {
  PREPARATION = "PREPARATION",
  COOKING = "COOKING",
  PLATING = "PLATING",
  QUALITY_CHECK = "QUALITY_CHECK",
}

export enum TaskAssignmentStatus {
  ASSIGNED = "ASSIGNED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  ON_HOLD = "ON_HOLD",
}

export class CreateWorkBatchDto {
  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Date)
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

export class CreateProductionTaskDto {
  @IsString()
  orderId: string;

  @IsString()
  title: string;

  @IsEnum(TaskType)
  taskType: TaskType;

  @IsNumber()
  estimatedTime: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependencies?: string[];
}

export class CreateTaskAssignmentDto {
  @IsString()
  orderId: string;

  @IsString()
  taskId: string;

  @IsString()
  assignedTo: string;
}

export class UpdateTaskAssignmentDto {
  @IsOptional()
  @IsEnum(TaskAssignmentStatus)
  status?: TaskAssignmentStatus;

  @IsOptional()
  @IsNumber()
  actualTime?: number;
}

export class CreateStaffMemberDto {
  @IsString()
  name: string;

  @IsString()
  role: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsNumber()
  availableHours?: number;

  @IsOptional()
  @IsNumber()
  maxTasks?: number;
}

export class UpdateStaffMemberDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  availableHours?: number;

  @IsOptional()
  @IsNumber()
  maxTasks?: number;
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
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @Type(() => Date)
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
