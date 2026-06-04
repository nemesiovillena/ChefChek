import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  IsDateString,
  IsUrl,
  IsObject,
  IsNumber,
  Min,
  MinLength,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

// Estados de procesamiento de documentos
export enum DocumentStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  RETRYING = "RETRYING",
}

// Tipos de documentos soportados
export enum DocumentType {
  INVOICE = "INVOICE",
  ORDER_CONFIRMATION = "ORDER_CONFIRMATION",
  PRODUCT_CATALOG = "PRODUCT_CATALOG",
  RECEIPT = "RECEIPT",
  DELIVERY_NOTE = "DELIVERY_NOTE",
}

// Telegram DTOs - reordenados para evitar problemas de inicialización

export class TelegramPhotoSizeDto {
  @IsString()
  file_id: string;

  @IsString()
  @IsOptional()
  file_unique_id?: string;

  @IsNumber()
  @IsOptional()
  file_size?: number;

  @IsNumber()
  @IsOptional()
  width?: number;

  @IsNumber()
  @IsOptional()
  height?: number;
}

export class TelegramDocumentDto {
  @IsString()
  file_id: string;

  @IsString()
  @IsOptional()
  file_unique_id?: string;

  @IsNumber()
  @IsOptional()
  file_size?: number;

  @IsString()
  @IsOptional()
  file_name?: string;

  @IsString()
  @IsOptional()
  mime_type?: string;
}

export class TelegramUserDto {
  @IsNumber()
  id: number;

  @IsBoolean()
  @IsOptional()
  is_bot?: boolean;

  @IsString()
  @IsOptional()
  first_name?: string;

  @IsString()
  @IsOptional()
  last_name?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  language_code?: string;
}

export class TelegramChatDto {
  @IsNumber()
  id: number;

  @IsString()
  type: string; // 'private', 'group', 'supergroup', 'channel'

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsNumber()
  @IsOptional()
  owner?: number;
}

export class TelegramPhotoDto {
  @IsArray()
  @IsOptional()
  sizes?: TelegramPhotoSizeDto[];
}

export class TelegramMessageDto {
  @IsNumber()
  message_id: number;

  @IsObject()
  @IsOptional()
  from?: TelegramUserDto;

  @IsObject()
  chat: TelegramChatDto;

  @IsDateString()
  date: string;

  @IsString()
  @IsOptional()
  text?: string;

  @IsArray()
  @IsOptional()
  photo?: TelegramPhotoDto[];

  @IsArray()
  @IsOptional()
  document?: TelegramDocumentDto[];
}

export class TelegramWebhookDto {
  @IsString()
  update_id: string;

  @IsObject()
  message: TelegramMessageDto;
}

// DTOs de procesamiento de documentos

// DTO para documento recibido desde Telegram
export class DocumentReceivedDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  tenantId: string;

  @IsString()
  @IsEnum(Object.values(DocumentType))
  documentType: DocumentType;

  @IsUrl()
  @IsOptional()
  fileUrl?: string;

  @IsString()
  @IsOptional()
  fileId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  source: string; // 'telegram', 'upload', etc.

  @IsString()
  @IsOptional()
  sourceUserId?: string; // Telegram user ID

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

// DTO para crear documento en base de datos
export class CreateDocumentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  tenantId: string;

  @IsString()
  @IsEnum(Object.values(DocumentType))
  documentType: DocumentType;

  @IsString()
  @IsUrl()
  fileUrl: string;

  @IsString()
  @IsOptional()
  fileName?: string;

  @IsString()
  @IsOptional()
  fileId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  source: string;

  @IsString()
  @IsOptional()
  sourceUserId?: string;

  @IsObject()
  @IsOptional()
  ocrData?: any; // Datos extraídos por OCR

  @IsObject()
  @IsOptional()
  aiData?: any; // Datos procesados por AI

  @IsObject()
  @IsOptional()
  extractedProducts?: ExtractedProductDto[];
}

// DTO para producto extraído por OCR/AI
export class ExtractedProductDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  quantity?: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsNumber()
  @IsOptional()
  unitPrice?: number;

  @IsString()
  @IsOptional()
  supplier?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allergens?: string[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  @IsOptional()
  confidence?: number; // 0-1: confianza de la extracción
}

// DTO para consulta de documentos
export class DocumentQueryDto {
  @IsString()
  @IsOptional()
  tenantId?: string;

  @IsString()
  @IsEnum(Object.values(DocumentType))
  @IsOptional()
  documentType?: DocumentType;

  @IsString()
  @IsEnum(Object.values(DocumentStatus))
  @IsOptional()
  status?: DocumentStatus;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}

// DTO para resultado de procesamiento OCR
export class OcrResultDto {
  @IsString()
  text: string;

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  extractedData?: ExtractedProductDto[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  confidence?: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

// DTO para asociar bot Telegram con tenant
export class AssociateTelegramBotDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  tenantId: string;

  @IsString()
  botToken: string; // Token del bot de Telegram

  @IsString()
  @IsOptional()
  webhookUrl?: string; // URL del webhook

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  environment?: string; // 'production', 'staging'
}

// DTO para comando del bot
export class BotCommandDto {
  @IsString()
  tenantId: string;

  @IsString()
  command: string; // '/ingest', '/status', '/help', etc.

  @IsObject()
  @IsOptional()
  params?: Record<string, any>;
}

// DTO para actualización de documento
export class UpdateDocumentDto {
  @IsEnum(Object.values(DocumentStatus))
  @IsOptional()
  status?: DocumentStatus;

  @IsString()
  @IsOptional()
  errorMessage?: string;

  @IsObject()
  @IsOptional()
  ocrData?: any;

  @IsObject()
  @IsOptional()
  aiData?: any;

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  extractedProducts?: ExtractedProductDto[];
}

// DTO para autorizar usuario de Telegram
export class AuthorizeTelegramUserDto {
  @IsString()
  tenantId: string;

  @IsNumber()
  telegramUserId: number;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  userId?: string; // ID del usuario de ChefChek para vincular
}
