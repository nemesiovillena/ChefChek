import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class ThermalProfileDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name!: string;

  @IsNumber()
  @Min(20)
  @Max(200)
  widthMm!: number;

  @IsNumber()
  @Min(20)
  @Max(200)
  heightMm!: number;
}

export class UpdateEtiquetadoConfigDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ThermalProfileDto)
  thermalProfiles?: ThermalProfileDto[];

  /**
   * Formato de impresión por defecto: 'thermal:<perfilId>' o preset A4.
   * String vacío = quitar la preferencia. Opcional (actualización parcial).
   */
  @IsOptional()
  @IsString()
  defaultFormat?: string;
}
