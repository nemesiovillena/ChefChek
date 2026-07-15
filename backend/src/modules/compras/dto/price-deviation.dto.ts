import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { PriceDeviationStatus } from "@prisma/client";

export class PriceDeviationsQueryDto {
  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsEnum(PriceDeviationStatus)
  status?: PriceDeviationStatus;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}

export class UpdatePriceDeviationDto {
  @IsEnum(PriceDeviationStatus)
  status: PriceDeviationStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdatePriceToleranceDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  tolerancePercent: number;
}
