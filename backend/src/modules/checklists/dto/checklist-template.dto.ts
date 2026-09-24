import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import {
  CHECKLIST_FREQUENCIES,
  ChecklistFrequency,
} from "../util/checklist-period.util";

export const CHECKLIST_KINDS = [
  "CLEANING",
  "OPENING",
  "CLOSING",
  "COMFORT",
  "SUSTAINABILITY",
  "RECEPTION",
  "MAINTENANCE",
  "OTHER",
] as const;
export type ChecklistKind = (typeof CHECKLIST_KINDS)[number];

export const CHECKLIST_MODES = [
  "EXECUTION",
  "INSPECTION",
  "MEASUREMENT",
] as const;
export type ChecklistMode = (typeof CHECKLIST_MODES)[number];

export const CHECKLIST_ITEM_FREQUENCIES = [
  ...CHECKLIST_FREQUENCIES,
  "AFTER_EACH_USE",
  "AS_NEEDED",
] as const;

/** Módulos que pueden consumir una plantilla del motor compartido. */
export const CHECKLIST_CONSUMER_MODULES = ["sicted", "appcc"] as const;
export type ChecklistConsumerModule =
  (typeof CHECKLIST_CONSUMER_MODULES)[number];

export class ChecklistTemplateItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label: string;

  @IsOptional()
  @IsIn(CHECKLIST_ITEM_FREQUENCIES)
  itemFrequency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  procedure?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  products?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  dosage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  epi?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsNumber()
  expectedRangeMin?: number;

  @IsOptional()
  @IsNumber()
  expectedRangeMax?: number;
}

export class CreateChecklistTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  externalCode?: string;

  @IsIn(CHECKLIST_KINDS)
  kind: ChecklistKind;

  @IsIn(CHECKLIST_MODES)
  mode: ChecklistMode;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  area: string;

  @IsIn(CHECKLIST_FREQUENCIES)
  frequency: ChecklistFrequency;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  responsiblePosition?: string;

  @IsOptional()
  @IsBoolean()
  requiresSupervisor?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  practiceRef?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChecklistTemplateItemDto)
  items: ChecklistTemplateItemDto[];
}

/** PATCH: reemplazo completo de campos + ítems (versión sube automáticamente). */
export class UpdateChecklistTemplateDto extends CreateChecklistTemplateDto {}
