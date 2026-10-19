import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

/** Puesto de trabajo (Cocinero, Camarero, Barra, Sala 2…). */
export class SaveTeamPositionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;
}

/** Puesto vigente de una persona; `null` o ausente = sin puesto. */
export class SetUserPositionDto {
  @IsOptional()
  @IsString()
  positionId?: string | null;
}

/** Qué apartados ve el puesto: `{ 'recipes.drinks': false, ... }`. */
export class UpdatePositionAccessDto {
  @IsObject()
  access: Record<string, boolean>;
}
