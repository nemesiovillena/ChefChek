import {
  IsEnum,
  IsArray,
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
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
  TREE_NUTS = 14,
}

export const ALLERGENS_INFO = [
  { id: 1, name: "Gluten", icon: "🌾", color: "yellow", severity: "medium" },
  { id: 2, name: "Crustáceos", icon: "🦐", color: "red", severity: "high" },
  { id: 3, name: "Huevos", icon: "🥚", color: "orange", severity: "medium" },
  { id: 4, name: "Pescado", icon: "🐟", color: "blue", severity: "high" },
  { id: 5, name: "Cacahuetes", icon: "🥜", color: "brown", severity: "high" },
  { id: 6, name: "Soja", icon: "🫘", color: "green", severity: "medium" },
  { id: 7, name: "Leche", icon: "🥛", color: "cyan", severity: "medium" },
  { id: 8, name: "Apio", icon: "🥬", color: "lightgreen", severity: "low" },
  { id: 9, name: "Mostaza", icon: "🌭", color: "orange", severity: "medium" },
  // No existe emoji de sésamo; 🌻 es el más cercano a "semillas" sin
  // duplicar los ya usados (🫘 soja, 🌱 altramuces, 🌾 gluten, 🌰 frutos de cáscara).
  { id: 10, name: "Sésamo", icon: "🌻", color: "goldenrod", severity: "low" },
  { id: 11, name: "Sulfitos", icon: "🍷", color: "purple", severity: "high" },
  { id: 12, name: "Altramuces", icon: "🌱", color: "green", severity: "low" },
  { id: 13, name: "Moluscos", icon: "🐚", color: "blue", severity: "high" },
  // UE-1169 exige declarar frutos de cáscara (almendras, avellanas, nueces,
  // anacardos, pacanas, nueces de Brasil, pistachos, macadamias). El antiguo
  // "Mostaza en Polvo" duplicaba la mostaza (id 9) y no es un alérgeno oficial.
  {
    id: 14,
    name: "Frutos de Cáscara",
    icon: "🌰",
    color: "brown",
    severity: "high",
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

export class CreateAllergenDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  nameEu1169?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  severity?: string;
}

export class UpdateAllergenDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  nameEu1169?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
