import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

/** Código de plato de Cuiner: numérico con ceros a la izquierda. */
const PLATO = /^[0-9]{1,10}$/;

export class CuinerRegistroRowDto {
  @IsInt()
  @Min(1)
  id!: number;

  @Matches(PLATO)
  plato!: string;

  @IsString()
  @MaxLength(40)
  operacion!: string;

  @IsOptional()
  @IsNumber()
  unidades!: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  cajero?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  mesa?: string | null;
}

export class CuinerSnapshotDto {
  @Matches(PLATO)
  plato!: string;

  /** stock − consumo del plato; null si no tiene contador. */
  @IsOptional()
  @IsNumber()
  quedan?: number | null;

  /** Piezas con peso sin consumir (platos al peso); null si no tiene lotes. */
  @IsOptional()
  @IsNumber()
  piezas?: number | null;
}

export class PortionPushResultDto {
  @IsString()
  counterId!: string;

  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsBoolean()
  ok!: boolean;

  @IsOptional()
  @Matches(PLATO)
  plato?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  error?: string;
}

export class PortionCuinerSyncDto {
  /** Primer enlace: último id de es_registro (no se repasa lo anterior). */
  @IsOptional()
  @IsInt()
  @Min(0)
  baseline?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PortionPushResultDto)
  pushResults?: PortionPushResultDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  cursorFrom?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cursorTo?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => CuinerRegistroRowDto)
  rows?: CuinerRegistroRowDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => CuinerSnapshotDto)
  snapshot?: CuinerSnapshotDto[];

  /** true si ya no queda historial por mandar: la foto se puede comparar. */
  @IsOptional()
  @IsIn([true, false])
  complete?: boolean;
}
