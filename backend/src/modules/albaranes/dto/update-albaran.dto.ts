import { IsString, IsOptional, IsEnum, ValidateIf } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AlbaranStatus } from "@prisma/client";

export class UpdateAlbaranDto {
  @ApiPropertyOptional({ description: "ID del proveedor" })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ description: "Número de albarán del proveedor" })
  @IsOptional()
  @IsString()
  albaranNumber?: string;

  @ApiPropertyOptional({
    description:
      "Pedido de compra que este albarán recibe (null para desvincular)",
  })
  @IsOptional()
  @IsString()
  purchaseOrderId?: string | null;

  @ApiPropertyOptional({ description: "Notas" })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: "ID del almacén" })
  @IsOptional()
  @IsString()
  warehouseId?: string;
}

export class UpdateAlbaranStatusDto {
  @ApiProperty({ description: "Nuevo estado", enum: AlbaranStatus })
  @IsEnum(AlbaranStatus)
  status: AlbaranStatus;
}

export class UpdateAlbaranLineDto {
  @ApiPropertyOptional({ description: "Código de artículo del proveedor" })
  @IsOptional()
  @IsString()
  articleNumber?: string;

  @ApiPropertyOptional({ description: "Lote" })
  @IsOptional()
  @IsString()
  lot?: string;

  @ApiPropertyOptional({ description: "Descripción" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: "Cantidad" })
  @IsOptional()
  @IsString()
  quantity?: string;

  @ApiPropertyOptional({ description: "Unidad" })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: "Precio por unidad (sin IVA)" })
  @IsOptional()
  @IsString()
  unitPrice?: string;

  @ApiPropertyOptional({ description: "% IVA" })
  @IsOptional()
  @IsString()
  vatPercent?: string;

  @ApiPropertyOptional({ description: "Precio por unidad con IVA" })
  @IsOptional()
  @IsString()
  priceWithVat?: string;

  @ApiPropertyOptional({ description: "ID del producto asignado" })
  @IsOptional()
  @IsString()
  matchedProductId?: string;
}

export class MatchLineDto {
  @ApiProperty({ description: "ID del producto a asignar" })
  @IsString()
  productId: string;
}
