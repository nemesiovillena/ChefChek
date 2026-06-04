import {
  IsEnum,
  IsArray,
  IsOptional,
  IsString,
  IsNumber,
} from "class-validator";

enum AllergenEU {
  CEREALS_WITH_GLUTEN = 1,
  CRUSTACEANS = 2,
  EGGS = 3,
  FISH = 4,
  PEANUTS = 5,
  SOY = 6,
  MILK = 7,
  CELERY = 8,
  MUSTARD = 9,
  SESAME_SEEDS = 10,
  SULFITES = 11,
  LUPIN = 12,
  MOLLUSCS = 13,
  MUSTARD_POWDER = 14,
}

export const ALLERGENS_INFO = [
  {
    id: 1,
    name: "Cereales con Gluten",
    icon: "🌾",
    color: "yellow",
    severity: "medium",
  },
  { id: 2, name: "Crustáceos", icon: "🦐", color: "red", severity: "high" },
  { id: 3, name: "Huevos", icon: "🥚", color: "orange", severity: "medium" },
  { id: 4, name: "Pescado", icon: "🐟", color: "blue", severity: "high" },
  { id: 5, name: "Cacahuetes", icon: "🥜", color: "brown", severity: "high" },
  { id: 6, name: "Soya", icon: "🫘", color: "green", severity: "medium" },
  { id: 7, name: "Leche", icon: "🥛", color: "cyan", severity: "medium" },
  { id: 8, name: "Apio", icon: "🥬", color: "lightgreen", severity: "low" },
  { id: 9, name: "Mostaza", icon: "🌭", color: "orange", severity: "medium" },
  {
    id: 10,
    name: "Semillas de Sésamo",
    icon: "🌰",
    color: "goldenrod",
    severity: "low",
  },
  { id: 11, name: "Sulfitos", icon: "🍷", color: "purple", severity: "high" },
  { id: 12, name: "Altramuces", icon: "🌱", color: "green", severity: "low" },
  { id: 13, name: "Moluscos", icon: "🐚", color: "blue", severity: "high" },
  {
    id: 14,
    name: "Mostaza en Polvo",
    icon: "⚪",
    color: "orange",
    severity: "medium",
  },
];

export class UpdateProductAllergensDto {
  @IsArray()
  @IsEnum(AllergenEU, { each: true })
  allergens: number[];
}

export class AllergenConflictDto {
  @IsString()
  recipeId: string;

  @IsArray()
  @IsNumber()
  filteredAllergens: number[];
}

export class AllergenComplianceReportDto {
  @IsString()
  menuId: string;

  @IsString()
  reportType: "FULL" | "SUMMARY";

  @IsOptional()
  @IsArray()
  @IsString()
  missingDeclarations?: string[];

  @IsOptional()
  @IsArray()
  @IsNumber()
  conflicts?: AllergenConflictDto[];
}
