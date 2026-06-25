import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
  IsEnum,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateAlbaranLineDto {
  @ApiPropertyOptional({ description: "Código de artículo del proveedor" })
  @IsOptional()
  @IsString()
  articleNumber?: string;

  @ApiPropertyOptional({ description: "Lote" })
  @IsOptional()
  @IsString()
  lot?: string;

  @ApiProperty({ description: "Descripción del producto" })
  @IsString()
  description: string;

  @ApiProperty({ description: "Cantidad" })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ description: "Unidad", default: "ud" })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ description: "Precio por unidad (sin IVA)" })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ description: "% IVA", default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  vatPercent?: number;

  @ApiPropertyOptional({ description: "Precio por unidad con IVA" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceWithVat?: number;

  @ApiPropertyOptional({ description: "Importe de línea (sin IVA)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lineAmount?: number;
}

export class CreateAlbaranDto {
  @ApiPropertyOptional({ description: "ID del proveedor" })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ description: "Número de albarán del proveedor" })
  @IsOptional()
  @IsString()
  albaranNumber?: string;

  @ApiPropertyOptional({ description: "Fecha del albarán" })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: "Total bruto (antes de IVA)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  grossAmount?: number;

  @ApiPropertyOptional({ description: "Base imponible" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  base?: number;

  @ApiPropertyOptional({ description: "Total IVA" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  vatTotal?: number;

  @ApiPropertyOptional({ description: "Desglose de IVA por tipo: [{rate, base, amount}]" })
  @IsOptional()
  vatBreakdown?: Array<{ rate: number; base: number; amount: number }>;

  @ApiPropertyOptional({ description: "Total con IVA" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  total?: number;

  @ApiPropertyOptional({ description: "ID del almacén para entrada de stock" })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ description: "Notas" })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: "Líneas del albarán", type: [CreateAlbaranLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAlbaranLineDto)
  lines: CreateAlbaranLineDto[];
}
