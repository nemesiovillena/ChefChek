import {
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from "class-validator";
import { CAPTURE_UNITS } from "../recipe-structuring.service";

/** Solo se cambian los campos presentes; null los vacía. */
export class UpdateCaptureIngredientDto {
  /** Artículo vinculado; null para quitar el vínculo. */
  @IsOptional()
  @IsString()
  matchedProductId?: string | null;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number | null;

  @IsOptional()
  @IsIn(CAPTURE_UNITS)
  unit?: string | null;
}
