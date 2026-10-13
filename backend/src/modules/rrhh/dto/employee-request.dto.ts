import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

/**
 * Datos personales que el empleado puede proponer cambiar. El nombre, el
 * puesto, el contrato y el coste no: los lleva gerencia.
 */
export class PersonalDataChangesDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsEmail({}, { message: "El email para nóminas no es válido." })
  payrollEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nationalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  socialSecurityNumber?: string;
}

export class CreateEmployeeRequestDto {
  @IsIn(["DATA_CHANGE", "OTHER"])
  kind: "DATA_CHANGE" | "OTHER";

  /** Obligatorio en DATA_CHANGE: al menos un campo. */
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonalDataChangesDto)
  changes?: PersonalDataChangesDto;

  /** Obligatorio en OTHER; en DATA_CHANGE es una nota opcional. */
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  message?: string;
}

export class DecideEmployeeRequestDto {
  @IsBoolean()
  approve: boolean;

  /** Obligatoria al rechazar. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
