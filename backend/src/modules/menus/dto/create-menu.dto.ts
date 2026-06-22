import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsDateString,
  IsBoolean,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class MenuItemDto {
  @IsString()
  recipeId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number; // Si no se proporciona, usa precio de receta

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

class MenuSectionDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  order: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemDto)
  items: MenuItemDto[];
}

class MenuTranslationDto {
  @IsString()
  language: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  sectionsTranslations?: Record<string, string>; // Map sectionId -> translated name
}

export class CreateMenuDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  portions?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuSectionDto)
  sections: MenuSectionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuTranslationDto)
  translations?: MenuTranslationDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
