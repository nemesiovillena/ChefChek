import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  Min,
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

  // PVP con IVA, manual — PVP sin IVA se deriva dividiendo entre 1,10 (IVA hostelería 10%)
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPriceWithVat?: number;
}
