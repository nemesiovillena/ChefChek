import {
  IsString,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
} from "class-validator";

export class CreateUnitOfMeasureDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string; // "Kilogramo", "Litro", "Unidad", "Docena"

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  symbol: string; // "kg", "L", "und", "doc"
}

export class UpdateUnitOfMeasureDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  symbol?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
