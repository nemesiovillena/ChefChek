import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsObject,
  IsArray,
  MinLength,
  MaxLength,
  IsNotEmpty,
} from "class-validator";

// DTO para crear/configurar digital menu
export class CreateDigitalMenuConfigDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsString()
  menuId: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Branding
  @IsOptional()
  @IsString()
  @MaxLength(7)
  primaryColor?: string; // Hex color

  @IsOptional()
  @IsString()
  @MaxLength(7)
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  fontFamily?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  // Horarios
  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @IsOptional()
  @IsObject()
  openingHours?: any; // JSON con horarios por día

  // Configuración UI
  @IsOptional()
  @IsBoolean()
  showPrices?: boolean;

  @IsOptional()
  @IsBoolean()
  showAllergens?: boolean;

  @IsOptional()
  @IsBoolean()
  showDescriptions?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAllergenFilter?: boolean;
}

export class UpdateDigitalMenuConfigDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  menuId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Branding
  @IsOptional()
  @IsString()
  @MaxLength(7)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  fontFamily?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  // Horarios
  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @IsOptional()
  @IsObject()
  openingHours?: any;

  // Configuración UI
  @IsOptional()
  @IsBoolean()
  showPrices?: boolean;

  @IsOptional()
  @IsBoolean()
  showAllergens?: boolean;

  @IsOptional()
  @IsBoolean()
  showDescriptions?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAllergenFilter?: boolean;
}

// DTO para QR code generation
export class GenerateQRCodeDto {
  @IsString()
  digitalMenuId: string;

  @IsOptional()
  @IsString()
  format?: "png" | "svg" | "jpeg";

  @IsOptional()
  @IsNumber()
  size?: number; // Tamaño en pixels

  @IsOptional()
  @IsString()
  @MaxLength(7)
  customColor?: string; // Color personalizado en hex
}

// DTO para query de menú público
export class PublicMenuQueryDto {
  @IsOptional()
  @IsString()
  language?: string; // es, en, fr, etc.

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  filteredByAllergens?: number[]; // Array de allergen IDs
}

// DTO para registrar scan
export class RegisterScanDto {
  @IsString()
  digitalMenuId: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  referrer?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsArray()
  filteredByAllergens?: number[];

  @IsOptional()
  @IsString()
  interactionType?: "scan" | "filter" | "view_item" | "contact";

  @IsOptional()
  @IsObject()
  metadata?: any;
}
