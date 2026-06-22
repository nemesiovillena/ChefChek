## Phase 6: Update Remaining "Producto" References Across Pages

**Priority:** P2 | **Status:** [ ] | **Effort:** 0.5h | **Depends on:** Phase 3

### Context Links
- Full grep results: 40 "producto/Producto/PRODUCTO" references across frontend
- Phase 3 already handled: layout.tsx, articulos/page.tsx, recipes/page.tsx (nav links only)
- Remaining files with "producto" references listed below

### Overview
Update all remaining "producto" labels in other dashboard pages to use "articulo" terminology. This is a UI-label-only change — no route or API changes needed in these files.

### Key Insights
- Some references are in context-specific UI where "producto" describes the domain concept (e.g., "reconocimiento de productos" in OCR/AI page). These should be updated to "articulos" for consistency.
- Some references are in descriptive text, not navigation — still update for naming consistency.
- The `warehouse/page.tsx` table header "Producto" refers to the product column — update to "Articulo".
- The `allergens/page.tsx` uses "productos" in a count display — update.
- Do NOT change variable names, API calls, or TypeScript types in these files — only user-visible labels.

### Files with Remaining References

| File | Line(s) | Current Text | New Text |
|------|---------|-------------|----------|
| `ingestion/page.tsx` | 160 | "reconocimiento de productos" | "reconocimiento de articulos" |
| `ingestion/page.tsx` | 215 | "productos" (count display) | "articulos" |
| `ingestion/page.tsx` | 355 | "reconocimiento de productos" | "reconocimiento de articulos" |
| `ingestion/page.tsx` | 369 | "Ingesta de Productos" | "Ingesta de Articulos" |
| `ingestion/page.tsx` | 371 | "reconocimiento de productos mediante IA" | "reconocimiento de articulos mediante IA" |
| `ocr-ai/page.tsx` | 60 | "Productos" (tab title) | "Articulos" |
| `ocr-ai/page.tsx` | 294 | "Auto-Crear Productos" | "Auto-Crear Articulos" |
| `ocr-ai/page.tsx` | 296 | "Crear productos automaticamente" | "Crear articulos automaticamente" |
| `ocr-ai/page.tsx` | 306 | "costes de productos ya existentes" | "costes de articulos ya existentes" |
| `ocr-ai/page.tsx` | 452 | "Productos Creados Automaticamente" | "Articulos Creados Automaticamente" |
| `ocr-ai/page.tsx` | 455 | "Crear Producto Manual" | "Crear Articulo Manual" |
| `ocr-ai/page.tsx` | 486 | "Estado de Productos" | "Estado de Articulos" |
| `ocr-ai/page.tsx` | 619 | "Costes de productos" | "Costes de articulos" |
| `ocr-ai/page.tsx` | 820 | "Productos Creados" | "Articulos Creados" |
| `technical-sheets/page.tsx` | 141 | "fichas tecnicas para productos" | "fichas tecnicas para articulos" |
| `technical-sheets/page.tsx` | 171 | "Ficha tecnica de producto XYZ" | "Ficha tecnica de articulo XYZ" |
| `technical-sheets/page.tsx` | 227 | "documentar productos" | "documentar articulos" |
| `allergens/page.tsx` | 258 | "productos" (count) | "articulos" |
| `warehouse/page.tsx` | 387 | "Producto" (table header) | "Articulo" |
| `recipes/page.tsx` | 573 | "Seleccionar producto" | "Seleccionar articulo" |
| `recipes/page.tsx` | 726 | "Producto" (column header) | "Articulo" |

Note: `recipes/page.tsx:226` ("Productos" nav link) was handled in Phase 3.

### Related Code Files
- **Modify:** `frontend/src/app/dashboard/ingestion/page.tsx`
- **Modify:** `frontend/src/app/dashboard/ocr-ai/page.tsx`
- **Modify:** `frontend/src/app/dashboard/technical-sheets/page.tsx`
- **Modify:** `frontend/src/app/dashboard/allergens/page.tsx`
- **Modify:** `frontend/src/app/dashboard/warehouse/page.tsx`
- **Modify:** `frontend/src/app/dashboard/recipes/page.tsx` (remaining refs only)

### Implementation Steps

1. **ingestion/page.tsx** — 5 replacements. All are UI labels.
2. **ocr-ai/page.tsx** — 9 replacements. All are UI labels. Do NOT change variable names like `recognizedProducts` or function names.
3. **technical-sheets/page.tsx** — 3 replacements. All are UI labels.
4. **allergens/page.tsx** — 1 replacement. UI label only.
5. **warehouse/page.tsx** — 1 replacement. Table header.
6. **recipes/page.tsx** — 2 replacements (lines 573, 726). Nav link at 225-227 already handled in Phase 3.

### Todo List
- [ ] Update ingestion/page.tsx (5 refs)
- [ ] Update ocr-ai/page.tsx (9 refs)
- [ ] Update technical-sheets/page.tsx (3 refs)
- [ ] Update allergens/page.tsx (1 ref)
- [ ] Update warehouse/page.tsx (1 ref)
- [ ] Update recipes/page.tsx remaining refs (2 refs)
- [ ] Grep to verify zero remaining "producto" UI labels

### Success Criteria
- `grep -rn "producto\|Producto\|PRODUCTO" frontend/src/ --include="*.tsx"` returns zero results (or only variable/type names that are internal, not user-visible)
- No user-visible text says "producto" anywhere in the frontend
- All pages consistently use "articulo" terminology

### Risk Assessment
| Risk | Mitigation |
|------|-----------|
| Accidentally rename TypeScript variable/property names | Only change string literals in JSX, not identifiers or API field names |
| Miss a reference in a file not found by grep | Final grep verification catches stragglers |

### Rollback
- Git revert — all changes are string literal replacements in JSX
