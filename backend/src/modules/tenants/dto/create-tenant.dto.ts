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
}
