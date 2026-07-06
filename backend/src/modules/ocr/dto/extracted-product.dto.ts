import { IsString, IsNumber, IsOptional, IsArray, Min } from "class-validator";

/**
 * DTO para producto extraído por OCR/AI.
 * Extraído del antiguo módulo `ingesta` (consolidado en `ocr`).
 */
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
