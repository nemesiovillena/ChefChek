import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  Max,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsPositive,
  IsBoolean,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class PurchaseFormatDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  format: string;

  @IsNumber()
  @IsPositive()
  price: number;
}

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

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  // Multi-unidad
  @IsString()
  @IsNotEmpty()
  purchaseUnit: string;

  @IsString()
  @IsNotEmpty()
  storageUnit: string;

  @IsString()
  @IsNotEmpty()
  recipeUnit: string;

  // Precios
  @IsNumber()
  @IsPositive()
  purchasePrice: number;

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

  // Formatos de compra
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseFormatDto)
  purchaseFormats?: PurchaseFormatDto[];

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
  purchaseUnit?: string;

  @IsOptional()
  @IsString()
  storageUnit?: string;

  @IsOptional()
  @IsString()
  recipeUnit?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
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
  @IsArray()
  @IsNumber({}, { each: true })
  allergens?: number[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

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

  // Formatos de compra
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseFormatDto)
  purchaseFormats?: PurchaseFormatDto[];

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
