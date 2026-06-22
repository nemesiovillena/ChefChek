# Phase 2: Backend API + Seed Update

**Priority:** P1 | **Status:** pending | **Effort:** 1h

## Context Links

- `backend/src/modules/categories/categories.service.ts` — Service with findAll, getTree, create, update, findOne, remove
- `backend/src/modules/categories/categories.controller.ts` — Controller routes
- `backend/src/modules/categories/dto/category.dto.ts` — Create/Update/Response DTOs
- `backend/prisma/seed.ts` — Category seeding (lines 43-231)
- `backend/src/modules/products/products.service.ts` — References `categoryId`
- `backend/src/modules/recipes/recipes.service.ts` — References `RecipeCategory` join

## Overview

Update the Category backend module to support optional `context` query parameter filtering. Update seed.ts to tag categories with correct context. Update DTOs to include the `context` field.

## Key Insights

- `categories.service.ts:49-67` — `findAll(tenantId)` takes only tenantId, no filters. Must add optional context param.
- `categories.service.ts:191-224` — `getTree(tenantId)` same pattern, no filters.
- `categories.service.ts:23-31` — Slug uniqueness check uses `tenantId_slug` compound — must change to `tenantId_context_slug`.
- `categories.service.ts:131-145` — Update slug conflict check also uses `tenantId_slug`.
- `categories.controller.ts:43-50` — `findAll` reads `req.tenantId` only. Must read `req.query.context`.
- `categories.controller.ts:52-59` — `getTree` same pattern.
- `seed.ts:44-46` — Article categories use `where: { tenantId_slug: { tenantId, slug } }`. Must change to `tenantId_context_slug`.
- `seed.ts:118-126` — Subcategory upserts also use `tenantId_slug`.
- `seed.ts:133-230` — Recipe categories use `prisma.category.create` (not upsert). Should convert to upsert with `context: "recipes"`.
- `backend/src/modules/products/products.service.ts` — Uses `categoryId` directly, no Category query. **No changes needed.**
- `backend/src/modules/recipes/recipes.service.ts` — Uses `RecipeCategory` join table, queries by `categoryId`. **No changes needed.** The recipe-category relationship works by ID reference, not by context filtering.

## Requirements

### Functional

- `GET /v1/categories?context=articles` returns only categories where context=articles
- `GET /v1/categories?context=recipes` returns only categories where context=recipes
- `GET /v1/categories` (no context) returns all categories (backward compatible)
- `GET /v1/categories/tree?context=articles` returns tree filtered by context
- `POST /v1/categories` accepts `context` field in body
- `PATCH /v1/categories/:id` accepts `context` field in body
- Slug uniqueness is scoped to `[tenantId, context, slug]` — same slug allowed in different contexts
- Seed tags all article categories with `context: "articles"` and all recipe categories with `context: "recipes"`

### Non-Functional

- Context param is optional everywhere (backward compatibility)
- No changes to Product or Recipe services — they reference categories by ID, context filtering is the caller's responsibility

## Architecture

### API Contract Changes

```
GET  /v1/categories?context=articles|recipes   (optional query param)
GET  /v1/categories/tree?context=articles|recipes  (optional query param)
POST /v1/categories  body: { ..., context: "articles"|"recipes" }
PATCH /v1/categories/:id  body: { ..., context?: "articles"|"recipes" }
```

### Service Method Signatures

```typescript
findAll(tenantId: string, context?: "articles" | "recipes")
getTree(tenantId: string, context?: "articles" | "recipes")
create(tenantId: string, dto: CreateCategoryDto)  // dto now includes context
update(tenantId: string, id: string, dto: UpdateCategoryDto)  // dto now includes optional context
```

### Slug Uniqueness Change

Before: `where: { tenantId_slug: { tenantId, slug } }`
After:  `where: { tenantId_context_slug: { tenantId, context, slug } }`

The `create` and `update` methods must include `context` in the uniqueness check. For `create`, context comes from the DTO. For `update`, use the existing category's context if not changing it.

## Related Code Files

### Modify
- `backend/src/modules/categories/dto/category.dto.ts` — Add context field to Create, Update, and Response DTOs
- `backend/src/modules/categories/categories.service.ts` — Add context param to findAll, getTree; update uniqueness checks
- `backend/src/modules/categories/categories.controller.ts` — Read query.context, pass to service
- `backend/prisma/seed.ts` — Add context to all category creates/upserts; change compound unique key references

### No Changes Needed
- `backend/src/modules/products/products.service.ts` — References categoryId by ID only
- `backend/src/modules/recipes/recipes.service.ts` — Uses RecipeCategory join by ID only
- `backend/src/modules/categories/categories.module.ts` — No structural changes

## Implementation Steps

### 2.1 Update DTOs (`category.dto.ts`)

1. Add `context` field to `CreateCategoryDto`:
   - `@IsEnum(CategoryContext)` — use Prisma-generated enum or string literal
   - `@IsNotEmpty()` — required on create
   - `@ApiProperty({ enum: ['articles', 'recipes'], description: 'Contexto de la categoría' })`
