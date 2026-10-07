import { IsISO8601, IsInt, IsOptional, Min } from "class-validator";

/**
 * Congelar una etiqueta ya emitida, cualquier día mientras siga activa y el
 * producto no hubiera caducado en la fecha de congelación.
 */
export class FreezeFoodLabelDto {
  /** Cuándo se congeló de verdad (puede registrarse tarde). Por defecto, ahora. */
  @IsOptional()
  @IsISO8601()
  frozenAt?: string;

  /** Días de vida útil en congelado; si falta, los de la receta/artículo. */
  @IsOptional()
  @IsInt()
  @Min(1)
  shelfLifeFrozenDays?: number;
}
