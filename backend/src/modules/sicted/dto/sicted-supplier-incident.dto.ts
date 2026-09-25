import { Type } from "class-transformer";
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

/** Incidencia de recepción (PROV.3, formulario real). */
export class CreateSupplierIncidentDto {
  @IsString()
  supplierId: string;

  @IsOptional()
  @IsString()
  albaranId?: string;

  @IsOptional()
  @IsBoolean()
  transportOk?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  productTemperature?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  rejectionCause?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  reportedByName: string;
}

export class ResolveSupplierIncidentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  resolution: string;
}
