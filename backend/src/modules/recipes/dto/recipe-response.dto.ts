export interface IngredientResponse {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  cost: number;
}

export interface SubRecipeResponse {
  id: string;
  subRecipeId: string;
  subRecipeName: string;
  quantity: number;
  unit: string;
  totalCost: number;
  costPerUnit: number;
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

export interface RecipeResponse {
  id: string;
  name: string;
  description?: string;
  elaboration: string;
  portions: number;
  portionSize: number;
  totalCost: number;
  totalCostPerUnit: number;
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
  allergens?: number[];
}
