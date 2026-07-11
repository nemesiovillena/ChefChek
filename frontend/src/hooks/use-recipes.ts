import { useCrud as createCrudHooks } from './use-api';
import { useApiQuery } from './use-api';
import { PaginatedResponse } from '@/types/api.types';

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

export interface RecipePricing {
  targetCostPercentage: number;
  targetGrossMarginPercentage: number;
  theoreticalSellingPrice: number;
  sellingPriceWithVat: number | null;
  sellingPrice: number | null;
  grossMargin: number | null;
  grossMarginPercentage: number | null;
  costPercentage: number | null;
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
  sellingPriceWithVat?: number | null;
  sellingPrice?: number | null;
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
  pricing?: RecipePricing;
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
  sellingPriceWithVat?: number;
}

export interface UpdateRecipeData extends Partial<CreateRecipeData> {
  id: string;
  isActive?: boolean;
}

export interface RecipeCostIngredient {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  cost: number;
  grossWeight: number;
  netWeight: number;
  yieldPercentage: number;
  wastePercentage: number;
  referencePurchasePrice: number;
  realPrice: number;
  referenceUnit: string;
}

export interface RecipeCost {
  recipeId: string;
  totalCost: number;
  costPerPortion: number;
  ingredients: RecipeCostIngredient[];
  subRecipes?: RecipeSubRecipeItem[];
  pricing: RecipePricing;
}

// Recipes CRUD hooks.
// useCrud is a hook factory (builds hooks, does not itself call React hooks);
// aliased to a non-hook name so it can run at module scope.
const {
  useGet,
  useCreate,
  useUpdate,
  useDelete,
} = createCrudHooks<Recipe, CreateRecipeData, UpdateRecipeData>('/v1/recipes', ['recipes']);

export interface RecipesQuery {
  search?: string;
  category?: string;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

function buildRecipesQueryString(query?: RecipesQuery): string {
  if (!query) return '';
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.category) params.set('category', query.category);
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('limit', String(query.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Listado de recetas paginado/filtrado en servidor. La respuesta ya viene
 * desenvuelta por el interceptor global de apiClient: { data, total, page,
 * pageSize, totalPages, hasNext, hasPrevious } (ver api-client.ts).
 */
export function useRecipes(query?: RecipesQuery) {
  return useApiQuery<PaginatedResponse<Recipe>>(
    ['recipes', JSON.stringify(query ?? {})],
    `/v1/recipes${buildRecipesQueryString(query)}`
  );
}

/**
 * Listado ligero (id+nombre) de recetas activas, sin paginar — para pickers
 * (p.ej. combobox de sub-recetas), que necesitan elegir entre TODAS las
 * recetas, no solo la página visible del listado principal (paginado).
 */
export function useRecipeOptions() {
  return useApiQuery<{ id: string; name: string }[]>(
    ['recipe-options'],
    '/v1/recipes/options'
  );
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