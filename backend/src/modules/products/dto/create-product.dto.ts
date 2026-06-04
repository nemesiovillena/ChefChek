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
  IsIn,
} from "class-validator";

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
  purchaseUnit: string; // UC: Caja 10kg, Bote 300uds

  @IsString()
  @IsNotEmpty()
  storageUnit: string; // UA: Kilogramos, Litros

  @IsString()
  @IsNotEmpty()
  recipeUnit: string; // UR: Gramos, Mililitros

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
  @IsArray()
  @IsNumber({}, { each: true })
  allergens?: number[];
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
