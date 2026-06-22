# Tenant Isolation Security Audit Report

**Date:** 2026-06-03
**Auditor:** code-reviewer
**Scope:** Multi-tenant isolation across all controllers, services, middleware, and guards
**Methodology:** Source code review of every DB query path for missing tenantId filters

---

## Executive Summary

**6 CRITICAL, 4 HIGH, 3 MEDIUM** findings. The application has systemic tenant isolation failures. A user from Tenant A can read, modify, and delete data belonging to Tenant B across most modules. The root causes are:

1. Spoofable tenant ID sources (headers instead of authenticated session)
2. Missing tenantId filters in service-level DB queries
3. No authorization on tenant CRUD endpoints
4. Inconsistent guard application across controllers

---

## Tenant Isolation Matrix

| Module               | Controller Tenant Source                       | Service Tenant Filter                                                                            | Guard Applied                                 | Risk     |
| -------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------- | -------- |
| **Products**         | `req.tenantId` (middleware) + TenantGuard      | YES - all methods filter by tenantId                                                             | AuthGuard + TenantGuard + RolesGuard          | LOW      |
| **Users**            | `req.tenantId` (middleware) + TenantGuard      | YES - all methods filter by tenantId                                                             | AuthGuard + TenantGuard + RolesGuard          | LOW      |
| **Menus**            | `req.tenant?.id \|\| headers['x-tenant-slug']` | PARTIAL - calculateMenuCost skips tenantId                                                       | RolesGuard only (no AuthGuard!)               | CRITICAL |
| **Recipes**          | `req.tenant?.id \|\| headers['x-tenant-slug']` | YES - all methods filter by tenantId                                                             | RolesGuard only (no AuthGuard!)               | CRITICAL |
| **Orders**           | `@Query('tenantId')` or `@Body()`              | PARTIAL - many methods skip tenantId                                                             | JwtAuthGuard + RolesGuard                     | CRITICAL |
| **Production**       | `@Headers('x-tenant-id')`                      | PARTIAL - many methods skip tenantId                                                             | JwtAuthGuard + RolesGuard                     | CRITICAL |
| **APPCC**            | `@Headers('x-tenant-id')`                      | PARTIAL - recordTemperature, addCleaningTask, completeCleaningTask, updateAlert skip tenantId    | JwtAuthGuard + RolesGuard (NOT on all routes) | CRITICAL |
| **Allergens**        | `req.tenant?.id \|\| headers['x-tenant-slug']` | PARTIAL - calculateRecipeAllergens, calculateMenuAllergens skip tenantId                         | JwtAuthGuard + RolesGuard                     | HIGH     |
| **Tenants**          | NONE - no auth at all                          | N/A - no tenant scoping (admin resource)                                                         | NONE                                          | CRITICAL |
| **Technical Sheets** | Not audited (controller not in scope)          | PARTIAL - getTemplate, updateTemplate, deleteTemplate, getDocument, deleteDocument skip tenantId | Unknown                                       | HIGH     |
| **Dashboard**        | `req.user.tenantId`                            | Depends on service implementation                                                                | TenantGuard only                              | MEDIUM   |

---

## CRITICAL Findings

### C1: Spoofable Tenant ID via Request Headers

**Files affected:**

- `menus.controller.ts:39,53,69,90,107,122,138`
- `recipes.controller.ts:39,53,69,90,107,126,142`
- `allergens.controller.ts:29,67,106,120,135,150,165,179,193`
- `production.controller.ts:53,67,93,107,243,267,305,333`
- `appcc.controller.ts:41,55,63,83,115,124,135,145,163,184,198`

**Pattern:** `const tenantId = req.tenant?.id || req.headers['x-tenant-slug']`

**Problem:** When `req.tenant?.id` is undefined (e.g., middleware not applied or auth not enforced), the fallback reads `x-tenant-slug` directly from the HTTP header. An attacker can set any slug to impersonate any tenant. The slug is NOT validated against the authenticated user's tenant.

**Impact:** Full cross-tenant data access. Any authenticated user can access any tenant's data by setting a header.

**Fix:** Never trust headers for tenant identity. Always derive from the authenticated session:

```typescript
const tenantId = req.user?.tenantId;
if (!tenantId) throw new ForbiddenException("Tenant context required");
```

---

### C2: Orders Module - tenantId from Query/Body Parameters (IDOR)

**File:** `orders.controller.ts:41-49,56,61,97,143,157,169`

**Vulnerable endpoints:**

