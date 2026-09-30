import {
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  MinLength,
} from "class-validator";

/** Mínimo de caracteres de la contraseña de un usuario del restaurante. */
export const USER_PASSWORD_MIN_LENGTH = 4;

export class CreateUserDto {
  @IsString()
  tenantId: string;

  @IsString()
  email: string;

  @IsString()
  @MinLength(USER_PASSWORD_MIN_LENGTH)
  password: string;

  @IsString()
  name: string;

  @IsEnum(["ADMIN", "USER", "VIEWER"])
  @IsOptional()
  role?: "ADMIN" | "USER" | "VIEWER";

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  payrollEmail?: string;

  /** Cuenta de dispositivo compartido (ordenador de cocina), no una persona. */
  @IsOptional()
  @IsBoolean()
  isSharedAccount?: boolean;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(USER_PASSWORD_MIN_LENGTH)
  password?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(["ADMIN", "USER", "VIEWER"])
  role?: "ADMIN" | "USER" | "VIEWER";

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  payrollEmail?: string;

  /** Cuenta de dispositivo compartido (ordenador de cocina), no una persona. */
  @IsOptional()
  @IsBoolean()
  isSharedAccount?: boolean;
}
