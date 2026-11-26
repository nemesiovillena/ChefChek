import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { GESTION_EXPORT_FORMATS } from "../gestion-table.types";
import { EXPENSE_CATEGORIES } from "../gestion-expenses.service";
import type { GestionExportFormat } from "../gestion-table.types";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export class GestionRangeDto {
  @Matches(ISO_DAY)
  from!: string;

  @Matches(ISO_DAY)
  to!: string;
}

export class GestionMenuEngineeringQueryDto extends GestionRangeDto {
  @IsOptional()
  @IsIn(["comida", "bebida"])
  scope?: "comida" | "bebida";

  @IsOptional()
  @IsString()
  @MaxLength(120)
  group?: string;

  /** 1 = 100 % de la media; 0,7 = regla clásica del 70 %. */
  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 0.7])
  popularityFactor?: number;
}

export class GestionDashboardQueryDto extends GestionRangeDto {
  @IsOptional()
  @IsIn(["previous", "year"])
  compare?: "previous" | "year";
}

/** Parámetros de cualquier informe; cada uno usa los suyos. */
export class GestionReportQueryDto {
  @IsOptional()
  @Matches(ISO_DAY)
  from?: string;

  @IsOptional()
  @Matches(ISO_DAY)
  to?: string;

  @IsOptional()
  @IsIn(["total", "units"])
  by?: "total" | "units";

  @IsOptional()
  @IsIn(["desc", "asc"])
  order?: "desc" | "asc";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(10)
  years?: number;

  @IsOptional()
  @IsIn(["day", "month", "dish", "total", "supplier", "category"])
  groupBy?: "day" | "month" | "dish" | "total" | "supplier" | "category";
}

export class GestionReportExportQueryDto extends GestionReportQueryDto {
  @IsIn(GESTION_EXPORT_FORMATS)
  format!: GestionExportFormat;
}

export class GestionTicketsQueryDto extends GestionRangeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsIn([10, 25, 50, 100])
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}

export class GestionYearDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;
}

export class GestionSeedDatesDto extends GestionYearDto {
  @IsIn(["nacional", "villena"])
  region!: "nacional" | "villena";
}

export class GestionCalendarDateDto {
  @Matches(ISO_DAY)
  date!: string;

  @IsString()
  @MaxLength(80)
  name!: string;

  @IsIn(["nacional", "autonomico", "local", "comercial", "propio"])
  kind!: string;
}

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export class GestionExpenseDto {
  @Matches(YEAR_MONTH)
  month!: string;

  @IsIn(EXPENSE_CATEGORIES)
  category!: string;

  @IsString()
  @MaxLength(120)
  concept!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-1_000_000)
  @Max(1_000_000)
  amount!: number;
}

export class GestionExpenseUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  concept?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-1_000_000)
  @Max(1_000_000)
  amount?: number;
}

export class GestionCopyExpensesDto {
  @Matches(YEAR_MONTH)
  from!: string;

  @Matches(YEAR_MONTH)
  to!: string;
}
