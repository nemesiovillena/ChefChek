## Phase 1: Seed Hierarchical Categories

**Priority:** P2 | **Status:** [ ] | **Effort:** 1h | **Depends on:** None

### Context Links
- Schema: `backend/prisma/schema.prisma:1008-1032` (Category model with parentId)
- Current seed: `backend/prisma/seed.ts:44-96` (flat categories, no parentId)
- DTO: `backend/src/modules/categories/dto/category.dto.ts:37-38` (parentId accepted)
- Service: `backend/src/modules/categories/categories.service.ts:175-208` (getTree returns 3-level hierarchy)

### Overview
Replace the 5 flat product categories in seed.ts with 7 hierarchical parent categories and their subcategories. The current seed creates: Verduras, Granos, Carnes, Aceites, Especias — these are too granular and lack hierarchy.

### Key Insights
- Existing categories have `sortOrder` 1-5. New parents will use `sortOrder` 1-7. Children use `sortOrder` within their parent scope.
- Must use upsert pattern (`where: { tenantId_slug }`) to avoid slug conflicts on re-seed.
- Products currently reference `categories[0-4]`. After seed rewrite, products must reference subcategory IDs instead of parent IDs.
- Recipe categories (sortOrder 10-17) are separate and should NOT be modified.

### Requirements
- Create 7 parent categories (Alimentacion, Congelados, Alcoholes, Bebidas no alcoholicas, Limpieza, Desechables, Utensilios)
- Create ~30 subcategories under the parents
- Update product seed data to reference subcategory IDs
- Use upsert pattern for idempotent seeding

### Architecture — Data Flow

```
seed.ts
  ├─ upsert parent categories (parentId: null, sortOrder: 1-7)
  │   └─ each returns { id, slug, ... }
  ├─ upsert child categories (parentId: <parent.id>, sortOrder: 1-N)
  │   └─ each returns { id, slug, ... }
  └─ upsert products (categoryId: <child.id>)  ← reference subcategory, not parent
```

### Related Code Files
- **Modify:** `backend/prisma/seed.ts`

### Implementation Steps

1. **Replace the product categories block** (lines 44-96 in current seed.ts). Remove the 5 flat categories.
2. **Create 7 parent categories** using upsert pattern:
   ```
   Alimentacion (slug: alimentacion, sortOrder: 1)
   Congelados (slug: congelados, sortOrder: 2)
   Alcoholes (slug: alcoholes, sortOrder: 3)
   Bebidas no alcoholicas (slug: bebidas-no-alcoholicas, sortOrder: 4)
   Limpieza (slug: limpieza, sortOrder: 5)
   Desechables (slug: desechables, sortOrder: 6)
   Utensilios (slug: utensilios, sortOrder: 7)
   ```
3. **Create subcategories** — store parent references, then create children:
   - Alimentacion → aceite, cafe, lacteos, pan, arroz-pasta, conservas, condimentos
   - Congelados → pescado, carne, helados, verduras, precocinados
   - Alcoholes → brandy, ginebras, ron, whisky, vino, cerveza, licores
   - Bebidas no alcoholicas → refrescos, zumos, aguas, infusiones
   - Limpieza → cocina, sala, lavanderia, desinfeccion
   - Desechables → papel, plasticos, embalaje
   - Utensilios → cocina, sala, mantenimiento
4. **Update product references** — map each existing product to an appropriate subcategory:
   - Tomates → alimentacion > condimentos (or a new "verduras" subcategory under Alimentacion)
   - Arroz Bomba → alimentacion > arroz-pasta
   - Pollo de Corral → congelados > carne
   - Aceite de Oliva → alimentacion > aceite
   - Azafran → alimentacion > condimentos
5. **Keep recipe categories unchanged** (lines 98-196 in current seed.ts)

### Todo List
- [ ] Replace flat product categories with upsert-based parent categories
- [ ] Add child categories with parentId references
- [ ] Update product categoryId to use subcategory IDs
- [ ] Verify seed runs idempotently (run twice, no errors)

### Success Criteria
- `npx prisma db seed` creates 7 parent + ~30 child categories
- `GET /api/v1/categories/tree` returns parents with `children` arrays populated
- Products reference subcategory IDs, not parent IDs
- Seed is idempotent (upsert pattern)

### Risk Assessment
| Risk | Mitigation |
|------|-----------|
| Slug conflict on re-seed | Use `upsert` with `where: { tenantId_slug: { tenantId, slug } }` |
| Product references break if category IDs change | Assign categories to variables, reference by variable not index |

### Security Considerations
- No security impact — seed runs with admin privileges, no user-facing endpoints changed

### Next Steps
- Phase 2 can proceed in parallel (implement useCategoryTree hook)
