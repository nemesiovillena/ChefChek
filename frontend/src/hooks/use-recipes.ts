import { useCrud as createCrudHooks } from './use-api';
import { useApiQuery } from './use-api';

export interface RecipeIngredient {
  productId: string;
  productName?: string;
  quantity: number;
  unit: string;
}

export interface RecipeSubRecipeItem {
  id: string;
  subRecipeId: string;
  subRecipeName: string;
  quantity: number;
  unit: string;
  totalCost: number;
  costPerUnit: number;
  /** Costo de la cantidad usada, con la unidad ya convertida por el backend */
  cost: number;
}

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  elaboration?: string;
  notes?: string;
  imageUrl?: string;
  sourceUrl?: string;
  portions: number;
  portionSize?: number;
  totalCost: number;
  totalCostPerUnit?: number;
  version?: number;
  parentVersion?: string | null;
  isActive: boolean;
  isPublic: boolean;
  ingredients: RecipeIngredient[];
  subRecipes?: RecipeSubRecipeItem[];
  categories?: RecipeCategory[];
  costBreakdown?: {
    ingredientsCost: number;
    subRecipesCost: number;
    totalCost: number;
    costPerPortion: number;
    costPerUnit: number;
  };
  allergens: number[];
  createdAt: string;
  updatedAt: string;
}

export interface RecipeCategory {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
}

export interface CreateRecipeData {
  name: string;
  description?: string;
  elaboration?: string;
  notes?: string;
  imageUrl?: string;
  sourceUrl?: string;
  portions: number;
  portionSize?: number;
  ingredients: RecipeIngredient[];
  subRecipes?: Array<{ subRecipeId: string; quantity: number; unit: string }>;
  categoryIds?: string[];
  allergens?: number[];
}

export interface UpdateRecipeData extends Partial<CreateRecipeData> {
  id: string;
  isActive?: boolean;
}

export interface RecipeCost {
  recipeId: string;
  totalCost: number;
  costPerPortion: number;
  ingredients: {
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    cost: number;
  }[];
}

// Recipes CRUD hooks.
// useCrud is a hook factory (builds hooks, does not itself call React hooks);
// aliased to a non-hook name so it can run at module scope.
const {
  useList,
  useGet,
  useCreate,
  useUpdate,
  useDelete,
} = createCrudHooks<Recipe, CreateRecipeData, UpdateRecipeData>('/v1/recipes', ['recipes']);

export function useRecipes(query?: { search?: string; category?: string }, page: number = 1, pageSize: number = 50) {
  return useList(page, pageSize);
}

export function useRecipe(id: string) {
  return useGet(id);
}

export function useCreateRecipe() {
  return useCreate();
}

export function useUpdateRecipe() {
  return useUpdate();
}

export function useDeleteRecipe() {
  return useDelete();
}

export function useRecipeCost(id: string) {
  return useApiQuery<RecipeCost>(
    ['recipe-cost', id],
    `/v1/recipes/${id}/calculate`,
    {
      enabled: !!id,
    },
  );
}