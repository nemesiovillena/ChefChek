import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDate,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateChecklistMaintenancePlanDto {
  @IsString()
  assetId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsInt()
  @Min(1)
  @Max(60)
  periodicityMonths: number;

  /** Próxima revisión; si se omite, se calcula a `periodicityMonths` desde hoy. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  nextDueAt?: Date;

  @IsOptional()
  @IsBoolean()
  externalProvider?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  responsible?: string;
}

export class UpdateChecklistMaintenancePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  periodicityMonths?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  nextDueAt?: Date;

  @IsOptional()
  @IsBoolean()
  externalProvider?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  responsible?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateChecklistMaintenanceRecordDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  performedAt?: Date;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  performedByName: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  providerName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
