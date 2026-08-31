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
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ThermalProfileDto)
  thermalProfiles!: ThermalProfileDto[];
}
