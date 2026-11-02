import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const MAX_PORTIONS = 100_000;

export class CreatePortionCounterDto {
  @IsOptional()
  @IsString()
  recipeId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  /** Por defecto, el nombre de la receta o del artículo. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_PORTIONS)
  minPortions?: number;
}

export class UpdatePortionCounterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_PORTIONS)
  minPortions?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class LinkPortionDishDto {
  /** P plato o M menú (CuinerSaleLine.tipo). */
  @IsIn(["P", "M", "I"])
  tipo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  producto!: string;

  /** Raciones que gasta cada unidad vendida (media ración = 0,5). */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100)
  portionsPerSale?: number;

  /** Cuiner lo vende al peso: cada venta resta una pieza, no los kilos. */
  @IsOptional()
  @IsBoolean()
  perPiece?: boolean;
}

export class AdjustPortionsDto {
  /** + entra, − sale. */
  @IsNumber()
  @Min(-MAX_PORTIONS)
  @Max(MAX_PORTIONS)
  delta!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason!: string;
}

export class RecountPortionsDto {
  /** Raciones que hay de verdad. */
  @IsNumber()
  @Min(0)
  @Max(MAX_PORTIONS)
  actual!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
