import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class SmtpConfigDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  host: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  user?: string;

  // Solo se envía al crear/cambiar; nunca se devuelve en GET
  @IsOptional()
  @IsString()
  @MaxLength(255)
  pass?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  from?: string;
}

export class SmtpTestDto {
  @IsOptional()
  @IsEmail()
  to?: string;
}
