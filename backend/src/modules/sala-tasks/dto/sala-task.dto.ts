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
import { Type } from "class-transformer";

export enum SalaTaskStatus {
  PENDIENTE = "PENDIENTE",
  EN_CURSO = "EN_CURSO",
  COMPLETADO = "COMPLETADO",
}

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
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  menuNotes?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
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
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  menuNotes?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
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
