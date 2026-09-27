import {
  IsDate,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * `label` es etiqueta libre con sugerencias en la UI (NO un enum rígido) —
 * confirmado en el plan: la agrupación que recuerda el usuario de la
 * plataforma SICTED no coincide 1:1 con ninguna taxonomía verificada.
 */
export class CreateComplianceDocDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  holderName?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  issuedAt?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;
}

export class UpdateComplianceDocDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  holderName?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  issuedAt?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;
}
