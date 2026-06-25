---
title: "Articulos Modal 5-Tab Restructure"
description: "Restructure flat Crear Articulo modal into a 5-tab interface with new schema fields, models, and backend endpoints"
status: pending
priority: P1
effort: 14h
branch: develop
tags: [frontend, backend, schema-migration, products, modal]
created: 2026-06-09
---

## Overview

Restructure the flat "Crear Articulo" modal (487-line monolith at `frontend/src/app/dashboard/articulos/page.tsx`) into a 5-tab interface. Requires Prisma schema changes (6 new Product fields + 2 new models), backend DTO/service/controller updates, new migration, and frontend component decomposition.

## Phases

| #   | Phase                                  | Status | Effort | Key Files                                                         |
| --- | -------------------------------------- | ------ | ------ | ----------------------------------------------------------------- |
| 01  | Schema migration + Prisma changes      | [ ]    | 2h     | `schema.prisma`, migration                                        |
| 02  | Backend DTO + Service + Controller     | [ ]    | 3h     | `products/dto/*`, `products.service.ts`, `products.controller.ts` |
| 03  | Frontend modal component decomposition | [ ]    | 4h     | New components under `articulos/`                                 |
| 04  | Frontend hooks + API integration       | [ ]    | 2h     | `use-products.ts`, new hooks                                      |
| 05  | Integration testing + validation       | [ ]    | 3h     | Test files, manual E2E                                            |

## Dependencies

```
Phase 01 → Phase 02 → Phase 04
                     ↘
Phase 03 ──────────→ Phase 05
Phase 04 ──────────→ Phase 05
```

Phase 01 and 03 can start in parallel (schema vs UI decomposition).
Phase 02 depends on 01. Phase 04 depends on 02.
Phase 05 requires both 03 and 04.

## Verified Findings (from codebase scout)

- Product model at `schema.prisma:97-138` — confirmed fields match spec
- Stock model at `schema.prisma:922-945` — has unique [productId, warehouseId], so stock is per-warehouse
- Supplier model at `schema.prisma:896-919` — exists but NO dedicated Suppliers module/controller
- Category model at `schema.prisma:1009-1033` — parentId hierarchy confirmed
- No Suppliers module in backend — only `GET /api/v1/products/suppliers` returns supplier IDs (not full objects)
- Multer NOT in backend package.json — must install in Phase 02
- base-ui/react v1.5.0 in frontend — Tabs component ready to use
- ALLERGENS_INFO at `allergens.dto.ts:26-59` — 14 allergens with icon+color, frontend needs local copy
- Current modal at `page.tsx:402-483` — flat form, no tabs, minimal fields

## Risk Assessment

| Risk                                                               | Likelihood | Impact | Mitigation                                                                          |
| ------------------------------------------------------------------ | ---------- | ------ | ----------------------------------------------------------------------------------- |
| Migration breaks existing Product data                             | Low        | High   | All new fields have defaults; PurchaseFormat/NutritionalInfo are separate tables    |
| Frontend 487-line monolith hard to decompose                       | Medium     | Medium | Extract tab components first, then rewire state                                     |
| File upload: multer not installed                                  | High       | High   | `npm install multer @types/multer` in Phase 02 step 1; no FileInterceptor exists    |
| No supplier list endpoint (only IDs from products)                 | High       | Medium | Phase 02 must add `GET /api/v1/suppliers` endpoint querying Supplier table directly |
| Stock model is 1:N per warehouse (unique [productId, warehouseId]) | Medium     | Medium | Tab 4 shows stock per-product aggregate, not per-warehouse; clarify with user       |
| Next.js 16 breaking changes                                        | Medium     | High   | Read `node_modules/next/dist/docs/` per AGENTS.md before writing frontend code      |

## Backwards Compatibility

- All 6 new Product fields have defaults: `iva @default(10)`, `qr String?`, `barcode String?`, `brand String?`, `hideAllergens @default(false)`, `imageUrl String?`
- PurchaseFormat and NutritionalInfo are new tables — zero impact on existing rows
- Existing API responses unchanged; new fields returned but nullable/defaults
- CreateProductDto remains backward-compatible; new fields are `@IsOptional()`

## Rollback Plan

- Phase 01: `npx prisma migrate revert` undoes schema changes
- Phase 02: Revert DTO changes; old clients ignore new fields
- Phase 03-04: Feature-flag the new modal; old flat form stays as fallback until validated
- Phase 05: If integration fails, switch frontend route back to old component

## Success Criteria

- [ ] Migration runs without data loss on existing Products
- [ ] POST /api/v1/products creates product with all new fields + nested PurchaseFormat/NutritionalInfo
- [ ] PATCH /api/v1/products/:id updates product including nested relations
- [ ] GET /api/v1/products/:id returns product with purchaseFormats and nutritionalInfo
- [ ] Image upload returns URL; stored in Product.imageUrl
- [ ] 5-tab modal renders; tab state managed with local useState (no library)
- [ ] Allergen grid shows 14 EU allergens as clickable chips
- [ ] Purchase format table supports dynamic add/delete rows
- [ ] Stock min/max shows red visual when quantity <= minimumStock or >= maximumStock
- [ ] All existing tests pass; new test coverage for DTO validation
