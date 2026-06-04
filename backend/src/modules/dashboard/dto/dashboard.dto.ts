import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsObject,
  IsArray,
  MinLength,
  MaxLength,
  Min,
} from "class-validator";

// DTO para query de dashboard
export class DashboardQueryDto {
  @IsOptional()
  @IsString()
  period?: string; // DAY, WEEK, MONTH, QUARTER, YEAR

  @IsOptional()
  @IsString()
  startDate?: Date;

  @IsOptional()
  @IsString()
  endDate?: Date;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metricTypes?: string[]; // Array de metric types
}

// DTO para crear métrica manual
export class CreateMetricDto {
  @IsString()
  metricType: string;

  @IsString()
  metricName: string;

  @IsString()
  period: string;

  @IsNumber()
  value: number;

  @IsOptional()
  @IsNumber()
  target?: number;

  @IsOptional()
  @IsObject()
  metadata?: any;
}

// DTO para crear alerta
export class CreateAlertDto {
  @IsString()
  alertType: string;

  @IsString()
  severity: string;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  description: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  entityType?: string;
}

// DTO para resolver alerta
export class ResolveAlertDto {
  @IsString()
  @MaxLength(500)
  resolutionNote?: string;
}

// DTO para query de alertas
export class AlertsQueryDto {
  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  alertType?: string;

  @IsOptional()
  @IsBoolean()
  isResolved?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}
