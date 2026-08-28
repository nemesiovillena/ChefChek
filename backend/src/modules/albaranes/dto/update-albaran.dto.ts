import {
  IsString,
  IsOptional,
  IsEnum,
  ValidateIf,
  IsBoolean,
} from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AlbaranStatus } from "@prisma/client";

/**
 * Los importes de estos DTOs se declaran como string (el servicio hace
 * parseFloat), pero los clientes frontend los serializan como números JSON.
 * El ValidationPipe global no tiene enableImplicitConversion, así que un
 * number no se coerce a string y @IsString() lo rechaza con 400
 * "must be a string". Este transform normaliza number → string en la
 * frontera; strings, null y undefined pasan intactos.
 */
const numberAsString = ({ value }: { value: unknown }) =>
  typeof value === "number" ? String(value) : value;

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

  @ApiPropertyOptional({
    description:
      "Opt-in: al confirmar, aplicar el descuento de línea al coste/escandallos",
  })
  @IsOptional()
  @IsBoolean()
  applyDiscountToCost?: boolean;
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
  @Transform(numberAsString)
  @IsString()
  quantity?: string;

  @ApiPropertyOptional({ description: "Unidad" })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: "Precio por unidad (sin IVA)" })
  @IsOptional()
  @Transform(numberAsString)
  @IsString()
  unitPrice?: string;

  @ApiPropertyOptional({ description: "% IVA" })
  @IsOptional()
  @Transform(numberAsString)
  @IsString()
  vatPercent?: string;

  @ApiPropertyOptional({ description: "Precio por unidad con IVA" })
  @IsOptional()
  @Transform(numberAsString)
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

export class CorrectAlbaranLinePriceDto {
  @ApiProperty({ description: "Precio por unidad corregido (sin IVA)" })
  @Transform(numberAsString)
  @IsString()
  unitPrice: string;

  @ApiPropertyOptional({
    description:
      "Importe neto de la línea según papel (con descuento). null lo limpia; ausente conserva el actual.",
  })
  @IsOptional()
  @Transform(numberAsString)
  @IsString()
  totalPrice?: string | null;
}
