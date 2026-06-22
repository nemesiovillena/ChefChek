---
title: "Subcategorias y Renombrado Productos → Articulos"
description: "Add hierarchical subcategories to the articles page and rename 'Productos' to 'Articulos' across the frontend"
status: pending
priority: P2
effort: 6h
branch: develop
tags: [frontend, seed-data, navigation, categories]
created: 2026-06-09
---

## Overview

Backend already supports category hierarchy (parentId, /categories/tree, 3-level deep). Work is: (1) seed subcategories, (2) implement chained dropdown filters on frontend, (3) rename "Productos" → "Articulos" in UI + route, (4) add subcategory field to create/edit modal.

## Phases

| # | Phase | Status | Effort | Dependencies |
|---|-------|--------|--------|-------------|
| 1 | Seed hierarchical categories | [ ] | 1h | None |
| 2 | Implement useCategoryTree hook | [ ] | 0.5h | None |
| 3 | Rename route + navigation "Productos" → "Articulos" | [ ] | 1h | None |
| 4 | Rewrite articles page with chained filters | [ ] | 2h | Phase 2, 3 |
| 5 | Add subcategory field to create/edit modal | [ ] | 1h | Phase 2, 4 |
| 6 | Update remaining "producto" references across pages | [ ] | 0.5h | Phase 3 |

## Key Insights

- **Backend is ready**: `Category` model at `schema.prisma:1008-1032` has `parentId`, `parent`/`children` via "CategoryHierarchy". `GET /api/v1/categories/tree` at `categories.controller.ts:52-59` returns hierarchical tree. `CreateCategoryDto` accepts `parentId` at `category.dto.ts:37-38`.
- **Frontend hook stubbed**: `useCategoryTree()` at `use-categories.ts:66-68` returns empty data — needs real implementation.
- **Current products page is basic**: `products/page.tsx` extracts category IDs from product data rather than using the categories API. Category filter shows raw IDs, not names. Form uses plain text inputs for category/supplier.
- **40 "producto" references** across frontend files. Route rename affects 4 files with href links.

## Dependency Graph

```
Phase 1 (seed) ─────────────────────────────────────┐
Phase 2 (useCategoryTree hook) ──────────┬──────────┤
Phase 3 (rename route+nav) ──────────────┼─────┬────┤
                                         ▼     ▼    ▼
Phase 4 (rewrite page + chained filters) ◄──────────┘
Phase 5 (modal subcategory field) ◄── Phase 2, 4
Phase 6 (remaining refs) ◄── Phase 3
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Seed fails on existing data (slug uniqueness) | Medium | High | Use upsert with `where: { tenantId_slug }` pattern, same as existing tenant/user seed |
| Route rename breaks bookmarks | Low | Low | Add Next.js redirect from `/dashboard/products` to `/dashboard/articulos` |
| Category tree endpoint returns flat list if no parentId set | High | Low | Seed phase creates all parents first, then children with parentId |
| useCategoryTree stub silently returns empty data | High | Medium | Phase 2 replaces stub with real API call; verify with seed data |

## Rollback Plan

- Phase 1: `npx prisma migrate reset` or delete seeded categories by tenant
- Phase 2-6: Git revert — all changes are frontend-only (no schema/API changes)
- Route: Remove redirect, rename folder back to `products`

## File Ownership

| Phase | Files Modified | No Overlap |
|-------|---------------|------------|
| 1 | `backend/prisma/seed.ts` | Yes |
| 2 | `frontend/src/hooks/use-categories.ts` | Yes |
| 3 | `frontend/src/app/dashboard/products/` → `articulos/`, `layout.tsx`, `recipes/page.tsx` | Yes |
| 4 | `frontend/src/app/dashboard/articulos/page.tsx` | Yes (after phase 3 rename) |
| 5 | `frontend/src/app/dashboard/articulos/page.tsx` | Same file as phase 4 — sequential |
| 6 | `frontend/src/app/dashboard/ocr-ai/page.tsx`, `ingestion/page.tsx`, `technical-sheets/page.tsx`, `allergens/page.tsx`, `warehouse/page.tsx`, `recipes/page.tsx` | Yes |

## Success Criteria

1. Running `npx prisma db seed` creates 7 parent categories with subcategories (28+ total children)
2. `GET /api/v1/categories/tree` returns hierarchy with `children` arrays populated
3. Navigating to `/dashboard/articulos` shows the articles page
4. `/dashboard/products` redirects to `/dashboard/articulos`
5. Category dropdown shows parent categories; selecting one enables subcategory dropdown with its children
6. No "Productos" label remains in sidebar, navigation, or page titles (only "Articulos")
7. Create/edit modal has category + subcategory dropdowns; subcategory is disabled until category selected
8. Backend API endpoints remain unchanged (`/v1/products`, `/v1/categories`)
