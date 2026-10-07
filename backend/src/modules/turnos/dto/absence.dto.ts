import { Type } from "class-transformer";
import {
  IsBoolean,
  IsHexColor,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateAbsenceDto {
  /** Solo gerencia: de quién es la ausencia. En las rutas `me` se ignora. */
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsString()
  absenceTypeId: string;

  @Matches(DATE, { message: "startDate debe ser AAAA-MM-DD." })
  startDate: string;

  @Matches(DATE, { message: "endDate debe ser AAAA-MM-DD." })
  endDate: string;

  @IsOptional()
  @IsBoolean()
  halfDay?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class DecideAbsenceDto {
  @IsBoolean()
  approve: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CancelAbsenceDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AbsenceRangeQueryDto {
  @Matches(DATE, { message: "from debe ser AAAA-MM-DD." })
  from: string;

  @Matches(DATE, { message: "to debe ser AAAA-MM-DD." })
  to: string;
}

export class YearQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;
}

export class SaveAbsenceTypeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsBoolean()
  deductsVacation?: boolean;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsBoolean()
  employeeCanRequest?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SaveLeaveBalanceDto {
  @IsNumber()
  @Min(0)
  @Max(366)
  entitledDays: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(366)
  carriedOverDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(-366)
  @Max(366)
  adjustmentDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CreateHolidayDto {
  @Matches(DATE, { message: "date debe ser AAAA-MM-DD." })
  date: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  /** Sin centro, el festivo vale para todos. */
  @IsOptional()
  @IsString()
  locationId?: string;
}
