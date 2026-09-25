import {
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";

const ORIGINS = ["ASSESSMENT", "EVALUATOR", "COMPLAINT", "INCIDENT", "OTHER"];
const STATUSES = ["OPEN", "DONE", "CANCELLED"];

export class CreateImprovementActionDto {
  @IsIn(ORIGINS)
  origin: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceRef?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  responsibleName?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDate?: Date;
}

/**
 * `closedAt` ("fecha de implantación") solo se puede poner una vez — el
 * trigger `forbid_milestone_rewrite` en BD rechaza reescribirlo; aquí solo
 * se valida el formato, no el estado.
 */
export class UpdateImprovementActionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  responsibleName?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDate?: Date;

  @IsOptional()
  @IsIn(STATUSES)
  status?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  closedAt?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  evidenceNote?: string;
}
