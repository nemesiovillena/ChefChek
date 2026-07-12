export interface IngredientResponse {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  cost: number;
  /** Peso Bruto: cantidad usada en la receta, antes de mermas */
  grossWeight: number;
  /** Peso Neto: grossWeight * yieldFactor del producto (aprovechable real) */
  netWeight: number;
  /** Rendimiento (%): yieldFactor del producto * 100 */
  yieldPercentage: number;
  /** Merma (%): 100 - yieldPercentage (derivada de yieldFactor, no de Product.wastePercentage) */
  wastePercentage: number;
  /** Precio Compra: €/unidad de referencia del producto (purchasePrice / unitSize) */
  referencePurchasePrice: number;
  /** Precio Real: referencePurchasePrice ajustado por merma (/ yieldFactor) */
  realPrice: number;
  /** Unidad de referencia del producto (kg, L, ud) — para etiquetar referencePurchasePrice/realPrice */
  referenceUnit: string;
}

export interface SubRecipeResponse {
  id: string;
  subRecipeId: string;
  subRecipeName: string;
  quantity: number;
  unit: string;
  totalCost: number;
  costPerUnit: number;
  /** Costo de la cantidad usada, con la unidad ya convertida (g/kg/ml/L/ud/raciones) */
  cost: number;
}

export interface RecipeCategoryResponse {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
}

export interface RecipeCostBreakdown {
  ingredientsCost: number;
  subRecipesCost: number;
  totalCost: number;
  costPerPortion: number;
  costPerUnit: number;
}

/** Pricing derivado del escandallo: coste objetivo, margen bruto y PVP teórico */
export interface RecipePricing {
  /** % de coste objetivo, siempre el global de Configuración (informativo) */
  targetCostPercentage: number;
  /** 100 - targetCostPercentage */
  targetGrossMarginPercentage: number;
  /** Multiplicador aplicado al coste por ración para el PVP teórico, siempre el global de Configuración */
  theoreticalPriceMultiplier: number;
  /** PVP teórico = costPerPortion * theoreticalPriceMultiplier */
  theoreticalSellingPrice: number;
  /** PVP con IVA, manual (Recipe.sellingPriceWithVat); null si aún no se ha fijado */
  sellingPriceWithVat: number | null;
  /** PVP sin IVA = sellingPriceWithVat / 1.10 (IVA hostelería 10%); null si aún no se ha fijado */
  sellingPrice: number | null;
  /** sellingPrice - costPerPortion; null si no hay sellingPrice */
  grossMargin: number | null;
  /** (sellingPrice - costPerPortion) / sellingPrice * 100; null si no hay sellingPrice */
  grossMarginPercentage: number | null;
  /** % de coste real = costPerPortion / sellingPrice * 100; null si no hay sellingPrice */
  costPercentage: number | null;
}

/** Desglose de costo con el detalle por ingrediente/sub-receta (endpoint /calculate) */
export interface RecipeCostResponse extends RecipeCostBreakdown {
  ingredients: IngredientResponse[];
  subRecipes: SubRecipeResponse[];
  pricing: RecipePricing;
}

export interface RecipeResponse {
  id: string;
  name: string;
  description?: string;
  elaboration: string;
  portions: number;
  portionSize: number;
  totalCost: number;
  totalCostPerUnit: number;
  sellingPriceWithVat?: number | null;
  sellingPrice?: number | null;
  version: number;
  parentVersion?: string;
  isActive: boolean;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  ingredients?: IngredientResponse[];
  subRecipes?: SubRecipeResponse[];
  categories?: RecipeCategoryResponse[];
  costBreakdown?: RecipeCostBreakdown;
  pricing?: RecipePricing;
  allergens?: number[];
}
