import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

export class CreateAssessmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label: string;
}

/**
 * Puntuar una práctica — escala real del manual: 1 a 5, sin decimales.
 * `notApplicable` es una casilla SEPARADA (no un valor de puntuación como
 * "6=NA"); si está marcada, `score` no aplica y se ignora.
 */
export class UpsertScoreDto {
  @ValidateIf((o) => !o.notApplicable)
  @IsInt()
  @Min(1)
  @Max(5)
  score?: number;

  @IsOptional()
  @IsBoolean()
  notApplicable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  evidenceNote?: string;
}
