import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsBoolean,
  Min,
  Max,
  IsHexColor,
} from "class-validator";

/**
 * Tipos de QR code disponibles
 */
export enum QRCodeType {
  STATIC = "static",
  DYNAMIC = "dynamic",
  TEMPORARY = "temporary",
}

/**
 * Formatos de imagen soportados
 */
export enum QRCodeFormat {
  PNG = "png",
  SVG = "svg",
  JPEG = "jpeg",
  WEBP = "webp",
}

/**
 * Niveles de corrección de error
 */
export enum QRCodeErrorCorrection {
  L = "L", // ~7% capacidad
  M = "M", // ~15% capacidad
  Q = "Q", // ~25% capacidad
  H = "H", // ~30% capacidad
}

/**
 * Entidades soportadas para QR codes
 */
export enum QREntityType {
  PRODUCT = "product",
  DIGITAL_MENU = "digital-menu",
  RECIPE = "recipe",
  CATEGORY = "category",
}

/**
 * DTO para configuración de QR code
 */
export class QRCodeConfigDto {
  @IsEnum(QRCodeType)
  @IsOptional()
  qrType?: QRCodeType;

  @IsEnum(QRCodeFormat)
  @IsOptional()
  format?: QRCodeFormat;

  @IsEnum(QRCodeErrorCorrection)
  @IsOptional()
  errorCorrection?: QRCodeErrorCorrection;

  @IsNumber()
  @Min(100)
  @Max(1000)
  @IsOptional()
  size?: number;

  @IsHexColor()
  @IsOptional()
  foregroundColor?: string;

  @IsHexColor()
  @IsOptional()
  backgroundColor?: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  margin?: number;

  @IsBoolean()
  @IsOptional()
  includeLogo?: boolean;

  @IsString()
  @IsOptional()
  logoUrl?: string;
}

/**
 * DTO para generar QR code
 */
export class GenerateQRCodeDto {
  @IsEnum(QREntityType)
  entityType: QREntityType;

  @IsString()
  entityId: string;

  @IsOptional()
  data?: Record<string, any>;

  @IsOptional()
  config?: QRCodeConfigDto;
}

/**
 * DTO para respuesta de QR code generado
 */
export class QRCodeResponseDto {
  @IsString()
  qrCodeId: string;

  @IsString()
  entityType: QREntityType;

  @IsString()
  entityId: string;

  @IsString()
  qrCodeUrl: string;

  @IsString()
  publicUrl: string;

  @IsEnum(QRCodeFormat)
  format: QRCodeFormat;

  @IsNumber()
  size: number;

  @IsString()
  publicFilePath: string;

  @IsString()
  generatedAt: string;

  @IsOptional()
  expiresAt?: string;

  @IsOptional()
  scanCount?: number;
}

/**
 * DTO para registrar escaneo de QR
 */
export class RegisterQRScanDto {
  @IsString()
  qrCodeId: string;

  @IsOptional()
  deviceId?: string;

  @IsOptional()
  userAgent?: string;

  @IsOptional()
  location?: string;
}

/**
 * DTO para respuesta de escaneo
 */
export class QRScanResponseDto {
  @IsString()
  qrCodeId: string;

  @IsString()
  entityType: QREntityType;

  @IsString()
  entityId: string;

  @IsString()
  publicUrl: string;

  @IsNumber()
  scanCount: number;

  @IsString()
  lastScannedAt: string;

  @IsEnum(QRCodeFormat)
  format: QRCodeFormat;

  @IsNumber()
  size: number;

  @IsOptional()
  entityData?: Record<string, any>;
}
