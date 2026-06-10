import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: "Nombre de la categoría" })
  name: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: "Slug único para URLs" })
  slug: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: "Descripción de la categoría" })
  description?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: "Icono (emoji o nombre)" })
  icon?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: "Color en formato HEX para UI" })
  color?: string;

  @IsBoolean()
  @IsOptional()
  @ApiPropertyOptional({ description: "Está activa?" })
  isActive?: boolean;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: "Categoría padre para jerarquía" })
  parentId?: string;
}

export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: "Nombre de la categoría" })
  name?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: "Slug único para URLs" })
  slug?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: "Descripción de la categoría" })
  description?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: "Icono (emoji o nombre)" })
  icon?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: "Color en formato HEX para UI" })
  color?: string;

  @IsBoolean()
  @IsOptional()
  @ApiPropertyOptional({ description: "Está activa?" })
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  @ApiPropertyOptional({ description: "Orden de visualización" })
  sortOrder?: number;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: "Categoría padre para jerarquía" })
  parentId?: string;
}

export class CategoryDto {
  @ApiProperty({ description: "ID de la categoría" })
  id: string;

  @ApiProperty({ description: "ID del tenant" })
  tenantId: string;

  @ApiProperty({ description: "Nombre de la categoría" })
  name: string;

  @ApiProperty({ description: "Slug único para URLs" })
  slug: string;

  @ApiPropertyOptional({ description: "Descripción de la categoría" })
  description?: string;

  @ApiPropertyOptional({ description: "Icono (emoji o nombre)" })
  icon?: string;

  @ApiPropertyOptional({ description: "Color en formato HEX para UI" })
  color?: string;

  @ApiProperty({ description: "Orden de visualización" })
  sortOrder: number;

  @ApiProperty({ description: "Está activa?" })
  isActive: boolean;

  @ApiPropertyOptional({ description: "Categoría padre para jerarquía" })
  parentId?: string;

  @ApiProperty({ description: "Fecha de creación" })
  createdAt: Date;

  @ApiProperty({ description: "Fecha de actualización" })
  updatedAt: Date;

  @ApiPropertyOptional({ description: "Productos en esta categoría" })
  productCount?: number;

  @ApiPropertyOptional({ description: "Recetas en esta categoría" })
  recipeCount?: number;

  @ApiPropertyOptional({ description: "Categorías hijas" })
  children?: CategoryDto[];
}