- `GET /requirements?tenantId=ANY_TENANT_ID` - line 41
- `POST /generate` - tenantId from request body (line 56)
- `GET /history?tenantId=ANY_TENANT_ID` - line 97
- `GET /classify/supplier?tenantId=ANY_TENANT_ID` - line 143
- `GET /classify/zone?tenantId=ANY_TENANT_ID` - line 157
- `GET /classify/category?tenantId=ANY_TENANT_ID` - line 169

**Problem:** tenantId comes from `@Query('tenantId')` or `@Body()`. An attacker can pass any tenantId value and access another tenant's order requirements, history, and classifications.

**Additionally**, these endpoints have NO tenantId filter at all:

- `GET :orderId` (line 61) - fetches order by ID without checking tenant ownership
- `PUT :orderId/items/:itemId` (line 66) - modifies order item without tenant check
- `POST :orderId/approve` (line 75) - approves order without tenant check
- `POST :orderId/send` (line 86) - sends order without tenant check
- `GET :orderId/status` (line 113) - reads order status without tenant check
- `GET :orderId/export/:format` (line 127) - exports order without tenant check
- `GET :orderId/export/email` (line 188) - emails order without tenant check
- `GET by-supplier/:supplierId` (line 101) - no tenant filter
- `GET by-zone/:zone` (line 107) - no tenant filter
- `GET suppliers/:supplierId/classification` (line 182) - no tenant filter

**Service confirmation:** `orders.service.ts`

- `getAutomatedOrder` (line 444) - `findUnique({ where: { id: orderId } })` - NO tenantId
- `updateOrderItem` (line 499) - finds item by ID only - NO tenantId
- `approveOrder` (line 543) - finds order by ID only - NO tenantId
- `sendOrder` (line 574) - finds order by ID only - NO tenantId
- `getOrdersBySupplier` (line 619) - filters by supplierId only - NO tenantId
- `getOrdersByZone` (line 634) - filters by zone only - NO tenantId
- `getSupplierClassification` (line 365) - fetches supplier by ID only - NO tenantId

**Impact:** Full IDOR on all order operations. Any user with a valid session can read, modify, approve, and send orders belonging to any tenant.

---

### C3: Production Module - No Tenant Filter on Most Operations

**File:** `production.service.ts`

**Vulnerable service methods (no tenantId in query):**

- `getWorkBatchById` (line 51) - `findUnique({ where: { id: batchId } })` - NO tenantId
- `startWorkBatch` (line 70) - `update({ where: { id: batchId } })` - NO tenantId
- `completeWorkBatch` (line 94) - `update({ where: { id: batchId } })` - NO tenantId
- `createProductionOrder` (line 113) - hardcoded `tenantId: 'default'` - WRONG tenant
- `getProductionOrdersByBatch` (line 146) - filters by batchId only - NO tenantId
- `startProductionOrder` (line 156) - `update({ where: { id: orderId } })` - NO tenantId
- `completeProductionOrder` (line 173) - `update({ where: { id: orderId } })` - NO tenantId
- `createMiseEnPlaceSheet` (line 195) - no tenantId in create data
- `getMiseEnPlaceSheet` (line 214) - `findUnique({ where: { id: sheetId } })` - NO tenantId
- `addMiseEnPlaceItem` (line 230) - no tenantId in create data
- `updateMiseEnPlaceItem` (line 248) - `update({ where: { id: itemId } })` - NO tenantId
- `verifyMiseEnPlaceSheet` (line 270) - `update({ where: { id: sheetId } })` - NO tenantId
- `createTaskAssignment` (line 286) - no tenantId in create data
- `updateTaskAssignment` (line 331) - `update({ where: { id: assignmentId } })` - NO tenantId
- `getStaffMemberTasks` (line 386) - filters by staffId only - NO tenantId
- `getProgressTracking` (line 399) - `findUnique({ where: { orderId } })` - NO tenantId
- `resolveAlert` (line 433) - `update({ where: { id: alertId } })` - NO tenantId
- `reserveIngredient` (line 479) - updates product by ID without tenant check - NO tenantId
- `updateInventory` (line 597) - updates product by ID without tenant check - NO tenantId
- `getStaffMember` (line 641) - `findUnique({ where: { id: staffId } })` - NO tenantId

**Impact:** Any authenticated user can start, complete, or modify any production batch, order, or task across all tenants. The `createProductionOrder` also hardcodes `tenantId: 'default'`.

---

### C4: Tenants Controller - Zero Authentication or Authorization

**File:** `tenants.controller.ts`

**Problem:** No guards at all on any endpoint. The controller has:

