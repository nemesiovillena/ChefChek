import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  MinLength,
  MaxLength,
  Min,
  Max,
} from "class-validator";

// DTO para feedback de cliente
export class FeedbackDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  digitalMenuId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  type: "RATING" | "COMMENT" | "INCIDENT" | "SUGGESTION";

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  menuItemId?: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  comment?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  category?:
    | "FOOD_QUALITY"
    | "SERVICE"
    | "AMBIENCE"
    | "PRICING"
    | "HYGIENE"
    | "OTHER";

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerEmail?: string;

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsString()
  @IsOptional()
  userAgent?: string;
}

// DTO para escaneo de QR
export class QrScanDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  qrCode: string;

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsString()
  @IsOptional()
  userAgent?: string;

  @IsString()
  @IsOptional()
  language?: string;
}

// DTO para tracking de interacción
export class InteractionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  digitalMenuId: string;

  @IsString()
  @IsEnum(["view", "filter", "view_item", "contact", "feedback"])
  interactionType: string;

  @IsString()
  @IsOptional()
  menuItemId?: string;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsString()
  @IsOptional()
  userAgent?: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsString()
  @IsOptional()
  filteredByAllergens?: string[];
}

// DTO para respuesta de validación de QR
export class QrValidationResponseDto {
  isValid: boolean;
  digitalMenuId?: string;
  menuId?: string;
  tenantId?: string;
  restaurantName?: string;
  error?: string;
}

// DTO para estadísticas de sala
export class SalaStatsDto {
  @IsString()
  digitalMenuId: string;

  @IsDateString()
  startDate?: string;

  @IsDateString()
  endDate?: string;
}

// DTO para incidente reportado
export class IncidentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  digitalMenuId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  type:
    | "HYGIENE"
    | "FOOD_QUALITY"
    | "SERVICE"
    | "SAFETY"
    | "FACILITIES"
    | "OTHER";

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  location?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  description: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerContact?: string;

  @IsString()
  @IsOptional()
  customerEmail?: string;

  @IsDateString()
  @IsOptional()
  incidentDate?: string;

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsString()
  @IsOptional()
  userAgent?: string;
}

// DTO para actualización de feedback
export class UpdateFeedbackDto {
  @IsString()
  @IsOptional()
  status?: "PENDING" | "REVIEWED" | "RESOLVED" | "DISMISSED";

  @IsString()
  @IsOptional()
  adminResponse?: string;

  @IsString()
  @IsOptional()
  resolvedBy?: string;
}
