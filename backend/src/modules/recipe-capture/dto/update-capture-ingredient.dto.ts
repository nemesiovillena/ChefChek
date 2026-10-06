import { IsString, ValidateIf } from "class-validator";

export class UpdateCaptureIngredientDto {
  /** Artículo vinculado; null para quitar el vínculo. */
  @ValidateIf(
    (dto: UpdateCaptureIngredientDto) => dto.matchedProductId !== null,
  )
  @IsString()
  matchedProductId: string | null;
}
