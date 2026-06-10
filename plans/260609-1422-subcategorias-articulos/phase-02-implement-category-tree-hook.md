## Phase 2: Implement useCategoryTree Hook

**Priority:** P2 | **Status:** [ ] | **Effort:** 0.5h | **Depends on:** None

### Context Links
- Current stub: `frontend/src/hooks/use-categories.ts:66-68`
- API endpoint: `backend/src/modules/categories/categories.controller.ts:52-59` (`GET /api/v1/categories/tree`)
- API client: `frontend/src/lib/api-client.ts`
- Query factory: `frontend/src/hooks/use-api.ts:14-35` (`useApiQuery`)

### Overview
Replace the stubbed `useCategoryTree()` hook with a real implementation that calls `GET /api/v1/categories/tree` and returns hierarchical data with `children` arrays.

### Key Insights
- Current stub at `use-categories.ts:66-68` returns `{ data: [], isLoading: false, error: null, refetch: () => {} }` — completely non-functional.
- Backend `getTree` at `categories.service.ts:175-208` returns root categories with 3-level nested `children` include.
- `useApiQuery` factory at `use-api.ts:14-35` handles query key, fetch, and error transformation. Can be used directly.
- Category interface at `use-categories.ts:3-32` already has `parentId` field but is missing `children` field — needs extension.

### Requirements
- Hook calls `GET /api/v1/categories/tree`
- Returns `UseQueryResult` with typed hierarchical category data
- Category interface includes `children` array
- Query key: `['categories', 'tree']`
- Invalidated when categories are created/updated/deleted (existing invalidation pattern covers this)

### Architecture — Data Flow

```
Component
  └─ useCategoryTree()
       └─ useApiQuery<CategoryTreeNode[]>(['categories', 'tree'], '/api/v1/categories/tree')
            └─ apiClient.get('/api/v1/categories/tree')
                 └─ Backend: CategoriesService.getTree()
                      └─ Prisma: findMany({ where: { parentId: null }, include: { children: { include: { children: true } } } })
```

### Related Code Files
- **Modify:** `frontend/src/hooks/use-categories.ts`

### Implementation Steps

1. **Add `CategoryTreeNode` interface** extending `Category` with `children` array:
   ```ts
   export interface CategoryTreeNode extends Category {
     children: CategoryTreeNode[];
     _count?: {
       products: number;
       recipes: number;
     };
   }
   ```

2. **Replace `useCategoryTree` stub** with real implementation:
   ```ts
   export function useCategoryTree() {
     return useApiQuery<CategoryTreeNode[]>(
       ['categories', 'tree'],
       '/api/v1/categories/tree'
     );
   }
   ```

3. **Import `useApiQuery`** from `./use-api` (already imported via `useCrud` but `useApiQuery` needs explicit import).

4. **Verify** query invalidation: `useCrud` at `use-categories.ts:56` uses query key `['categories']` — all category mutations invalidate this prefix, which covers `['categories', 'tree']` too. No change needed.

### Todo List
- [ ] Add `CategoryTreeNode` interface with `children` field
- [ ] Import `useApiQuery` from use-api
- [ ] Replace `useCategoryTree` stub with real API call
- [ ] Verify query invalidation on category CRUD operations

### Success Criteria
- `useCategoryTree()` returns hierarchical data with `children` arrays
- Loading and error states work correctly
- Query is invalidated when categories are mutated via other hooks

### Risk Assessment
| Risk | Mitigation |
|------|-----------|
| Backend returns empty tree if no seed data | Phase 1 seeds the data; hook should handle empty array gracefully |
| Type mismatch between Category and CategoryTreeNode | Extend interface; no breaking change to existing `useCategories` hook |

### Next Steps
- Phase 4 and 5 depend on this hook being functional
