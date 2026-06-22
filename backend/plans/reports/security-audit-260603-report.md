# Security Audit Report - ChefChek Backend

**Date:** 2026-06-03
**Scope:** Full backend security audit
**Stack:** NestJS 10, Prisma 5, PostgreSQL, Lucia Auth, JWT
**Auditor:** code-reviewer agent

---

## Executive Summary

The ChefChek backend has **6 CRITICAL**, **8 HIGH**, **6 MEDIUM**, and **4 LOW** findings. The most severe issues are: hardcoded JWT secret fallback, unauthenticated tenant CRUD endpoints, inconsistent multi-tenant isolation across controllers, tenant ID taken from client-controlled headers, missing rate limiting, and no global input validation pipeline. The orders and production modules have critical tenant isolation gaps that allow cross-tenant data access.

---

## CRITICAL Findings

### C1: Hardcoded JWT Secret Fallback

**File:** `src/app.module.ts:50`
**Code:** `secret: process.env.JWT_SECRET || 'your-jwt-secret-key-change-in-production'`

If `JWT_SECRET` env var is missing, the application silently falls back to a predictable, publicly visible default secret. Any attacker can forge valid JWTs and impersonate any user.

**Remediation:**

- Remove the fallback. Fail fast at startup if `JWT_SECRET` is not set.
- Validate secret length (minimum 32 bytes of entropy).
- Use `ConfigService` with validation schema instead of raw `process.env`.

---

### C2: Tenants Controller - Fully Unauthenticated CRUD

**File:** `src/modules/tenants/tenants.controller.ts:16-71`
**File:** `src/app.module.ts:89-93` (TenantMiddleware excludes `POST` and `GET` tenants)

The `TenantsController` has no `@UseGuards()` at the class or method level. The `TenantMiddleware` explicitly excludes tenant creation and listing. This means:

- `POST /api/v1/tenants` - Anyone can create tenants (including setting `adminRole`)
- `GET /api/v1/tenants` - Anyone can list all tenants
- `GET /api/v1/tenants/:id` - Anyone can read any tenant's details
- `PATCH /api/v1/tenants/:id` - Anyone can modify any tenant (change `isActive`, `slug`, etc.)
- `DELETE /api/v1/tenants/:id` - Anyone can delete any tenant

This is an existential risk for a multi-tenant SaaS platform.

**Remediation:**

- Add `@UseGuards(AuthGuard, RolesGuard)` at class level
- Restrict `POST` to authenticated users with `@Roles('ADMIN')`
- Restrict `PATCH/DELETE` to super-admin or the tenant's own admin
- Remove tenant listing from public access or restrict to super-admin

---

### C3: Production Controller - Tenant ID from Client Header (Spoofable)

**File:** `src/modules/production/production.controller.ts:53-54,67-69`

```typescript
@Headers('x-tenant-id') tenantId: string,
```

The production controller reads `tenantId` directly from the `X-Tenant-Id` request header, which is fully client-controlled. The `TenantMiddleware` uses `X-Tenant-Slug` (not `X-Tenant-Id`) and sets `req.tenantId` after DB lookup. The production controller bypasses this entirely, allowing an attacker to specify any tenant ID and access/modify other tenants' production data.

This affects ALL production endpoints: batches, orders, mise-en-place, assignments, alerts, reports.

**Remediation:**

- Replace all `@Headers('x-tenant-id')` with `@Req() req` then `req.tenantId`
- Remove `X-Tenant-Id` and `X-Tenant-User-Id` header expectations
- Use the authenticated `req.user` for userId instead of `X-User-Id` header

---

### C4: Orders Controller - No Tenant Isolation

