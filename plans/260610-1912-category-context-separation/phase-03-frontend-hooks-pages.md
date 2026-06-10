# Phase 3: Frontend Hooks + Pages

**Priority:** P1 | **Status:** pending | **Effort:** 1.5h

## Context Links

- `frontend/src/hooks/use-categories.ts` — Category hooks (useCategories, useCategoryTree, useCrud)
- `frontend/src/hooks/use-api.ts` — API query/mutation hooks (useApiQuery, useCrud factory)
- `frontend/src/app/dashboard/articulos/page.tsx` — Articles page (lines 8, 27-30)
- `frontend/src/app/dashboard/recipes/page.tsx` — Recipes page (lines 17, 32-33)
- `frontend/src/app/dashboard/articulos/components/articulo-modal.tsx` — Article modal (line 6)
- `frontend/src/app/dashboard/articulos/components/tab-proveedor-stock.tsx` — Stock tab (line 3)

## Overview

Update frontend category hooks to accept and pass a `context` parameter. Update Articles and Recipes pages to pass the appropriate context. This ensures each page only sees its own categories.

## Key Insights

- `use-categories.ts:54-60` — `useCrud` factory creates `useList`, `useGet`, etc. `useList` is called with `(1, 100)` — no query params supported currently.
- `use-categories.ts:62-64` — `useCategories()` wraps `useList(1, 100)` — no context param.
- `use-categories.ts:70-75` — `useCategoryTree()` uses `useApiQuery` with key `['categories', 'tree']` and URL `/v1/categories/tree`. Must include context in key and URL.
- `use-api.ts:97-103` — `useCrud` factory's `useList` calls `usePaginatedQuery(key, url)` — no param for query strings.
- `use-api.ts:14-35` — `useApiQuery` takes `key` and `url` strings — can embed query params in URL string directly.
- `articulos/page.tsx:8` — Imports `useCategoryTree`, `useCategories`, `CategoryTreeNode`
- `articulos/page.tsx:27-30` — Calls `useCategoryTree()` and `useCategories()` without context
- `recipes/page.tsx:17` — Imports `useCategories`, `Category`
- `recipes/page.tsx:32-33` — Calls `useCategories()` without context
- `articulo-modal.tsx:6` — Imports `useCategoryTree`, `CategoryTreeNode`; receives `tree` as prop
- `tab-proveedor-stock.tsx:3` — Imports `CategoryTreeNode`; receives `tree` as prop
- Recipes page line 498: Category checkboxes in create/edit form iterate ALL categories — this is the primary UX problem.

## Requirements

### Functional

- `useCategories(context?)` — accepts optional context param, passes `?context=` to API
- `useCategoryTree(context?)` — accepts optional context param, passes `?context=` to API and includes context in React Query key
- Articulos page calls `useCategories("articles")` and `useCategoryTree("articles")`
- Recipes page calls `useCategories("recipes")`
- Recipe create/edit form only shows recipe categories in checkboxes
- Article modal receives tree filtered by "articles" context (already via prop)

### Non-Functional

- React Query cache keys must include context to avoid stale/cross-contaminated data
- Hooks remain backward compatible — omitting context returns all categories
- No changes to tab-proveedor-stock (receives filtered tree via prop from articulo-modal)

## Architecture

### Hook API Changes

```typescript
// Before
useCategories()        → useList(1, 100)
useCategoryTree()      → useApiQuery(['categories', 'tree'], '/v1/categories/tree')

// After
useCategories(context?: 'articles' | 'recipes')
  → useApiQuery(['categories', context ?? 'all'], `/v1/categories${context ? `?context=${context}` : ''}`)

useCategoryTree(context?: 'articles' | 'recipes')
  → useApiQuery(['categories', 'tree', context ?? 'all'], `/v1/categories/tree${context ? `?context=${context}` : ''}`)
```

**Decision:** Drop `useList` (from `useCrud`) for categories. Replace with direct `useApiQuery` calls so we can control the URL with query params. The `useCrud` factory doesn't support query params on `useList`, and adding that capability just for categories violates YAGNI.

### Data Flow

```
Articulos page:
  useCategoryTree("articles") → GET /v1/categories/tree?context=articles
  useCategories("articles")   → GET /v1/categories?context=articles
  → tree prop → ArticuloModal → TabProveedorStock (no changes needed)

Recipes page:
  useCategories("recipes")    → GET /v1/categories?context=recipes
  → Category filter dropdown shows only recipe categories
  → Create/edit form checkboxes show only recipe categories
```

### Category Interface Update

```typescript
export interface Category {
  // ... existing fields ...
  context: 'articles' | 'recipes';  // new field
}
```

## Related Code Files

