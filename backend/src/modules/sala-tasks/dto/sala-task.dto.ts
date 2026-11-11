import {
  IsString,
  IsOptional,
  IsNumber,
  IsDate,
  IsEmail,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
} from "class-validator";
import { Transform, Type } from "class-transformer";

export enum SalaTaskStatus {
  PENDIENTE = "PENDIENTE",
  EN_CURSO = "EN_CURSO",
  COMPLETADO = "COMPLETADO",
}

/**
 * `@IsOptional()` solo omite la validación cuando el valor es undefined/null
 * — un '' (campo de texto opcional dejado en blanco por el cliente) sigue
 * llegando a validadores como @IsEmail() y los hace fallar con 400. Se
 * normaliza '' → undefined en la frontera del DTO para que sea robusto
 * independientemente del cliente que llame a la API.
 */
const emptyStringAsUndefined = ({ value }: { value: unknown }) =>
  value === "" ? undefined : value;

/** Comensales: número → texto, recorta y '' → undefined. */
const guestCountAsText = ({ value }: { value: unknown }) => {
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

export class CreateSalaTaskDto {
  @IsString()
  title!: string;

  @Type(() => Date)
  @IsDate()
  eventDate!: Date;

  /** Texto libre: «17 adultos y 5 niños». Acepta número de clientes antiguos. */
  @IsOptional()
  @Transform(guestCountAsText)
  @IsString()
  @MaxLength(100)
  guestCount?: string;

  @IsOptional()
  @Transform(emptyStringAsUndefined)
  @IsString()
  customerName?: string;

  @IsOptional()
  @Transform(emptyStringAsUndefined)
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @Transform(emptyStringAsUndefined)
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @Transform(emptyStringAsUndefined)
  @IsString()
  menuNotes?: string;

  @IsOptional()
  @Transform(emptyStringAsUndefined)
  @IsString()
  observations?: string;

  @IsOptional()
  @Transform(emptyStringAsUndefined)
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsEnum(SalaTaskStatus)
  status?: SalaTaskStatus;
}

export class UpdateSalaTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  eventDate?: Date;

  /** Texto libre: «17 adultos y 5 niños». Acepta número de clientes antiguos. */
  @IsOptional()
  @Transform(guestCountAsText)
  @IsString()
  @MaxLength(100)
  guestCount?: string;

  @IsOptional()
  @Transform(emptyStringAsUndefined)
  @IsString()
  customerName?: string;

  @IsOptional()
  @Transform(emptyStringAsUndefined)
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @Transform(emptyStringAsUndefined)
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @Transform(emptyStringAsUndefined)
  @IsString()
  menuNotes?: string;

  @IsOptional()
  @Transform(emptyStringAsUndefined)
  @IsString()
  observations?: string;

  @IsOptional()
  @Transform(emptyStringAsUndefined)
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsEnum(SalaTaskStatus)
  status?: SalaTaskStatus;
}

class ReorderSalaTaskItemDto {
  @IsString()
  id!: string;

  @IsEnum(SalaTaskStatus)
  status!: SalaTaskStatus;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder!: number;
}

export class ReorderSalaTasksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderSalaTaskItemDto)
  items!: ReorderSalaTaskItemDto[];
}
