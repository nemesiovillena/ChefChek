import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";
import { SICTED_CYCLE_PHASES } from "../constants/sicted-cycle-commitments";

/** Edición de una práctica del catálogo por el tenant (título, obligatoriedad). */
export class UpdateSictedPracticeDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;
}

/** Módulos complementarios que aplican (claves de grupo de la Guía de configuración). */
export class UpdateSictedComplementaryGroupsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  groupKeys: string[];
}

/** Fase del ciclo de distinción y comité (Configuración → SICTED). `null` borra el valor. */
export class UpdateSictedCycleDto {
  @IsOptional()
  @IsIn([...SICTED_CYCLE_PHASES, null])
  cyclePhase?: string | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  phaseStartedAt?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  nextCommitteeDate?: Date | null;
}
