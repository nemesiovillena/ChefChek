---
title: "Category Context Separation"
description: "Add context enum to Category model to separate articles categories from recipes categories in the UI"
status: pending
priority: P1
effort: 3h
branch: develop
tags: [backend, frontend, schema, migration]
created: 2026-06-10
---

## Problem

Single `Category` model shared between Articulos (inventory items) and Recetas (recipes). No distinction in DB or API, causing mixed categories in both UI pages. Recipe categories like "Aperitivos, Arroces, Pescados" appear alongside article categories like "Verduras, Aceites, Especias" in dropdowns and filters.

## Solution

Add `context` enum field (`"articles"` | `"recipes"`) to the Category model. Update unique constraint to `@@unique([tenantId, context, slug])`. Add optional `?context=` query param to backend endpoints. Frontend passes context when fetching categories.

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | [Schema + Migration](phase-01-schema-migration.md) | pending | 30m |
| 2 | [Backend API + Seed](phase-02-backend-api-seed.md) | pending | 1h |
| 3 | [Frontend Hooks + Pages](phase-03-frontend-hooks-pages.md) | pending | 1.5h |

## Dependency Graph

```
Phase 1 (schema) → Phase 2 (backend) → Phase 3 (frontend)
```

## Key Data Flow

```
DB: categories.context = "articles" | "recipes"
  ↓
API: GET /v1/categories?context=articles → filters by context
     GET /v1/categories/tree?context=articles → tree filtered by context
  ↓
Frontend hooks: useCategories(context?) → passes ?context= to API
                useCategoryTree(context?) → passes ?context= to API
  ↓
Pages: ArticulosPage passes context="articles"
       RecipesPage passes context="recipes"
```

## Backward Compatibility

- `context` field defaults to `"articles"` in migration (existing categories are article categories)
- API `?context=` param is optional — omitting it returns all categories (current behavior preserved)
- Frontend will always pass context explicitly from now on
- Existing clients calling API without context get same results as before

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Migration fails on prod data | Low | High | Default value in migration; seed uses upsert |
| Recipe categories missing context | Medium | Medium | Seed migration step sets context on recipe cats |
| Unique constraint violation on `tenantId+context+slug` | Low | High | Slugs already differ between article/recipe cats in seed |
| Frontend cache stale after context filter | Low | Low | React Query key includes context param |

## Rollback Plan

1. Revert migration: `npx prisma migrate revert`
2. Revert backend: remove context param from controller/service
3. Revert frontend: remove context from hooks/pages
4. Each phase is independently revertible

## File Ownership

| Phase | Files |
|-------|-------|
| 1 | `backend/prisma/schema.prisma`, migration file |
| 2 | `backend/prisma/seed.ts`, `backend/src/modules/categories/` |
| 3 | `frontend/src/hooks/use-categories.ts`, `frontend/src/app/dashboard/articulos/`, `frontend/src/app/dashboard/recipes/` |

## Success Criteria

- [ ] `context` enum exists in Prisma schema on Category model
- [ ] Unique constraint is `[tenantId, context, slug]`
- [ ] Migration applies cleanly with default values
- [ ] Seed tags all categories with correct context
- [ ] `GET /v1/categories?context=articles` returns only article categories
- [ ] `GET /v1/categories?context=recipes` returns only recipe categories
- [ ] `GET /v1/categories` (no context) returns all categories
- [ ] `GET /v1/categories/tree?context=articles` returns only article tree
- [ ] Articulos page dropdown shows only article categories
- [ ] Recipes page dropdown shows only recipe categories
- [ ] Recipe create/edit form shows only recipe category checkboxes
