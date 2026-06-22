import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from "class-validator";

/**
 * Opciones para procesamiento con Google Vision
 */
export class GoogleVisionOptions {
  @IsString()
  @IsOptional()
  language?: string; // 'es', 'en', 'fr', etc.

  @IsBoolean()
  @IsOptional()
  enableDocumentTextDetection?: boolean; // Para documentos formateados

  @IsBoolean()
  @IsOptional()
  enableTextDetection?: boolean; // Para texto general

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  minConfidence?: number;
}

/**
 * Resultado de OCR estandarizado
 */
export class OCRResultDto {
  @IsString()
  text: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @IsString()
  provider: string;

  @IsNumber()
  processingTime: number;

  @IsOptional()
  rawResult?: any;
}
