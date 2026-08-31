import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import {
  LABEL_TYPES,
  STORAGE_CONDITIONS,
} from "../constants/storage-condition.constant";

/** Un ingrediente directo de la receta con el lote declarado al etiquetar. */
export class IngredientLotDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  productName!: string;

  /** Id de un `Lot` registrado, si el usuario eligió uno. */
  @IsOptional()
  @IsString()
  lotId?: string;

  /** Nº de lote (texto libre / snapshot). "" o "SIN ESPECIFICAR" permitido. */
  @IsString()
  lotNumber!: string;

  @IsOptional()
  @IsNumber()
  quantityUsed?: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class CreateFoodLabelDto {
  @IsIn(LABEL_TYPES as unknown as string[])
  labelType!: (typeof LABEL_TYPES)[number];

  /** Requerido si labelType === ELABORATED. */
  @IsOptional()
  @IsString()
  recipeId?: string;

  /** Requerido si labelType === HANDLED. */
  @IsOptional()
  @IsString()
  productId?: string;

  /** HANDLED: `Lot` de proveedor del que sale el artículo manipulado. */
  @IsOptional()
  @IsString()
  sourceLotId?: string;

  /**
   * HANDLED: nº de lote en texto libre cuando no hay `Lot` registrado
   * (`sourceLotId`). Si se pasa `sourceLotId`, este campo se ignora y se toma
   * el del `Lot`.
   */
  @IsOptional()
  @IsString()
  lotNumber?: string;

  /** Vínculo opcional (sin picker en v1, aceptado a nivel de API). */
  @IsOptional()
  @IsString()
  productionOrderId?: string;

  /** Fecha/hora de elaboración o de manipulación. Por defecto: ahora. */
  @IsOptional()
  @IsISO8601()
  preparedAt?: string;

  /** HANDLED: caducidad original del fabricante. */
  @IsOptional()
  @IsISO8601()
  manufacturerExpiryDate?: string;

  /**
   * Consumo preferente explícito. Obligatorio solo si no hay días de vida útil
   * (ni en la entidad ni en el override) para poder calcularlo.
   */
  @IsOptional()
  @IsISO8601()
  useByDate?: string;

  /** Si se marca, se congela: `frozenAt` (por defecto ahora) y cálculo congelado. */
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value === "true" : value,
  )
  @IsBoolean()
  freeze?: boolean;

  @IsOptional()
  @IsISO8601()
  frozenAt?: string;

  // ── Overrides puntuales de conservación / vida útil ────────────────────
  @IsOptional()
  @IsIn(STORAGE_CONDITIONS as unknown as string[])
  storageCondition?: (typeof STORAGE_CONDITIONS)[number];

  @IsOptional()
  @IsNumber()
  storageTempMin?: number;

  @IsOptional()
  @IsNumber()
  storageTempMax?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  shelfLifeDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  shelfLifeFrozenDays?: number;

  // ── Contenido ─────────────────────────────────────────────────────────
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsString()
  quantityUnit?: string;

  @IsOptional()
  @IsNumber()
  portions?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Solo ELABORATED: lotes de los ingredientes directos. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredientLotDto)
  ingredientLots?: IngredientLotDto[];
}
