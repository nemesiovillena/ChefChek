import {
  IsString,
  IsEnum,
  IsArray,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDate,
} from "class-validator";

export enum TemperatureUnit {
  CELSIUS = "CELSIUS",
  FAHRENHEIT = "FAHRENHEIT",
}

export enum ControlType {
  CAMERA = "CAMERA",
  EQUIPMENT = "EQUIPMENT",
  PRODUCT = "PRODUCT",
}

export enum CleaningFrequency {
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
  QUARTERLY = "QUARTERLY",
}

export enum PestType {
  RATS = "RATS",
  INSECTS = "INSECTS",
  RODENTS = "RODENTS",
  BIRDS = "BIRDS",
}

export enum AlertSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export class CreateTemperatureControlDto {
  @IsString()
  type: ControlType;

  @IsString()
  location: string;

  @IsNumber()
  targetTemperature: number;

  @IsNumber()
  tolerance: number;

  @IsEnum(TemperatureUnit)
  unit: TemperatureUnit;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  responsible?: string;
}

export class RecordTemperatureDto {
  @IsNumber()
  temperature: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateCleaningPlanDto {
  @IsString()
  name: string;

  @IsEnum(CleaningFrequency)
  frequency: CleaningFrequency;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responsible?: string[];

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;
}

export class CreateCleaningTaskDto {
  @IsString()
  area: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  products?: string[];

  @IsOptional()
  @IsNumber()
  estimatedTime?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responsible?: string[];
}

export class CompleteCleaningTaskDto {
  @IsOptional()
  @IsString()
  verifiedBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePestControlDto {
  @IsString()
  company: string;

  @IsEnum(PestType)
  type: PestType;

  @IsDate()
  date: Date;

  @IsDate()
  nextDate: Date;

  @IsArray()
  @IsString({ each: true })
  products: string[];

  @IsArray()
  @IsString({ each: true })
  affectedAreas: string[];

  @IsString()
  responsible: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateGoodsReceptionDto {
  @IsString()
  supplierId: string;

  @IsNumber()
  temperatureOnReception: number;

  @IsNumber()
  acceptableTemperature: number;

  @IsString()
  lot: string;

  @IsDate()
  expiryDate: Date;

  @IsString()
  deliveryNote: string;

  @IsArray()
  products: Array<{
    productId: string;
    quantity: number;
    unit: string;
    temperature: number;
  }>;

  @IsString()
  signedBy: string;

  @IsString()
  verifiedBy: string;

  @IsOptional()
  @IsString()
  observations?: string;
}

export class CreateAlertDto {
  @IsEnum(AlertSeverity)
  severity: AlertSeverity;

  @IsString()
  type: "TEMPERATURE" | "CLEANING" | "APPCC" | "PEST";

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsDate()
  dueDate?: Date;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignees?: string[];
}

export class UpdateAlertDto {
  @IsOptional()
  @IsString()
  status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsString()
  resolvedBy?: string;
}

export class GenerateComplianceReportDto {
  @IsEnum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY"])
  period: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY";

  @IsDate()
  startDate: Date;

  @IsDate()
  endDate: Date;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  controlTypes?: string[];
}
