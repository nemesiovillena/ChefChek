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

// Alineado con CreateCategoryDto del backend (forbidNonWhitelisted: no admite sortOrder)
export interface CreateCategoryData {
  name: string;
  slug: string;
  context: CategoryContext;
  description?: string;
  icon?: string;
  color?: string;
  isActive?: boolean;
  parentId?: string;
}

export interface UpdateCategoryData extends Partial<Omit<CreateCategoryData, 'parentId'>> {
  id: string;
  sortOrder?: number;
  // null desvincula la categoría padre; undefined la deja sin cambios
  parentId?: string | null;
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

/**
 * Fusiona categorías creadas en línea (p.ej. desde un diálogo quick-create)
 * con el árbol recibido por props, para que sean visibles/seleccionables al
 * instante sin esperar al refetch de useCategoryTree. Deduplica contra el
 * árbol: cuando el refetch llega, la categoría ya viene por props y se ignora
 * la copia local.
 */
export function mergeAddedCategories(tree: CategoryTreeNode[], added: Category[]): CategoryTreeNode[] {
  if (!added.length) return tree;
  const topLevel = added.filter((c) => !c.parentId);
  const children = added.filter((c) => c.parentId);

  let result = [...tree];
  for (const c of topLevel) {
    if (!result.some((n) => n.id === c.id)) result.push({ ...c, children: [] });
  }
  result = result.map((parent) => {
    const kids = children.filter((c) => c.parentId === parent.id);
    if (!kids.length) return parent;
    const merged = [...(parent.children ?? [])];
    for (const k of kids) {
      if (!merged.some((m) => m.id === k.id)) merged.push({ ...k, children: [] });
    }
    return { ...parent, children: merged };
  });
  return result;
}
