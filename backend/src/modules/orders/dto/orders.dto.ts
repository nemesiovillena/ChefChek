import {
  IsString,
  IsNumber,
  IsEnum,
  IsDate,
  IsArray,
  IsOptional,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

// Enums
export enum Urgency {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum OrderStatus {
  DRAFT = "DRAFT",
  REVIEW = "REVIEW",
  APPROVED = "APPROVED",
  SENT = "SENT",
  RECEIVED = "RECEIVED",
  CANCELLED = "CANCELLED",
}

export enum PreferredStatus {
  PREFERRED = "PREFERRED",
  ALTERNATIVE = "ALTERNATIVE",
  EMERGENCY = "EMERGENCY",
}

export enum PriceTier {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export enum TemplateFormat {
  PDF = "PDF",
  EMAIL = "EMAIL",
  EXCEL = "EXCEL",
}

// DTOs
export class OrderRequirementDto {
  id: string;
  productId: string;
  productName: string;
  currentStock: number;
  minimumStock: number;
  projectedConsumption: number;
  requiredQuantity: number;
  suggestedQuantity: number;
  urgency: Urgency;
  supplierId: string;
  supplierName: string;
  conservationZone: string;
  category: string;
  unit: string;
  estimatedCost: number;
  lastOrderDate: Date;
  averageDailyConsumption: number;
}

export class CreateOrderRequirementDto {
  @IsString()
  tenantId: string;

  @IsNumber()
  @Min(1)
  historicalPeriod: number = 7;

  @IsNumber()
  @Min(1)
  lookaheadDays: number = 7;
}

export class SupplierClassificationDto {
  supplierId: string;
  supplierName: string;
  categories: string[];
  conservationZones: string[];
  averageDeliveryTime: number;
  reliabilityScore: number;
  priceTier: PriceTier;
  preferredStatus: PreferredStatus;
  contactInfo: {
    email?: string;
    phone?: string;
    website?: string;
  };
  orderMethods: string[];
}

export class OrderItemDto {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  requestedQuantity: number;
  adjustedQuantity?: number;
  unit: string;
  unitPrice: number;
  totalCost: number;
  notes?: string;
  alternativeProducts?: string[];
}

export class AutomatedOrderDto {
  id: string;
  tenantId: string;
  supplierId: string;
  supplierName: string;
  orderNumber: string;
  status: OrderStatus;
  urgency: Urgency;
  scheduledDelivery?: Date;
  estimatedCost: number;
  createdAt: Date;
  createdBy: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  sentAt?: Date;
  receivedAt?: Date;
  items: OrderItemDto[];
}

export class CreateAutomatedOrderDto {
  @IsString()
  tenantId: string;

  @IsString()
  supplierId: string;

  @IsEnum(Urgency)
  urgency: Urgency;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  scheduledDelivery?: Date;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

export class CreateOrderItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  requestedQuantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  adjustedQuantity?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alternativeProducts?: string[];
}

export class UpdateOrderItemDto {
  @IsNumber()
  @Min(1)
  adjustedQuantity: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alternativeProducts?: string[];
}

export class ApproveOrderDto {
  @IsString()
  approvedBy: string;
}

export class SendOrderDto {
  @IsString()
  sentBy: string;

  @IsOptional()
  @IsString()
  deliveryMethod?: string;
}

export class ExportOrderDto {
  @IsEnum(TemplateFormat)
  format: TemplateFormat;

  @IsOptional()
  @IsString()
  recipientEmail?: string;
}

export class TemplateItemDto {
  productId: string;
  productName: string;
  requestedQuantity: number;
  unit: string;
  unitPrice: number;
  totalCost: number;
  specifications?: string;
  alternativeProducts?: string[];
}

export class PurchaseOrderTemplateDto {
  id: string;
  supplierId: string;
  supplierName: string;
  orderNumber: string;
  generationDate: Date;
  estimatedDelivery?: Date;
  contactInfo: {
    email?: string;
    phone?: string;
    website?: string;
  };
  orderItems: TemplateItemDto[];
  subtotal: number;
  taxes: number;
  shippingCost: number;
  total: number;
  notes: string;
  format: TemplateFormat;
}

export class SafetyFactorConfigDto {
  productCategory: string;
  conservationZone: string;
  supplierReliability: number;
  baseFactor: number;
  maxFactor: number;
}

export class OrderRuleDto {
  id: string;
  name: string;
  description: string;
  priority: number;
}

export class CalculationOptionsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  historicalPeriod?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  lookaheadDays?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  conservationZone?: string;
}
