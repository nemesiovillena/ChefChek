import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
} from "class-validator";

export enum TemplateType {
  STANDARD = "STANDARD",
  MINIMAL = "MINIMAL",
  DETAILED = "DETAILED",
  CUSTOM = "CUSTOM",
}

enum FieldType {
  TEXT = "TEXT",
  IMAGE = "IMAGE",
  LIST = "LIST",
  TABLE = "TABLE",
  CALCULATED = "CALCULATED",
}

enum PDFFormat {
  A4 = "A4",
  LETTER = "LETTER",
}

enum PDFOrientation {
  PORTRAIT = "PORTRAIT",
  LANDSCAPE = "LANDSCAPE",
}

enum DocumentType {
  TECHNICAL_SHEET = "TECHNICAL_SHEET",
  RECIPE_CARD = "RECIPE_CARD",
  INSTRUCTION = "INSTRUCTION",
  OTHER = "OTHER",
}

interface LayoutSection {
  visible: boolean;
  order: number;
  columns?: number;
  styles?: Record<string, any>;
}

interface TemplateStyles {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  fontSize?: number;
  headerFontSize?: number;
  lineWidth?: number;
}

interface BrandingConfig {
  logoUrl?: string;
  companyName?: string;
  address?: string;
  contact?: string;
}

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsEnum(TemplateType)
  type: TemplateType;

  @IsOptional()
  description?: string;

  @IsOptional()
  layout?: {
    header: LayoutSection;
    generalInfo: LayoutSection;
    ingredients: LayoutSection;
    preparation: LayoutSection;
    nutrition: LayoutSection;
    footer: LayoutSection;
  };

  @IsOptional()
  fields?: Array<{
    id: string;
    name: string;
    type: FieldType;
    required: boolean;
    defaultValue?: any;
    placeholder?: string;
  }>;

  @IsOptional()
  styles?: TemplateStyles;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  layout?: any;

  @IsOptional()
  fields?: any[];

  @IsOptional()
  styles?: TemplateStyles;
}

export class GenerateSheetDto {
  @IsString()
  recipeId: string;

  // Opcional: sin templateId se usa el primer template activo del tenant
  // (o se crea el estándar si no hay ninguno).
  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  format?: PDFFormat;

  @IsOptional()
  orientation?: PDFOrientation;

  @IsOptional()
  quality?: "STANDARD" | "HIGH";

  @IsOptional()
  watermark?: string;

  @IsOptional()
  branding?: BrandingConfig;

  @IsOptional()
  @IsBoolean()
  includeNutrition?: boolean;

  @IsOptional()
  @IsBoolean()
  includeAllergens?: boolean;

  @IsOptional()
  @IsBoolean()
  includeCosts?: boolean;
}

export class GenerateBatchDto {
  @IsArray()
  @IsString({ each: true })
  recipeIds: string[];

  @IsString()
  templateId: string;

  @IsOptional()
  format?: PDFFormat;

  @IsOptional()
  orientation?: PDFOrientation;

  @IsOptional()
  quality?: "STANDARD" | "HIGH";

  @IsOptional()
  mergeIntoOne?: boolean;
}

export class TemplateFieldDto {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  defaultValue?: any;
  placeholder?: string;
}

export class TemplateResponseDto {
  id: string;
  name: string;
  type: TemplateType;
  description?: string;
  layout?: any;
  fields: TemplateFieldDto[];
  styles?: TemplateStyles;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export class DocumentResponseDto {
  id: string;
  name: string;
  type: DocumentType;
  category: string;
  recipeId?: string;
  templateId?: string;
  version: number;
  createdAt: Date;
  createdBy: string;
  fileSize: number;
  fileFormat: "PDF" | "DOCX";
  url: string;
}
