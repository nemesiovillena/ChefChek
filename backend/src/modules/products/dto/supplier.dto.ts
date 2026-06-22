import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  IsIn,
  Min,
  Max,
  IsNotEmpty,
} from "class-validator";

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(30)
  averageDeliveryTime?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  reliabilityScore?: number;

  @IsOptional()
  @IsString()
  @IsIn(["LOW", "MEDIUM", "HIGH"])
  priceTier?: "LOW" | "MEDIUM" | "HIGH";

  @IsOptional()
  @IsString()
  @IsIn(["PREFERRED", "ALTERNATIVE", "EXCLUDED"])
  preferredStatus?: "PREFERRED" | "ALTERNATIVE" | "EXCLUDED";

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(["EMAIL", "PHONE", "WEB", "WHATSAPP"], { each: true })
  orderMethods?: ("EMAIL" | "PHONE" | "WEB" | "WHATSAPP")[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(30)
  averageDeliveryTime?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  reliabilityScore?: number;

  @IsOptional()
  @IsString()
  @IsIn(["LOW", "MEDIUM", "HIGH"])
  priceTier?: "LOW" | "MEDIUM" | "HIGH";

  @IsOptional()
  @IsString()
  @IsIn(["PREFERRED", "ALTERNATIVE", "EXCLUDED"])
  preferredStatus?: "PREFERRED" | "ALTERNATIVE" | "EXCLUDED";

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(["EMAIL", "PHONE", "WEB", "WHATSAPP"], { each: true })
  orderMethods?: ("EMAIL" | "PHONE" | "WEB" | "WHATSAPP")[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SupplierResponseDto {
  id: string;
  tenantId: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  averageDeliveryTime: number;
  reliabilityScore: number;
  priceTier: string;
  preferredStatus: string;
  orderMethods: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class SuppliersQueryDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}