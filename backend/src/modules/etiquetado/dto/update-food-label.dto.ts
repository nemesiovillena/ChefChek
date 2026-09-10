import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { Transform } from "class-transformer";
import { STORAGE_CONDITIONS } from "../constants/storage-condition.constant";

/**
 * Corrección de una etiqueta el mismo día, antes de reimprimirla. Solo campos
 * que no rompen la trazabilidad: fechas, conservación, congelado, cantidad,
 * raciones y notas. Para cambiar tipo, artículo, receta, lote o alérgenos hay
 * que anular y crear una nueva. Todos los campos son opcionales: se aplican
 * los que vengan y se recalcula el consumo preferente.
 */
export class UpdateFoodLabelDto {
  @IsOptional()
  @IsISO8601()
  preparedAt?: string;

  @IsOptional()
  @IsISO8601()
  manufacturerExpiryDate?: string;

  @IsOptional()
  @IsISO8601()
  useByDate?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value === "true" : value,
  )
  @IsBoolean()
  freeze?: boolean;

  @IsOptional()
  @IsISO8601()
  frozenAt?: string;

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
}
