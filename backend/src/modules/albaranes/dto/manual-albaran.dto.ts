import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsDateString,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class ManualAlbaranLineDto {
  @IsOptional()
  @IsString()
  productId?: string; // Existing product ID — null/empty = create new

  @IsString()
  @MinLength(1)
  name: string; // Product name (required even if productId given)

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsString()
  unit: string; // "kg", "L", "und", "ud"

  @IsNumber()
  @Min(0)
  price: number; // Price per format

  @IsOptional()
  @IsString()
  category?: string;

  // Id de categoría/subcategoría del catálogo; tiene prioridad sobre `category`
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  lot?: string;
}

export class ManualAlbaranDto {
  @IsOptional()
  @IsString()
  tenantId?: string; // Extracted from request context if not provided

  @IsOptional()
  @IsString()
  supplierId?: string; // Existing supplier ID (takes precedence)

  @IsOptional()
  @IsString()
  supplierName?: string; // Supplier name for auto-creation

  @IsOptional()
  @IsDateString()
  date?: string; // Defaults to today

  @IsOptional()
  @IsString()
  reference?: string; // Albaran reference number

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualAlbaranLineDto)
  lines: ManualAlbaranLineDto[];
}
