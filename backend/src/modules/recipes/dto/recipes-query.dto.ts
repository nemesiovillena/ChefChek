import { IsIn, IsNumber, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";

export class RecipesQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  /** Pestaña del listado: recetas de comida (por defecto) o de bebida. */
  @IsOptional()
  @IsString()
  @IsIn(["food", "drink"])
  kind?: "food" | "drink";

  @IsOptional()
  @IsString()
  @IsIn(["name", "createdAt"])
  sortBy?: "name" | "createdAt";

  @IsOptional()
  @IsString()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc";

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;
}
