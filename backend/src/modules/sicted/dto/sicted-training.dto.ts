import { Type } from "class-transformer";
import {
  IsDate,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export const TRAINING_TOPICS = [
  "ATENCION_CLIENTE",
  "IDIOMAS",
  "SOSTENIBILIDAD",
  "ALERGENOS",
  "HIGIENE",
  "OTRO",
] as const;
export type TrainingTopic = (typeof TRAINING_TOPICS)[number];

export const TRAINING_PLAN_STATUSES = ["DRAFT", "ACTIVE", "CLOSED"] as const;
export type TrainingPlanStatus = (typeof TRAINING_PLAN_STATUSES)[number];

export class CreateTrainingPlanDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;
}

export class UpdateTrainingPlanStatusDto {
  @IsIn(TRAINING_PLAN_STATUSES)
  status: TrainingPlanStatus;
}

export class CreateTrainingActionDto {
  @IsIn(TRAINING_TOPICS)
  topic: TrainingTopic;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @Type(() => Date)
  @IsDate()
  plannedDate: Date;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  hours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  trainer?: string;
}

/**
 * Un asistente del lote — llega como JSON dentro de un campo de formulario
 * multipart (el certificado, si lo hay, es un archivo en el mismo POST), así
 * que se valida a mano en el servicio en vez de con `ValidationPipe` (mismo
 * criterio pragmático que `createRecord` de fase 4 para cuerpos multipart).
 */
export interface AttendanceBatchEntry {
  userId: string;
  attended: boolean;
}
