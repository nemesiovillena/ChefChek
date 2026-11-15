import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { GESTION_EXPORT_FORMATS } from "../gestion-table.types";
import type { GestionExportFormat } from "../gestion-table.types";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export class GestionRangeDto {
  @Matches(ISO_DAY)
  from!: string;

  @Matches(ISO_DAY)
  to!: string;
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
