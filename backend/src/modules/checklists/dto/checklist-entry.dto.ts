import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

/** Una marca dentro del lote que envía la pantalla táctil al guardar. */
export class ChecklistEntryInputDto {
  @IsString()
  itemId: string;

  // TASK (mode EXECUTION) u CONDITION (mode INSPECTION), según el modo de la plantilla.
  @IsOptional()
  @IsIn(["DONE", "NOT_DONE", "OK", "BAD"])
  outcome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observation?: string;

  // MEASUREMENT.
  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  correctiveAction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  /** Persona real que ejecutó el ítem (selector, cuenta compartida en cocina). */
  @IsOptional()
  @IsString()
  performedByUserId?: string;

  @IsString()
  @MaxLength(200)
  performedByName: string;

  /** Marca a la que corrige (histórico se conserva; esta pasa a ser la vigente). */
  @IsOptional()
  @IsString()
  correctsEntryId?: string;
}

export class CreateChecklistEntriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChecklistEntryInputDto)
  entries: ChecklistEntryInputDto[];
}

export class SuperviseChecklistRunDto {
  @IsString()
  @MaxLength(200)
  supervisorName: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  supervisorNote?: string;
}
