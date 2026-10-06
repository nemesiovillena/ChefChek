import { PunchAdjustmentKind, PunchType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class WorkdaysQueryDto {
  @Matches(DATE, { message: "from debe ser AAAA-MM-DD." })
  from: string;

  @Matches(DATE, { message: "to debe ser AAAA-MM-DD." })
  to: string;

  /** Solo gerencia: de quién. En las rutas `me` se ignora. */
  @IsOptional()
  @IsString()
  employeeId?: string;
}

export class MonthQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;
}

/** Mes de una persona concreta (consulta de gerencia). */
export class EmployeeMonthQueryDto extends MonthQueryDto {
  @IsString()
  employeeId: string;
}

export class CreateAdjustmentDto {
  @IsEnum(PunchAdjustmentKind)
  kind: PunchAdjustmentKind;

  /** Solo gerencia: a quién corrige. En las rutas `me` se ignora. */
  @IsOptional()
  @IsString()
  employeeId?: string;

  /** Fichaje al que afecta (anular, sustituir, dar por bueno). */
  @IsOptional()
  @IsString()
  targetPunchId?: string;

  /** Tipo del fichaje que se añade o que sustituye al anulado. */
  @IsOptional()
  @IsEnum(PunchType)
  type?: PunchType;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  occurredAt?: Date;

  /** Motivo: obligatorio, queda en el registro. */
  @IsString()
  @MinLength(5, { message: "Explica el motivo de la corrección." })
  @MaxLength(500)
  reason: string;
}

export class DecideAdjustmentDto {
  @IsBoolean()
  approve: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ApproveTimesheetDto extends MonthQueryDto {
  @IsString()
  employeeId: string;

  /** Obligatorio al volver a aprobar un mes ya aprobado. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reopenReason?: string;
}
