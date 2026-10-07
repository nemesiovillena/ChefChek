import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export const REPORT_FORMATS = ["pdf", "xlsx", "csv"] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export class ReportQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsIn(REPORT_FORMATS)
  format: ReportFormat;

  /** Sin él, el informe incluye a todas las personas con fichajes ese mes. */
  @IsOptional()
  @IsString()
  employeeId?: string;
}

export class CreateInspectionLinkDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsInt()
  @Min(2020)
  @Max(2100)
  fromYear: number;

  @IsInt()
  @Min(1)
  @Max(12)
  fromMonth: number;

  @IsInt()
  @Min(2020)
  @Max(2100)
  toYear: number;

  @IsInt()
  @Min(1)
  @Max(12)
  toMonth: number;

  @IsInt()
  @Min(1)
  @Max(60)
  validDays: number;
}