- `POST /` - Create tenant (no auth)
- `GET /` - List all tenants (no auth)
- `GET /:id` - Get any tenant by ID (no auth)
- `PATCH /:id` - Update any tenant (no auth)
- `DELETE /:id` - Delete any tenant (no auth)

**Additional problem:** TenantMiddleware excludes `POST /tenants` and `GET /tenants` from tenant resolution, but there is NO separate guard protecting these endpoints.

**Impact:** Any unauthenticated user can list all tenants (exposing slugs, names, IDs), create new tenants, modify existing tenants, or delete them entirely.

---

### C5: Menus Service - calculateMenuCost Skips Tenant Filter

**File:** `menus.service.ts:280-301`

**Problem:** `calculateMenuCost` uses `findUnique({ where: { id } })` without tenantId. The controller at `menus.controller.ts:122-128` extracts `tenantId` but never passes it to the service:

```typescript
// Line 122-123 in controller:
const tenantId = req.tenant?.id || req.headers["x-tenant-slug"];
const costBreakdown = await this.menusService.calculateMenuCost(id); // tenantId not passed!
```

**Impact:** Any user can calculate costs for menus belonging to other tenants, potentially exposing pricing data.

---

### C6: APPCC Service - Multiple Methods Skip Tenant Filter

**File:** `appcc.service.ts`

**Vulnerable methods:**

- `recordTemperature` (line 43) - finds temperature control by ID without tenantId
- `addCleaningTask` (line 115) - finds plan by ID without tenantId, creates task without tenantId
- `completeCleaningTask` (line 131) - updates task by ID without tenantId
- `updateAlert` (line 258) - updates alert by ID without tenantId
- `getTemperatureMeasurements` (line 81) - queries by controlId without tenantId

**Impact:** Cross-tenant manipulation of food safety records (temperature logs, cleaning tasks, alerts). In a regulated food safety context, this could mean tampering with compliance data from another tenant's kitchen.

---

## HIGH Findings

### H1: Inconsistent Auth Guard Architecture

**Files affected:**

- `menus.controller.ts` - uses `RolesGuard` only (from `../auth/roles.guard`)
- `recipes.controller.ts` - uses `RolesGuard` only (from `../../guards/roles.guard`)
- `orders.controller.ts` - uses `JwtAuthGuard` + `RolesGuard`
- `production.controller.ts` - uses `JwtAuthGuard` + `RolesGuard` per-route
- `appcc.controller.ts` - uses `JwtAuthGuard` + `RolesGuard` per-route
- `products.controller.ts` - uses `AuthGuard` + `TenantGuard` + `RolesGuard`
- `users.controller.ts` - uses `AuthGuard` + `TenantGuard` + `RolesGuard`

**Problem:** Menus and Recipes controllers have NO auth guard at all. They only have `RolesGuard`, which checks `req.user.role` -- but `req.user` is never populated because no auth guard runs before it. This means:

1. The `@Roles()` decorator is ineffective
2. `req.tenant?.id` is always undefined
3. The fallback to `headers['x-tenant-slug']` is always triggered
4. Any unauthenticated user can access any data

**Impact:** Complete authentication bypass on Menus and Recipes modules.

### H2: Allergens Service - Cross-Tenant Allergen Calculation

**File:** `allergens.service.ts`

**Vulnerable methods (no tenantId filter):**

- `calculateRecipeAllergens` (line 40) - `findUnique({ where: { id: recipeId } })` - NO tenantId
- `calculateMenuAllergens` (line 92) - `findUnique({ where: { id: menuId } })` - NO tenantId

**Impact:** An attacker can trigger allergen recalculation on recipes/menus from other tenants, which also writes back to those records (lines 82-87, 136-141), causing data modification across tenant boundaries.

### H3: Technical Sheets Service - No Tenant Filter on Individual Record Access

**File:** `technical-sheets.service.ts`

**Vulnerable methods:**

- `getTemplate` (line 48) - `findUnique({ where: { id: templateId } })` - NO tenantId
- `updateTemplate` (line 63) - `update({ where: { id: templateId } })` - NO tenantId
- `deleteTemplate` (line 81) - `delete({ where: { id: templateId } })` - NO tenantId
- `getDocument` (line 206) - `findUnique({ where: { id: documentId } })` - NO tenantId
- `deleteDocument` (line 218) - `delete({ where: { id: documentId } })` - NO tenantId

**Impact:** IDOR on templates and documents across tenants.

### H4: Production Controller - Spoofable x-tenant-id Header

**File:** `production.controller.ts:53,67,93,107,243,267,305,333`

