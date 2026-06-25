import { useCrud as createCrudHooks, useApiQuery } from './use-api';

export type CategoryContext = 'articles' | 'recipes';

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  context: CategoryContext;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  isActive: boolean;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    products: number;
    recipes: number;
  };
  products?: Array<{
    id: string;
    name: string;
    purchasePrice: number;
    isActive: boolean;
  }>;
  recipes?: Array<{
    id: string;
    name: string;
    portions: number;
    isActive: boolean;
  }>;
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

export interface CreateCategoryData {
  name: string;
  slug: string;
  context: CategoryContext;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  isActive?: boolean;
  parentId?: string;
}

export interface UpdateCategoryData extends Partial<CreateCategoryData> {
  id: string;
}

// Keep useCrud for mutations (create, update, delete) — they don't need context.
// Aliased to a non-hook name because useCrud is a hook factory (it builds hooks,
// it does not itself call React hooks) and must run at module scope.
const {
  useGet,
  useCreate,
  useUpdate,
  useDelete,
} = createCrudHooks<Category, CreateCategoryData, UpdateCategoryData>('/v1/categories', ['categories']);

// Context-aware list hook — replaces useCrud's useList which doesn't support query params
export function useCategories(context?: CategoryContext) {
  const url = `/v1/categories${context ? `?context=${context}` : ''}`;
  const key = ['categories', context ?? 'all'];
  return useApiQuery<Category[]>(key, url);
}

export function useCategory(id: string) {
  return useGet(id);
}

// Context-aware tree hook — includes context in cache key to avoid cross-contamination
export function useCategoryTree(context?: CategoryContext) {
  const url = `/v1/categories/tree${context ? `?context=${context}` : ''}`;
  const key = ['categories', 'tree', context ?? 'all'];
  return useApiQuery<CategoryTreeNode[]>(key, url);
}

export function useCreateCategory() {
  return useCreate();
}

export function useUpdateCategory() {
  return useUpdate();
}

export function useDeleteCategory() {
  return useDelete();
}
