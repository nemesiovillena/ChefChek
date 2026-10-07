import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateEmployeeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nationalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  socialSecurityNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  section?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  contractType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  weeklyHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyCost?: number;

  /** Cuenta de acceso vinculada; null para desvincular. */
  @IsOptional()
  @IsString()
  userId?: string | null;

  @IsOptional()
  @IsString()
  defaultLocationId?: string | null;

  /** Centros en los que puede fichar. Si se omite, se usa el centro por defecto. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  locationIds?: string[];

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  hireDate?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  terminationDate?: Date | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nationalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  socialSecurityNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  section?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  contractType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  weeklyHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyCost?: number | null;

  @IsOptional()
  @IsString()
  userId?: string | null;

  @IsOptional()
  @IsString()
  defaultLocationId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  locationIds?: string[];

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  hireDate?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  terminationDate?: Date | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetEmployeePinDto {
  /** Solo dígitos; la longitud exacta la fija CheckInSettings.pinLength. */
  @IsString()
  @Matches(/^\d{4,6}$/, { message: "El PIN debe tener entre 4 y 6 dígitos." })
  pin: string;
}

export class ImportEmployeesDto {
  /** Cuentas del equipo de las que crear ficha de empleado. */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsString({ each: true })
  userIds: string[];
}