**Pattern:** `@Headers('x-tenant-id') tenantId: string`

**Problem:** The tenantId is read directly from an HTTP header. Unlike the middleware approach (which resolves a slug to a verified tenant ID), this accepts any arbitrary string as a tenantId. No verification that the authenticated user belongs to this tenant.

**Impact:** Same as C1 - cross-tenant data access through header spoofing.

---

## MEDIUM Findings

### M1: TenantMiddleware Uses Slug, Controllers Expect ID

**File:** `tenant.middleware.ts` vs various controllers

The middleware sets `req.tenantId` and `req.tenantSlug` from the slug. But menus/recipes/allergens controllers try to read `req.tenant?.id` which is never set by the middleware. The `tenant?.id` path doesn't exist on the Request object as populated by the middleware.

**Impact:** The "safe" code path (`req.tenant?.id`) always returns undefined, forcing the fallback to the insecure header path.

### M2: AppccController Missing Guard on Class

**File:** `appcc.controller.ts:33`

The controller class has no `@UseGuards()` decorator. Each route applies guards individually, which is error-prone. If a developer adds a new route without the per-route guard, it runs unauthenticated.

### M3: JwtAuthMiddleware Skips Routes It Shouldn't

**File:** `app.module.ts:103-113`

`JwtAuthMiddleware` is only applied to `api/v1/auth/sessions`. This means it does NOT run for orders, production, appcc, allergens, menus, or recipes. Those modules rely entirely on their own guards (which, as noted, are inconsistently applied).

---

## Behavioral Checklist

- [x] Concurrency: no race conditions found in this scope (stateless queries)
- [x] Error boundaries: exceptions are thrown but no tenant context leaks in error messages
- [x] API contracts: controllers and services disagree on tenant parameter expectations
- [x] Backwards compatibility: N/A (security audit)
- [x] Input validation: tenant IDs from headers/query/body are never validated
- [x] Auth/authz paths: MULTIPLE missing auth checks (see C1-C6, H1)
- [x] N+1 / query efficiency: not in scope
- [x] Data leaks: tenant data IS leaking across boundaries (the core finding)
- [x] Fact-checked: all file paths and line numbers verified against source

---

## Recommended Actions (Priority Order)

### Immediate (CRITICAL - Block Release)

1. **Fix tenant ID derivation:** Every controller must extract tenantId from `req.user.tenantId` (set by auth middleware). Remove all fallbacks to headers/query/body. If `req.user.tenantId` is absent, throw 403.

2. **Add AuthGuard + TenantGuard to ALL controllers:** Apply `@UseGuards(AuthGuard, TenantGuard, RolesGuard)` at the class level on menus, recipes, orders, production, appcc, allergens, and tenants controllers.

3. **Add tenantId filter to ALL service Prisma queries:** Every `findUnique`, `findFirst`, `findMany`, `update`, `delete` must include `where: { id, tenantId }` or equivalent compound filter.

4. **Protect tenants controller:** Add authentication and restrict CRUD operations to platform admins only. At minimum, add `@UseGuards(AuthGuard)` and verify the user's role.

5. **Fix orders controller:** Replace `@Query('tenantId')` and body-based tenantId with `req.user.tenantId`. Add tenantId to every service query.

6. **Fix production service:** Add tenantId parameter to all methods and include in all Prisma where clauses. Fix `createProductionOrder` hardcoded `'default'` tenantId.

### Short-Term (HIGH)

7. **Standardize guard architecture:** Apply guards at the class level, not per-route. One pattern for all controllers.

8. **Add cross-tenant access check helper:** Create a reusable function that verifies a record's tenantId matches the authenticated user's tenantId before any read/write operation.

9. **Fix allergens cross-tenant writes:** `calculateRecipeAllergens` and `calculateMenuAllergens` must verify the recipe/menu belongs to the requesting tenant before writing.

### Medium-Term (MEDIUM)

10. **Align middleware and guard interfaces:** Ensure `req.tenantId` is consistently populated and all controllers read from the same source.

11. **Add integration tests for tenant isolation:** For each module, test that Tenant A user cannot access Tenant B data.

---

## Unresolved Questions

1. Should tenants controller be accessible to all authenticated users (read-only) or restricted to platform admins only?
2. Are there additional modules (dashboard, ingesta, sala, almacenes, conocimiento, digital-menu) with the same issues? These were not in scope but likely have identical patterns.
3. The `app.module.ts` registers some controllers at the module level (line 73-85) while others are registered via their own modules. Is this intentional or a leftover from refactoring?
