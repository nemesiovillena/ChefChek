import { Type } from "class-transformer";
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class PurchaseListItemInputDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  defaultQuantity?: number;
}

export class CreatePurchaseListDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsString()
  @IsNotEmpty()
  supplierId: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseListItemInputDto)
  items?: PurchaseListItemInputDto[];
}

export class UpdatePurchaseListDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  // Reemplaza el conjunto completo de artículos de la lista
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseListItemInputDto)
  items?: PurchaseListItemInputDto[];
}

export class GenerateOrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;
}

export class GenerateOrderDto {
  @IsOptional()
  @IsString()
  locationId?: string;

  // Selección del checklist con cantidades; si se omite, se usa toda la lista
  // con cantidades sugeridas según stock mín/máx
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GenerateOrderItemDto)
  items?: GenerateOrderItemDto[];
}
