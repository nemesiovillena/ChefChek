import { useCrud, useApiQuery } from './use-api';

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
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

// Categories CRUD hooks
const {
  useList,
  useGet,
  useCreate,
  useUpdate,
  useDelete,
} = useCrud<Category, CreateCategoryData, UpdateCategoryData>('/v1/categories', ['categories']);

export function useCategories() {
  return useList(1, 100);
}

export function useCategory(id: string) {
  return useGet(id);
}

export function useCategoryTree() {
  return useApiQuery<CategoryTreeNode[]>(
    ['categories', 'tree'],
    '/v1/categories/tree'
  );
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