import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateClosedWeekdaysDto {
  /** 0=domingo..6=sábado. */
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  closedWeekdays: number[];
}

export class CreateCalendarExceptionDto {
  @IsIn(["CLOSED", "OPEN"])
  kind: "CLOSED" | "OPEN";

  @Matches(DAY_KEY)
  fromDay: string;

  @Matches(DAY_KEY)
  toDay: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class JustifyClosedDayRunsDto {
  /** Quién justifica, si la sesión es una cuenta compartida. */
  @IsOptional()
  @IsString()
  supervisorUserId?: string;
}
