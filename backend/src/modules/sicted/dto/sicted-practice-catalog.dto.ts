import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

/** Práctica del catálogo (BP1-BP6 del manual real) — editable/ampliable por el tenant. */
export class CreateSictedPracticeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code: string;

  @IsInt()
  @Min(1)
  @Max(6)
  bpSection: number;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  bpSectionName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;
}

export class UpdateSictedPracticeDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;
}
