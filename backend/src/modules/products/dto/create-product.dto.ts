import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsPositive,
  IsBoolean,
  ValidateNested,
  IsIn,
  IsDateString,
} from "class-validator";
import { Type } from "class-transformer";

export class NutritionalInfoDto {
  @IsOptional() @IsNumber() @Min(0) energyKj?: number;
  @IsOptional() @IsNumber() @Min(0) energyKcal?: number;
  @IsOptional() @IsNumber() @Min(0) fat?: number;
  @IsOptional() @IsNumber() @Min(0) saturatedFat?: number;
  @IsOptional() @IsNumber() @Min(0) transFat?: number;
  @IsOptional() @IsNumber() @Min(0) monounsaturatedFat?: number;
  @IsOptional() @IsNumber() @Min(0) polyunsaturatedFat?: number;
  @IsOptional() @IsNumber() @Min(0) omega3?: number;
  @IsOptional() @IsNumber() @Min(0) cholesterol?: number;
  @IsOptional() @IsNumber() @Min(0) carbohydrates?: number;
  @IsOptional() @IsNumber() @Min(0) sugars?: number;
  @IsOptional() @IsNumber() @Min(0) protein?: number;
  @IsOptional() @IsNumber() @Min(0) salt?: number;
}

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  lot?: string;

  // Unidad de referencia
  @IsOptional()
  @IsString()
  purchaseFormat?: string;

  @IsOptional()
  @IsString()
  referenceUnit?: string; // Validated against UnitOfMeasure table in service

  @IsOptional()
  @IsNumber()
  @Min(1)
  unitsPerFormat?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  referenceUnitSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  unitSize?: number; // Backward compat — auto-calculated from unitsPerFormat * referenceUnitSize

  // Precios
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  netPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  profitMargin?: number;

  // Rendimiento
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  wastePercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(2)
  yieldFactor?: number;

  // Prueba de rendimiento (Peso Bruto/Neto → deriva yieldFactor/wastePercentage) + ración
  @IsOptional()
  @IsNumber()
  @Min(0)
  grossWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  netWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  portionWeight?: number;

  // Alérgenos
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  allergens?: number[];

  // Campos extendidos
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  iva?: number;

  @IsOptional()
  @IsString()
  qr?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsBoolean()
  hideAllergens?: boolean;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  // Información nutricional
  @IsOptional()
  @ValidateNested()
  @Type(() => NutritionalInfoDto)
  nutritionalInfo?: NutritionalInfoDto;

  // Stock
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumStock?: number;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  lot?: string;

  @IsOptional()
  @IsString()
  purchaseFormat?: string;

  @IsOptional()
  @IsString()
  referenceUnit?: string; // Validated against UnitOfMeasure table in service

  @IsOptional()
  @IsNumber()
  @Min(1)
  unitsPerFormat?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  referenceUnitSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  unitSize?: number; // Backward compat — auto-calculated from unitsPerFormat * referenceUnitSize

  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  netPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  profitMargin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  wastePercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(2)
  yieldFactor?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  grossWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  netWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  portionWeight?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  allergens?: number[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Fecha de compra manual (editable desde el listado). null = limpiar.
  @IsOptional()
  @IsDateString()
  manualPurchaseDate?: string | null;

  // Campos extendidos
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  iva?: number;

  @IsOptional()
  @IsString()
  qr?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsBoolean()
  hideAllergens?: boolean;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  // Información nutricional
  @IsOptional()
  @ValidateNested()
  @Type(() => NutritionalInfoDto)
  nutritionalInfo?: NutritionalInfoDto;

  // Stock
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumStock?: number;
}

export class ProductsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(["low", "empty"])
  stockStatus?: "low" | "empty";

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: "asc" | "desc";

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
