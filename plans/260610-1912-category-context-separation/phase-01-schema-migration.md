# Phase 1: Schema + Migration

**Priority:** P1 | **Status:** pending | **Effort:** 30m

## Context Links

- `backend/prisma/schema.prisma` line 1058-1082: Category model
- `backend/prisma/schema.prisma` line 285: `enum UserRole` (pattern reference for new enum)
- `backend/prisma/seed.ts` lines 43-231: Category seeding

## Overview

Add `CategoryContext` enum and `context` field to the Category model. Update the unique constraint from `@@unique([tenantId, slug])` to `@@unique([tenantId, context, slug])`. Create a migration that sets default values for existing rows.

## Key Insights

- Only 1 existing enum in schema: `UserRole` at line 285. Follow same pattern for `CategoryContext`.
- Current unique constraint: `@@unique([tenantId, slug])` at schema line 1078. Used as `tenantId_slug` compound index in seed.ts upserts.
- Seed uses `tenantId_slug` for upsert — must change to `tenantId_context_slug` after migration.
- Existing categories in seed: 7 parent (articles) + 30 subcategories (articles) + 8 recipe categories.
- Article categories have `parentId` hierarchy; recipe categories are flat (no parentId).

## Requirements

### Functional

- `CategoryContext` enum with values `articles` and `recipes`
- `context` field on Category model, type `CategoryContext`, not optional (every category must have a context)
- Default value `articles` (backward compatible — existing rows are article categories)
- Updated unique constraint `@@unique([tenantId, context, slug])`

### Non-Functional

- Migration must be idempotent-safe (runs on existing data without error)
- Default value ensures no data loss for existing rows
- Index on `context` for query performance

## Architecture

### Schema Changes

```prisma
enum CategoryContext {
  articles
  recipes
}

model Category {
  // ... existing fields ...
  context CategoryContext @default(articles)

  // ... existing relations ...

  @@unique([tenantId, context, slug])  // was: @@unique([tenantId, slug])
  @@index([tenantId, context])         // new: supports filtered queries
}
```

### Migration Strategy

1. Add `CategoryContext` enum
2. Add `context` column with default `"articles"` (all existing rows get "articles")
3. Update recipe categories in seed to `"recipes"` (handled in Phase 2, but migration must support it)
4. Drop old `@@unique([tenantId, slug])` constraint
5. Create new `@@unique([tenantId, context, slug])` constraint
6. Add `@@index([tenantId, context])`

**Important:** The migration SQL must:
- Create the enum
- Add column with default
- Before dropping old unique, verify no slug conflicts across contexts (there are none currently — verified in seed.ts: recipe slugs like "aperitivos", "arroces" don't overlap with article slugs)

## Related Code Files

### Modify
- `backend/prisma/schema.prisma` — Add enum, add field, update constraint

### Create
- `backend/prisma/migrations/<timestamp>_add_category_context/migration.sql` — Via `npx prisma migrate dev`

## Implementation Steps

1. Add `CategoryContext` enum after `UserRole` enum (around line 289) in schema.prisma
2. Add `context CategoryContext @default(articles)` field to Category model (after `color` field, before `sortOrder`)
3. Change `@@unique([tenantId, slug])` to `@@unique([tenantId, context, slug])` on Category model
4. Add `@@index([tenantId, context])` on Category model
5. Run `npx prisma migrate dev --name add_category_context` from `backend/` directory
6. Verify migration SQL: should add enum, add column with default, swap constraints
7. Verify `npx prisma generate` succeeds

## Todo List

- [ ] Add `CategoryContext` enum to schema.prisma
- [ ] Add `context` field to Category model with default
- [ ] Update unique constraint to include context
- [ ] Add index on `[tenantId, context]`
- [ ] Run `prisma migrate dev --name add_category_context`
- [ ] Verify migration applies cleanly
- [ ] Verify `prisma generate` succeeds

## Success Criteria

- `CategoryContext` enum exists with values `articles`, `recipes`
- Category model has `context` field with default `articles`
- Unique constraint is `[tenantId, context, slug]`
- Index exists on `[tenantId, context]`
- Migration applies without error
- `prisma generate` produces updated client with `CategoryContext` enum

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Existing slug conflicts prevent new unique constraint | Verified: no overlapping slugs between article and recipe categories in seed. Migration default = "articles", recipe cats changed in Phase 2. |
| Migration fails on production data | Default value handles existing rows. If prod has custom categories, they default to "articles" which is correct for any manually created ones. |
| Prisma client types not regenerated | CI/CD will regenerate; developer must run `npx prisma generate` |

## Next Steps

- Phase 2 depends on this phase completing (needs generated Prisma client with `CategoryContext`)
