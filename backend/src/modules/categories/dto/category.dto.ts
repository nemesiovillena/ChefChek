import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsIn,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

const CATEGORY_CONTEXTS = ["articles", "recipes"] as const;
type CategoryContext = (typeof CATEGORY_CONTEXTS)[number];

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
  @IsIn(CATEGORY_CONTEXTS)
  @ApiProperty({
    enum: CATEGORY_CONTEXTS,
    description: "Contexto: articles (inventario) o recipes (platos)",
  })
  context: CategoryContext;

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
  @IsIn(CATEGORY_CONTEXTS)
  @IsOptional()
  @ApiPropertyOptional({
    enum: CATEGORY_CONTEXTS,
    description: "Contexto: articles o recipes",
  })
  context?: CategoryContext;

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

  @ApiProperty({
    enum: CATEGORY_CONTEXTS,
    description: "Contexto: articles o recipes",
  })
  context: CategoryContext;

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
