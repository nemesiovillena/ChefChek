import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEmail,
  MinLength,
  IsEnum,
} from "class-validator";

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(3)
  slug: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsString()
  @IsEmail()
  adminEmail: string;

  @IsString()
  @MinLength(8)
  adminPassword: string;

  @IsString()
  @MinLength(2)
  adminName: string;

  @IsEnum(["ADMIN", "USER", "VIEWER"])
  @IsOptional()
  adminRole?: "ADMIN" | "USER" | "VIEWER";

  // Datos de contacto del cliente (opcionales en el alta)
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsString() contactPosition?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() addressStreet?: string;
  @IsOptional() @IsString() addressCity?: string;
  @IsOptional() @IsString() addressPostalCode?: string;
  @IsOptional() @IsString() cifNif?: string;
}

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Datos de contacto del cliente (editables desde superadmin)
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsString() contactPosition?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() addressStreet?: string;
  @IsOptional() @IsString() addressCity?: string;
  @IsOptional() @IsString() addressPostalCode?: string;
  @IsOptional() @IsString() cifNif?: string;
}
