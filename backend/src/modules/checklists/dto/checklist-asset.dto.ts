import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export const CHECKLIST_ASSET_CATEGORIES = [
  "FRIO",
  "COCINA",
  "CLIMATIZACION",
  "EXTINTORES",
  "PLAGAS",
  "ELECTRICO",
  "OTRO",
] as const;
export type ChecklistAssetCategory =
  (typeof CHECKLIST_ASSET_CATEGORIES)[number];

export class CreateChecklistAssetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  externalCode?: string;

  @IsIn(CHECKLIST_ASSET_CATEGORIES)
  category: ChecklistAssetCategory;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  provider?: string;
}

export class UpdateChecklistAssetDto extends CreateChecklistAssetDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
