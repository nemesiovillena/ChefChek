import { VacationDayType } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from "class-validator";

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateCheckInSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2500)
  annualHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  weeklyHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24)
  maxDailyHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24)
  minRestBetweenShiftsHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(7)
  weeklyRestDays?: number;

  @IsOptional()
  @IsString()
  @Matches(HH_MM, { message: "nightStart debe tener formato HH:MM." })
  nightStart?: string;

  @IsOptional()
  @IsString()
  @Matches(HH_MM, { message: "nightEnd debe tener formato HH:MM." })
  nightEnd?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  vacationDays?: number;

  @IsOptional()
  @IsEnum(VacationDayType)
  vacationDayType?: VacationDayType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  overtimeYearlyCap?: number;

  @IsOptional()
  @IsBoolean()
  breaksCountAsWork?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(48)
  autoCloseAfterHours?: number;

  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(6)
  pinLength?: number;

  @IsOptional()
  @IsBoolean()
  allowBreaks?: boolean;

  @IsOptional()
  @IsBoolean()
  showRecentPunches?: boolean;

  @IsOptional()
  @IsBoolean()
  showMonthPicker?: boolean;

  @IsOptional()
  @IsBoolean()
  showOwnAdjustments?: boolean;

  @IsOptional()
  @IsBoolean()
  showAddMissingDay?: boolean;
}

export class ApplyAgreementPresetDto {
  @IsString()
  agreementKey: string;
}
