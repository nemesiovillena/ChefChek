import { Type } from "class-transformer";
import {
  IsDate,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export const CHECKLIST_INCIDENT_KINDS = [
  "BREAKDOWN",
  "CORRECTIVE_ACTION",
] as const;
export type ChecklistIncidentKind = (typeof CHECKLIST_INCIDENT_KINDS)[number];

export const CHECKLIST_INCIDENT_STATUSES = [
  "OPEN",
  "NOTIFIED",
  "RESOLVED",
] as const;
export type ChecklistIncidentStatus =
  (typeof CHECKLIST_INCIDENT_STATUSES)[number];

/**
 * Un solo DTO para los dos formularios reales (Ins-Bas.16 y PAC) — más simple
 * que dos clases polimórficas; el servicio exige los campos propios de cada
 * `kind` (ver checklist-incident.service.ts), la validación aquí solo cubre
 * tipos/longitudes.
 */
export class CreateChecklistIncidentDto {
  @IsIn(CHECKLIST_INCIDENT_KINDS)
  kind: ChecklistIncidentKind;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  detectedByName: string;

  // BREAKDOWN (Ins-Bas.16):
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reportedTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  faultType?: string;

  // CORRECTIVE_ACTION (PAC):
  @IsOptional()
  @IsString()
  @MaxLength(200)
  processOrEquipment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  deviationDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  deviationCause?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  responsibleName?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  deadline?: Date;

  // Solo cuando sean alimentos (opcionales, solo CORRECTIVE_ACTION):
  @IsOptional()
  @IsString()
  @MaxLength(100)
  affectedLot?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  affectedProductName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  affectedQuantity?: number;
}

/**
 * PATCH: avanza hitos (fecha/hora null→valor, el trigger lo hace cumplir),
 * status, notas y campos aún no rellenados en la creación. Todo opcional.
 */
export class UpdateChecklistIncidentDto {
  @IsOptional()
  @IsIn(CHECKLIST_INCIDENT_STATUSES)
  status?: ChecklistIncidentStatus;

  // BREAKDOWN — hitos:
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reportedTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  faultType?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  technicianNotifiedAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  serviceStartedAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  serviceEndedAt?: Date;

  // Compartido:
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  resolvedAt?: Date;

  // CORRECTIVE_ACTION:
  @IsOptional()
  @IsString()
  @MaxLength(200)
  correctiveMeasure?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolution?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  deadline?: Date;
}
