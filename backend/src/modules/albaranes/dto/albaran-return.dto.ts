import { Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AlbaranReturnSettlement } from "@prisma/client";

/**
 * Devolución anotada por quien recibe (al subir la foto, aún sin líneas) o
 * desde una línea concreta del albarán. Con `lineId` + `settlement` se aplica
 * en el acto (botón «Devolver» de la línea).
 */
export class CreateAlbaranReturnDto {
  @ApiProperty({ description: "Qué se devuelve, en texto libre" })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description: string;

  @ApiPropertyOptional({ description: "Cantidad devuelta" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @ApiPropertyOptional({ description: "Unidad (ud, kilo, caja...)" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  unit?: string;

  @ApiProperty({ description: "Motivo de la devolución" })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  reason: string;

  @ApiPropertyOptional({
    description: "Quién la anota (cuenta compartida); si falta, el usuario",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reportedByName?: string;

  @ApiPropertyOptional({ description: "Línea a la que se aplica ya" })
  @IsOptional()
  @IsString()
  lineId?: string;

  @ApiPropertyOptional({ enum: AlbaranReturnSettlement })
  @IsOptional()
  @IsEnum(AlbaranReturnSettlement)
  settlement?: AlbaranReturnSettlement;
}

/** Oficina aplica una devolución anotada a una línea del albarán. */
export class ApplyAlbaranReturnDto {
  @ApiProperty()
  @IsString()
  lineId: string;

  @ApiProperty({ description: "Cantidad devuelta, en la unidad de la línea" })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ enum: AlbaranReturnSettlement })
  @IsEnum(AlbaranReturnSettlement)
  settlement: AlbaranReturnSettlement;
}

export class DiscardAlbaranReturnDto {
  @ApiProperty({ description: "Por qué se descarta" })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  note: string;
}

/** Enlaza una línea de un abono aparte con la devolución que cubre. */
export class CoverAlbaranReturnDto {
  @ApiPropertyOptional({
    description: "Devolución que cubre esta línea; null para desenlazar",
  })
  @IsOptional()
  @IsString()
  returnId?: string | null;
}
