import { GeofenceMode } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

/** Geovalla de un centro de trabajo. latitude/longitude a null la desactivan. */
export class UpdateWorkCenterGeofenceDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(5000)
  geofenceRadiusM?: number;

  @IsOptional()
  @IsEnum(GeofenceMode)
  geofenceMode?: GeofenceMode;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}
