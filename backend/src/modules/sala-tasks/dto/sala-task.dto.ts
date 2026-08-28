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

export class CreateSalaTaskDto {
  @IsString()
  title!: string;

  @Type(() => Date)
  @IsDate()
  eventDate!: Date;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  guestCount?: number;

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

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  guestCount?: number;

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
