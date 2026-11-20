import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
  ArrayMaxSize,
} from "class-validator";

export class LabelPrintStepDto {
  /** Milisegundos desde que empezó el intento. */
  @IsInt()
  @Min(0)
  t!: number;

  @IsString()
  @MaxLength(60)
  step!: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class CreateLabelPrintLogDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  foodLabelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  format?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  copies?: number;

  @IsIn(["OK", "ERROR"])
  outcome!: "OK" | "ERROR";

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  errorMessage?: string;

  @IsOptional()
  @IsBoolean()
  calibrated?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceUid?: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LabelPrintStepDto)
  steps!: LabelPrintStepDto[];
}
