import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  Min,
  Max,
  ValidateNested,
  IsObject,
} from "class-validator";
import { Type } from "class-transformer";

class IngredientDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsNumber()
  quantity: number;

  @IsString()
  unit: string;
}

class SubRecipeDto {
  @IsString()
  subRecipeId: string;

  @IsNumber()
  quantity: number;

  @IsString()
  unit: string;
}

export class CreateRecipeDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  elaboration?: string; // JSON de pasos: {"steps":[{description, equipment, time, temperature}]}

  @IsOptional()
  @IsNumber()
  @Min(1)
  portions?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  portionSize?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredientDto)
  ingredients?: IngredientDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubRecipeDto)
  subRecipes?: SubRecipeDto[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  allergens?: number[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // PVP sin IVA, manual — base para calcular margen bruto en el escandallo
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPrice?: number;

  // % de coste objetivo propio de esta receta; sin valor usa el global de Configuración
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  targetCostPercentageOverride?: number;
}
