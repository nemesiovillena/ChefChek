import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { LABEL_TYPES } from "../constants/storage-condition.constant";

export class ListFoodLabelsDto {
  @IsOptional()
  @IsIn(LABEL_TYPES as unknown as string[])
  labelType?: (typeof LABEL_TYPES)[number];

  @IsOptional()
  @IsString()
  recipeId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  /** Búsqueda parcial por nº de lote. */
  @IsOptional()
  @IsString()
  lotNumber?: string;

  /** Rango contra `preparedAt`. */
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value === "true" : value,
  )
  @IsBoolean()
  includeVoided?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