2. Add optional `context` field to `UpdateCategoryDto`:
   - `@IsEnum(CategoryContext)` + `@IsOptional()`
3. Add `context` field to `CategoryDto` response:
   - `@ApiProperty({ enum: ['articles', 'recipes'] })` — required in response

**Note on enum import:** Import `CategoryContext` from `@prisma/client` generated types. Use string values `"articles" | "recipes"` in class-validator `@IsIn(["articles", "recipes"])` since Prisma enums may not be available at DTO compile time in some NestJS setups. Prefer `@IsIn(["articles", "recipes"])` for simplicity.

### 2.2 Update Service (`categories.service.ts`)

1. `findAll(tenantId, context?)` — Add context filter:
   ```typescript
   const where: any = { tenantId };
   if (context) where.context = context;
   ```
2. `getTree(tenantId, context?)` — Same filter on root categories AND propagate to children:
   ```typescript
   const where: any = { tenantId, parentId: null };
   if (context) where.context = context;
   ```
3. `create(tenantId, dto)` — Update uniqueness check:
   ```typescript
   where: { tenantId_context_slug: { tenantId, context: dto.context, slug: dto.slug } }
   ```
4. `update(tenantId, id, dto)` — Update slug conflict check:
   - Get existing category first (already done at line 122-128)
   - Use `existing.context` (or `dto.context` if changing) in the uniqueness check
   ```typescript
   const targetContext = dto.context || existing.context;
   where: { tenantId_context_slug: { tenantId, context: targetContext, slug: dto.slug } }
   ```

### 2.3 Update Controller (`categories.controller.ts`)

1. `findAll(@Req() req, @Query('context') context?: string)` — Add `@Query` param
2. `getTree(@Req() req, @Query('context') context?: string)` — Add `@Query` param
3. Import `Query` from `@nestjs/common`
4. Validate context value: pass to service only if `"articles"` or `"recipes"`, else ignore (backward compat)

### 2.4 Update Seed (`seed.ts`)

1. Add `context: "articles"` to all article category upserts (lines 44-71):
   - Each `upsert` create data gets `context: "articles"`
   - Change `where` from `tenantId_slug` to `tenantId_context_slug`:
     ```typescript
     where: { tenantId_context_slug: { tenantId: tenant.id, context: "articles", slug: "alimentacion" } }
     ```
2. Add `context: "articles"` to all subcategory upserts (lines 118-126):
   - Same pattern: add `context: "articles"` to create data
   - Change `where` to `tenantId_context_slug`
3. Convert recipe category `create` calls to `upsert` with `context: "recipes"` (lines 133-230):
   - Replace `prisma.category.create` with `prisma.category.upsert`
   - Add `context: "recipes"` to both `where` and `create`
   - `where: { tenantId_context_slug: { tenantId: tenant.id, context: "recipes", slug: "aperitivos" } }`

## Todo List

- [ ] Add `context` field to CreateCategoryDto with `@IsIn(["articles", "recipes"])`
- [ ] Add optional `context` field to UpdateCategoryDto
- [ ] Add `context` field to CategoryDto response
- [ ] Add `context` param to `findAll` service method
- [ ] Add `context` param to `getTree` service method
- [ ] Update `create` uniqueness check to use `tenantId_context_slug`
- [ ] Update `update` slug conflict check to use `tenantId_context_slug`
- [ ] Add `@Query('context')` to controller `findAll` and `getTree`
- [ ] Import `Query` from `@nestjs/common` in controller
- [ ] Update article category upserts in seed with `context: "articles"`
- [ ] Update subcategory upserts in seed with `context: "articles"`
- [ ] Convert recipe category creates to upserts with `context: "recipes"`
- [ ] Verify seed runs idempotently (upsert pattern)

## Success Criteria

- `GET /v1/categories?context=articles` returns only article categories
- `GET /v1/categories?context=recipes` returns only recipe categories
- `GET /v1/categories` returns all categories
- `GET /v1/categories/tree?context=articles` returns filtered tree
- `POST /v1/categories` with `context` in body creates category with correct context
- Same slug allowed in different contexts (e.g., slug "pescado" in both articles and recipes)
- Seed runs without error and is idempotent
- Products and Recipes services continue working unchanged

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Existing prod categories have no context | Migration default = "articles". All manually created categories would be article categories. |
| Slug collision after constraint change | New constraint allows same slug in different contexts. Verified: no existing cross-context slug conflicts. |
| Breaking change to API consumers | Context param is optional; omitting returns all (same as before). |
| Seed not idempotent | Upser pattern with `tenantId_context_slug` ensures repeatable runs. |

## Security Considerations

- Context value validated in controller (only "articles" or "recipes" accepted)
- Context field validated in DTOs with `@IsIn`
- No new authorization requirements — context is a filter, not a permission boundary

## Next Steps

- Phase 3 (frontend) depends on backend API being deployed with context support
