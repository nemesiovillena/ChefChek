import { IsOptional, IsString, IsEnum, IsDateString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { AlbaranStatus } from "@prisma/client";
import { Transform } from "class-transformer";

export class AlbaranQueryDto {
  @ApiPropertyOptional({ description: "Filtrar por proveedor" })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ description: "Filtrar por estado", enum: AlbaranStatus })
  @IsOptional()
  @IsEnum(AlbaranStatus)
  status?: AlbaranStatus;

  @ApiPropertyOptional({ description: "Fecha desde" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: "Fecha hasta" })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: "Buscar por número o descripción" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: "Página", default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @ApiPropertyOptional({ description: "Resultados por página", default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;
}
