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

  @IsString()
  elaboration: string; // TipTap JSON

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
}