**File:** `src/modules/orders/orders.controller.ts:27-28`

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
```

The orders controller uses `JwtAuthGuard` (from `modules/auth/`) instead of `AuthGuard` (from `guards/`), and has NO `TenantGuard`. It also uses different guard imports from the rest of the codebase. Consequences:

- No `TenantGuard` means `req.tenantId` is never checked
- Many endpoints accept `tenantId` as a query parameter (`@Query('tenantId')`), which is client-controlled
- `getOrder()`, `updateOrderItem()`, `approveOrder()`, `sendOrder()` take only `orderId`/`itemId` with no tenant scoping in service
- `getOrdersBySupplier()` and `getOrdersByZone()` have no tenant filter at all

An authenticated user from any tenant can read/modify orders from any other tenant.

**Remediation:**

- Replace `JwtAuthGuard` with `AuthGuard` and add `TenantGuard`
- Derive `tenantId` from `req.tenantId` only, never from query params or headers
- Add tenant scoping to all service queries (`where: { tenantId }`)

---

### C5: Menus Controller - Missing Auth and Tenant Guards

**File:** `src/modules/menus/menus.controller.ts:28-29`

```typescript
@UseGuards(RolesGuard)
```

The menus controller only has `RolesGuard` (which returns `true` if no roles are set on the handler). It is missing both `AuthGuard` and `TenantGuard`. This means:

- All menu endpoints are accessible without authentication
- `RolesGuard` without prior `AuthGuard` means `request.user` is undefined, so the guard's `!user` check would throw, but the middleware flow is inconsistent
- Tenant ID is derived from `req.tenant?.id || req.headers['x-tenant-slug']` (line 39) - the fallback to raw header is client-controlled and could be a slug for any tenant

**Remediation:**

- Add `@UseGuards(AuthGuard, TenantGuard, RolesGuard)` at class level
- Use `req.tenantId` exclusively (set by TenantMiddleware after DB lookup)

---

### C6: Session Invalidations Not Tenant-Scoped

**File:** `src/modules/auth/session.service.ts:61-64`

```typescript
async invalidateAllUserSessions(userId: string) {
  await this.prisma.session.deleteMany({
    where: { userId },
  });
```

`invalidateAllUserSessions` ignores the `tenantId` parameter entirely. The `Session` model in Prisma has no `tenantId` column, so sessions are global. If a user exists in multiple tenants (not possible now due to unique constraint, but architecturally fragile), this would nuke all sessions across tenants.

More critically, the `DELETE /api/v1/auth/sessions/:sessionId` endpoint (auth.controller.ts:125-127) allows any authenticated user to invalidate ANY session by ID, with no ownership check. An attacker can log out other users by guessing session IDs.

**Remediation:**

- Add ownership check: verify `session.userId === req.user.id` before invalidating
- Add `tenantId` to Session model for proper multi-tenant isolation
- Scope `invalidateAllUserSessions` to verify the user belongs to the requesting tenant

---

## HIGH Findings

### H1: No Global ValidationPipe - DTOs Not Enforced

**File:** `src/main.ts`

NestJS `ValidationPipe` is never enabled globally. While DTOs use `class-validator` decorators, they are only enforced if `ValidationPipe` is active. Without it, all DTO validation is silently skipped, allowing arbitrary data through.

**Remediation:**

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

---

### H2: No Rate Limiting on Auth Endpoints

**File:** `src/modules/auth/auth.controller.ts:19-35`

Login, registration, and session refresh have no rate limiting. An attacker can brute-force passwords or session tokens without throttling.

**Remediation:**

- Add `@nestjs/throttler` or express-rate-limit
- Apply stricter limits on `POST /auth/login` (e.g., 5 attempts per minute per IP)
- Add account lockout after N failed attempts

---

### H3: Missing Security Headers (No Helmet)

**File:** `src/main.ts`

No security headers middleware (Helmet) is configured. Missing headers include:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-XSS-Protection`

**Remediation:**

```typescript
import helmet from "helmet";
app.use(helmet());
```

---

### H4: Swagger UI Exposed in Production

**File:** `src/main.ts:56-62`

Swagger UI is unconditionally mounted at `/api/docs` with no environment check. This exposes the full API schema, authentication scheme details, and all endpoint descriptions to anyone in production.

**Remediation:**

- Conditionally enable Swagger only in non-production environments
- Or protect the docs route with authentication

---

### H5: N+1 Query in Allergen Recalculation

**File:** `src/modules/allergens/allergens.service.ts:325-365`

`recalculateAllAllergensForTenant` iterates over all products, recipes, and menus making individual DB queries in loops. This is an N+1 problem that can be exploited for DoS on tenants with large datasets.

**Remediation:**

- Batch allergen updates using `updateMany` with computed data
- Add pagination or chunking for large tenants
- Consider running as a background job

---

### H6: Recursive Allergen Calculation - No Depth Limit

**File:** `src/modules/allergens/allergens.service.ts:72-77`

`calculateRecipeAllergens` recursively calls itself for sub-recipes with no depth limit. If a circular reference exists in sub-recipes (no DB-level prevention visible), this causes infinite recursion and stack overflow.

**Remediation:**

- Add depth limit parameter (max 5 levels)
- Track visited recipe IDs to detect cycles
- Add a DB constraint or application-level check to prevent circular sub-recipe references

---

### H7: User ID from Client Header (Spoofable)

**File:** `src/modules/production/production.controller.ts:54,93,108,219`

Multiple production endpoints read `userId` from `X-User-Id` header:

```typescript
@Headers('x-user-id') userId: string,
```

This allows any authenticated user to impersonate another user for actions like creating batches, starting work, verifying mise-en-place sheets. The `userId` should come from the authenticated `req.user.id`.

**Remediation:**

- Replace all `@Headers('x-user-id')` with `req.user.id`
- Never trust client-supplied identity claims

---

### H8: Inconsistent Guard Architecture (Two Auth Systems)

**File:** `src/guards/auth.guard.ts` vs `src/modules/auth/jwt-auth.guard.ts`

There are two separate auth guard hierarchies:

1. `src/guards/AuthGuard` + `TenantGuard` + `RolesGuard` (used by products, users, allergens)
2. `src/modules/auth/JwtAuthGuard` + `RolesGuard` (used by orders, production)

The first uses session-based auth (Lucia), the second uses JWT-based auth. The JWT middleware (`JwtAuthMiddleware`) does its own token verification separately from the session system. This creates confusion about which auth path is active and leads to some endpoints being protected by one but not the other.

**Remediation:**

- Consolidate to a single auth guard chain
- If both JWT and session auth are needed, create a unified guard that checks both
- Standardize all controllers to use the same guard imports

---

## MEDIUM Findings

### M1: CORS Allows Localhost Only - Insufficient for Production

**File:** `src/main.ts:9-12`

```typescript
origin: ['http://localhost:3000', 'http://localhost:3001'],
```

Hardcoded localhost origins will block legitimate frontend access in production. Developers may respond by changing to `origin: '*'`, which is worse.

**Remediation:**

- Load allowed origins from `ConfigService` / environment variable
- Use a comma-separated list in `.env`: `CORS_ORIGINS=https://app.chefchek.com,https://admin.chefchek.com`

---

### M2: Weak bcrypt Work Factor

**File:** `src/modules/auth/auth.service.ts:103` and `src/modules/users/users.service.ts:46`

```typescript
await bcrypt.hash(password, 10);
```

Work factor of 10 is below the current OWASP recommendation of 12. For a system handling food safety compliance data, this is insufficient.

**Remediation:**

- Increase to at least 12, preferably 13
- Consider argon2id as a modern alternative

---

### M3: No Password Complexity Requirements

**File:** `src/modules/tenants/dto/create-tenant.dto.ts:21-22`

```typescript
@MinLength(8)
adminPassword: string;
```

Only minimum length of 8 is enforced. No complexity requirements (uppercase, numbers, special chars). The `LoginDto` has no password validation at all.

**Remediation:**

- Add password complexity validation (regex pattern or custom validator)
- Enforce in `CreateUserDto` and `UpdateUserDto` as well
- Consider `class-validator` `@Matches()` decorator

---

### M4: Information Leak in Error Messages

**File:** `src/modules/recipes/recipes.service.ts:147`

```typescript
throw new NotFoundException(`Recipe with ID ${id} not found`);
```

Multiple services include the requested ID in error messages. While not as severe as stack trace leaks, this confirms resource existence/non-existence to attackers enumerating IDs.

**Remediation:**

- Use generic not-found messages: "Resource not found"
- Log the specific ID server-side only

---

### M5: Health Endpoint Bypasses Global Prefix

**File:** `src/main.ts:18-20`

```typescript
app.use("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});
```

The health endpoint is registered before `setGlobalPrefix('api')` and exposes server timestamps. It also doesn't go through any middleware chain.

**Remediation:**

- Move to `/api/health` for consistency
- Remove timestamp from response (information leak about server time)

---

### M6: `sortBy` Parameter in ProductsQueryDto Allows Arbitrary Column Names

**File:** `src/modules/products/dto/create-product.dto.ts:169-170`

```typescript
@IsOptional()
@IsString()
sortBy?: string;
```

This string is passed directly to Prisma `orderBy: { [sortBy]: sortOrder }` (products.service.ts:102). While Prisma parameterizes queries (no SQL injection), an attacker can sort by any column including sensitive ones like `netPrice` or internal fields, potentially inferring data through sort-order side channels.

**Remediation:**

- Whitelist allowed sort columns: `@IsIn(['name', 'createdAt', 'purchasePrice'])`
- Validate against an explicit allowlist in the service

---

## LOW Findings

### L1: Duplicate Auth Guard Files

**Files:**

- `src/guards/auth.guard.ts` + `src/guards/jwt-auth.guard.ts` + `src/guards/roles.guard.ts`
- `src/modules/auth/jwt-auth.guard.ts` + `src/modules/auth/roles.guard.ts` + `src/modules/auth/roles.decorator.ts`

Two sets of auth guards exist in different directories. This causes import confusion (orders uses `modules/auth/` guards, products uses `guards/` guards).

**Remediation:** Consolidate to one location.

---

### L2: `PublicGuard` Always Returns True

**File:** `src/guards/public-guard.ts:9-14`

This guard does nothing (always returns `true`). It's a no-op that could mislead developers into thinking an endpoint has some form of public access control.

**Remediation:** Remove or implement properly using a decorator-based pattern (`@Public()`).

---

### L3: Session Model Missing tenantId

**File:** `prisma/schema.prisma:82-93`

The `Session` model has no `tenantId` column. For a multi-tenant system, this makes it impossible to scope session management to a tenant, complicates audit trails, and prevents tenant-scoped session invalidation.

**Remediation:** Add `tenantId String` to Session model with proper indexing.

---

### L4: Telegram Bot Token Stored in Plain Text

**File:** `prisma/schema.prisma:1269`

```prisma
model TelegramBot {
  botToken String @unique
}
```

Bot tokens are stored unencrypted in the database. If the DB is compromised, all bot tokens are immediately usable.

**Remediation:** Encrypt at rest using application-level encryption or use a secrets manager.

---

## Dependency Audit

`npm audit` could not be executed due to environment restrictions. Manual review of `package.json` reveals:

| Dependency        | Version   | Risk                                                                               |
| ----------------- | --------- | ---------------------------------------------------------------------------------- |
| `typeorm`         | `^1.0.0`  | TypeORM v1 is EOL. v0.x is the legacy version. May have unpatched vulnerabilities. |
| `@nestjs/typeorm` | `^11.0.1` | Conflicts with TypeORM v1 - likely not working correctly                           |
| `prisma`          | `^5.20.0` | Acceptable, but check for latest patches                                           |
| `bcrypt`          | `^6.0.0`  | Acceptable                                                                         |
| `lucia`           | `^3.2.0`  | Lucia was deprecated in 2024; consider migration path                              |
| `telegraf`        | `^4.16.3` | Ensure no known CVEs                                                               |
| `tesseract.js`    | `^7.0.0`  | OCR library - verify no prototype pollution issues                                 |

**Action:** Run `npm audit` manually and update dependencies. The TypeORM v1 inclusion is particularly concerning as it's EOL and appears unused alongside Prisma.

---

## Multi-Tenant Isolation Summary

| Module           | Tenant Guard                | tenantId Source                  | Isolated? |
| ---------------- | --------------------------- | -------------------------------- | --------- |
| Products         | Yes                         | `req.tenantId` (middleware)      | YES       |
| Users            | Yes                         | `req.tenantId` (middleware)      | YES       |
| Recipes          | Yes (via controller guards) | `req.tenantId`                   | YES       |
| Allergens        | Yes (via controller guards) | `req.tenantId`                   | YES       |
| Menus            | NO                          | `req.headers['x-tenant-slug']`   | **NO**    |
| Orders           | NO                          | `@Query('tenantId')`             | **NO**    |
| Production       | NO                          | `@Headers('x-tenant-id')`        | **NO**    |
| Tenants          | NO                          | N/A (CRUD on tenants themselves) | **NO**    |
| APPCC            | Partial                     | Service-level tenantId           | Partial   |
| Technical Sheets | Needs verification          | Needs verification               | Unknown   |

---

## Recommendations (Prioritized)

1. **[CRITICAL]** Remove JWT secret fallback, fail fast on missing env var
2. **[CRITICAL]** Add authentication + authorization to Tenants controller
3. **[CRITICAL]** Fix production controller to use `req.tenantId` and `req.user.id`
4. **[CRITICAL]** Fix orders controller - add TenantGuard, derive tenantId from request context
5. **[CRITICAL]** Fix menus controller - add AuthGuard + TenantGuard
6. **[CRITICAL]** Add session ownership check before invalidation
7. **[HIGH]** Enable global `ValidationPipe` with `whitelist: true`
8. **[HIGH]** Add rate limiting on auth endpoints
9. **[HIGH]** Add Helmet middleware for security headers
10. **[HIGH]** Disable Swagger in production
11. **[HIGH]** Add depth limit to recursive allergen calculation
12. **[HIGH]** Consolidate auth guard architecture (two systems causing confusion)
13. **[MEDIUM]** Configure CORS from environment variables
14. **[MEDIUM]** Increase bcrypt work factor to 12+
15. **[MEDIUM]** Add password complexity requirements
16. **[MEDIUM]** Whitelist sortable columns in query DTOs

---

## Unresolved Questions

1. Are the `digital-menu`, `dashboard`, `ingesta`, `sala`, `almacenes`, `conocimiento` controllers also affected by missing guards/tenant isolation? They were not in scope but likely have the same issues.
2. Is the `JwtAuthMiddleware` intended to run alongside the session-based `AuthGuard`, or is it a migration artifact? The dual system creates confusion.
3. TypeORM v1 is listed as a dependency alongside Prisma. Is it actually used, or is it a leftover from a migration?
4. Lucia auth was deprecated by its author in 2024. What is the migration plan?
5. Does the APPCC controller properly enforce tenant isolation? The service receives `tenantId` but the controller guards were not verified.
6. Is `npm audit` clean? Could not be executed in this environment.
