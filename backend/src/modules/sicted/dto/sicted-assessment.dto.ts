import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export class CreateAssessmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label: string;
}

export const SICTED_ASSESSMENT_RESULTS = ["CUMPLE", "NO_CUMPLE"] as const;
export type SictedAssessmentResult = (typeof SICTED_ASSESSMENT_RESULTS)[number];

/**
 * Valorar una práctica — SICTED 2026: Cumple / No cumple, con "No aplica"
 * como casilla separada (si está marcada, `result` se ignora). La metodología
 * 2026 no fija escala numérica; la 1-5 solo queda en autoevaluaciones legado.
 */
export class UpsertScoreDto {
  @ValidateIf((o) => !o.notApplicable)
  @IsIn(SICTED_ASSESSMENT_RESULTS)
  result?: SictedAssessmentResult;

  @IsOptional()
  @IsBoolean()
  notApplicable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  evidenceNote?: string;
}
