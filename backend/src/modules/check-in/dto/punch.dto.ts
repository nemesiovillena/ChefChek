import { PunchType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class CreatePunchDto {
  /** UUID generado en el cliente: reenviar el mismo fichaje no lo duplica. */
  @IsUUID()
  id: string;

  @IsEnum(PunchType)
  type: PunchType;

  /** Solo en kiosco: a quién se ficha. En sesión personal se ignora. */
  @IsOptional()
  @IsString()
  employeeId?: string;

  /** Solo en kiosco. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4,6}$/, { message: "PIN no válido." })
  pin?: string;

  /** Solo en kiosco: centro en el que está instalado el dispositivo. */
  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracyM?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  deviceTime?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceId?: string;
}

/** Un fichaje hecho sin conexión, tal como quedó en la cola del dispositivo. */
export class SyncPunchItemDto {
  @IsUUID()
  id: string;

  @IsEnum(PunchType)
  type: PunchType;

  /** Momento real del fichaje según el reloj del dispositivo. */
  @Type(() => Date)
  @IsDate()
  deviceTime: Date;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  /** Solo kiosco: "<id>:<PIN>" cifrado con la clave pública del tenant, en base64. */
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  encryptedPin?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracyM?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceId?: string;
}

export class SyncPunchesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SyncPunchItemDto)
  punches: SyncPunchItemDto[];
}