### Modify
- `frontend/src/hooks/use-categories.ts` — Add context param to useCategories, useCategoryTree; update Category interface
- `frontend/src/app/dashboard/articulos/page.tsx` — Pass "articles" context to hooks
- `frontend/src/app/dashboard/recipes/page.tsx` — Pass "recipes" context to hooks

### No Changes Needed
- `frontend/src/app/dashboard/articulos/components/articulo-modal.tsx` — Receives `tree` as prop from parent
- `frontend/src/app/dashboard/articulos/components/tab-proveedor-stock.tsx` — Receives `tree` as prop from modal
- `frontend/src/hooks/use-api.ts` — No changes; `useApiQuery` already supports arbitrary URL strings
- `frontend/src/hooks/use-recipes.ts` — No changes; recipes use RecipeCategory join by ID

## Implementation Steps

### 3.1 Update Category Interface and Hooks (`use-categories.ts`)

1. Add `context: 'articles' | 'recipes'` to `Category` interface (after `parentId`)
2. Add `context?: 'articles' | 'recipes'` to `CreateCategoryData` interface
3. Refactor `useCategories` to accept optional context:
   ```typescript
   export function useCategories(context?: 'articles' | 'recipes') {
     const url = `/v1/categories${context ? `?context=${context}` : ''}`;
     const key = ['categories', context ?? 'all'];
     return useApiQuery<Category[]>(key, url);
   }
   ```
4. Refactor `useCategoryTree` to accept optional context:
   ```typescript
   export function useCategoryTree(context?: 'articles' | 'recipes') {
     const url = `/v1/categories/tree${context ? `?context=${context}` : ''}`;
     const key = ['categories', 'tree', context ?? 'all'];
     return useApiQuery<CategoryTreeNode[]>(key, url);
   }
   ```
5. Remove `useCrud` destructuring for categories — no longer needed since `useList` doesn't support query params. Keep `useCreate`, `useUpdate`, `useDelete` via direct `useApiMutation` calls or keep partial `useCrud` for mutations only.

**Simplification:** Instead of fully removing `useCrud`, we can keep it for mutations (create, update, delete) which don't need context. Only replace the list/tree hooks:
```typescript
// Keep useCrud for mutations
const { useCreate, useUpdate, useDelete } = useCrud<Category, CreateCategoryData, UpdateCategoryData>(
  '/v1/categories', ['categories']
);

// Replace list/tree with context-aware versions
export function useCategories(context?: 'articles' | 'recipes') { ... }
export function useCategoryTree(context?: 'articles' | 'recipes') { ... }
```

### 3.2 Update Articulos Page (`articulos/page.tsx`)

1. Line 8: No import changes needed (same hook names)
2. Line 27: Change `useCategoryTree()` → `useCategoryTree("articles")`
3. Line 28: Change `useCategories()` → `useCategories("articles")`
4. No other changes — tree and categories data are consumed identically, just filtered now

### 3.3 Update Recipes Page (`recipes/page.tsx`)

1. Line 17: No import changes needed
2. Line 32: Change `useCategories()` → `useCategories("recipes")`
3. No other changes — category dropdown (line 298) and checkboxes (line 498) automatically show only recipe categories since `categories` array is now filtered

## Todo List

- [ ] Add `context` field to `Category` interface in use-categories.ts
- [ ] Add `context` to `CreateCategoryData` interface
- [ ] Refactor `useCategories` to accept optional context param
- [ ] Refactor `useCategoryTree` to accept optional context param
- [ ] Keep `useCrud` for create/update/delete mutations
- [ ] Update Articulos page to pass "articles" context to hooks
- [ ] Update Recipes page to pass "recipes" context to hooks
- [ ] Verify no other pages import useCategories or useCategoryTree

## Success Criteria

- Articulos page category dropdown shows only article categories (Alimentacion, Congelados, etc.)
- Articulos page subcategory dropdown shows only article subcategories
- Recipes page category dropdown shows only recipe categories (Aperitivos, Arroces, etc.)
- Recipes create/edit form checkboxes show only recipe categories
- React Query cache is properly scoped by context (no cross-contamination)
- Omitting context param returns all categories (backward compat)
- ArticuloModal receives filtered tree and works unchanged
- TabProveedorStock works unchanged

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| `useCrud` `useList` breakage when removing | Keep `useCrud` for mutations only; replace list/tree with `useApiQuery` directly |
| React Query stale cache on context switch | Query key includes context; cache is scoped per context |
| Breaking other consumers of useCategories | Grep confirms only 2 pages + 1 modal import it; modal receives tree as prop |
| Type mismatch on API response | Category interface adds `context` field; API returns it after Phase 2 |

## Next Steps

- All phases complete. Run full test suite and manual verification.
