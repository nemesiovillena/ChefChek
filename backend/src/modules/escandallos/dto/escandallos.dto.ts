export interface CostBreakdownDto {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  ingredientCost: number;
  wastageCost: number;
  totalCost: number;
}

export interface RecipeDetailedCostDto {
  recipeId: string;
  recipeName: string;
  portions: number;
  portionSize: number;
  ingredientsCost: number;
  subRecipesCost: number;
  wastageCost: number;
  totalCost: number;
  costPerPortion: number;
  costPerUnit: number;
  costBreakdown: CostBreakdownDto[];
}

export interface CostVariationDto {
  recipeId: string;
  recipeName: string;
  previousCost: number;
  currentCost: number;
  variation: number;
  variationPercentage: number;
  date: Date;
  reason?: string;
}

export interface CostProjectionDto {
  recipeId: string;
  recipeName: string;
  projectedCost: number;
  confidence: number;
  trend: "INCREASING" | "DECREASING" | "STABLE";
  factors: {
    ingredientPriceTrend: number;
    consumptionPattern: number;
    seasonalFactor: number;
  };
}

export interface CostAnalysisDto {
  recipeId: string;
  recipeName: string;
  totalCost: number;
  costPerPortion: number;
  margin: number;
  sellingPrice?: number;
  profitability: number;
  variations: CostVariationDto[];
  projections: CostProjectionDto[];
}

export interface CreateEscandalloDto {
  recipeId: string;
  name: string;
  description?: string;
  targetCost?: number;
  targetMargin?: number;
}

export interface UpdateEscandalloDto {
  name?: string;
  description?: string;
  targetCost?: number;
  targetMargin?: number;
}

export interface GenerateEscandalloReportDto {
  recipeId?: string;
  startDate?: Date;
  endDate?: Date;
  includeVariations?: boolean;
  includeProjections?: boolean;
  format?: "JSON" | "PDF" | "EXCEL";
}

export interface UnitConversionDto {
  fromUnit: string;
  toUnit: string;
  quantity: number;
  productId: string;
}
