import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

/** Muestra de satisfacción (CLI.4) — append-only. */
export class CreateSatisfactionSampleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  channel: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  recordedByName: string;
}
