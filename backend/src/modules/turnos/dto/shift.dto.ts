import {
  IsBoolean,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
import { TIME_PATTERN } from "../services/shift-time.util";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_MSG = { message: "La hora debe tener formato HH:MM." };

export class ScheduleQueryDto {
  @IsString()
  locationId: string;

  /** Lunes de la semana, AAAA-MM-DD. */
  @Matches(DATE, { message: "weekStart debe ser AAAA-MM-DD." })
  weekStart: string;
}

export class CreateShiftDto {
  @IsString()
  locationId: string;

  /** Sin empleado (o null) es un turno abierto, por cubrir. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  employeeId?: string | null;

  @Matches(DATE, { message: "date debe ser AAAA-MM-DD." })
  date: string;

  @Matches(TIME_PATTERN, TIME_MSG)
  startTime: string;

  @Matches(TIME_PATTERN, TIME_MSG)
  endTime: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600)
  breakMinutes?: number;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class UpdateShiftDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  employeeId?: string | null;

  @IsOptional()
  @Matches(DATE, { message: "date debe ser AAAA-MM-DD." })
  date?: string;

  @IsOptional()
  @Matches(TIME_PATTERN, TIME_MSG)
  startTime?: string;

  @IsOptional()
  @Matches(TIME_PATTERN, TIME_MSG)
  endTime?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600)
  breakMinutes?: number;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class CopyWeekDto {
  @IsString()
  locationId: string;

  @Matches(DATE, { message: "fromWeekStart debe ser AAAA-MM-DD." })
  fromWeekStart: string;

  @Matches(DATE, { message: "toWeekStart debe ser AAAA-MM-DD." })
  toWeekStart: string;
}

export class PublishWeekDto extends ScheduleQueryDto {}

export class SaveShiftTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  name: string;

  @Matches(TIME_PATTERN, TIME_MSG)
  startTime: string;

  @Matches(TIME_PATTERN, TIME_MSG)
  endTime: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600)
  breakMinutes?: number;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class OwnShiftsQueryDto {
  @Matches(DATE, { message: "from debe ser AAAA-MM-DD." })
  from: string;

  @Matches(DATE, { message: "to debe ser AAAA-MM-DD." })
  to: string;
}
