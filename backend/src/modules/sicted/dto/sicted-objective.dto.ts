import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const STATUSES = ["IN_PROGRESS", "ACHIEVED", "MISSED", "CANCELLED"];

export class CreateObjectiveDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  indicator?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  target?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentValue?: string;
}

export class UpdateObjectiveDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  indicator?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  target?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentValue?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: string;
}
