---
title: "Phase 02: Complete Lucia Auth Migration"
description: "Implement complete Lucia Auth session-based authentication system"
status: completed
priority: P1
effort: 4h
branch: develop
tags: [lucia-auth, authentication, security, sessions]
created: 2026-06-03
---

# Phase 02: Complete Lucia Auth Migration

## Overview

Implement complete Lucia Auth session-based authentication to replace JWT-based system, as specified in project requirements (docs/plan-maestro.md).

## Context

Current state:
- **Lucia v3.2.0** and **@lucia-auth/adapter-prisma v4.0.1** installed
- **SessionService** exists (`src/modules/auth/session.service.ts`)
- **Prisma Session model** exists in schema
- **Tests exist**: `test/lucia-auth/lucia-auth.spec.ts`
- **Missing**: `LuciaAuthService` implementation referenced but not created

## Files to Create

| File | Purpose | Lines | Priority |
|------|---------|-------|----------|
| `backend/src/modules/auth/lucia-auth.service.ts` | Core Lucia instance management | ~150 | P0 |
| `backend/src/types/auth.types.ts` | Auth-related TypeScript types | ~50 | P0 |

## Files to Modify

| File | Action | Lines | Priority |
|------|--------|-------|----------|
| `backend/src/modules/auth/auth.module.ts` | Register LuciaAuthService | ~20 | P0 |
| `backend/src/modules/auth/auth.service.ts` | Verify session integration | ~180 | P1 |
| `backend/src/guards/auth.guard.ts` | Update to use session validation | ~50 | P1 |
| `backend/src/main.ts` | Configure cookie parser | ~10 | P1 |

## Implementation Steps

### Step 1: Create LuciaAuthService

**Action**: Implement core Lucia instance factory

**File to create**: `backend/src/modules/auth/lucia-auth.service.ts`

**Required functionality**:
```typescript
- getLucia(): Returns configured Lucia instance
- Configure PrismaAdapter
- Configure session cookie (HttpOnly, Secure, SameSite)
- Configure session expiration (default 30 days)
- Define getUserAttributes mapping
```

**Checkpoint 2.1**: Create LuciaAuthService
```bash
# Verify file created
ls -la backend/src/modules/auth/lucia-auth.service.ts
```

**Success Criteria**: File exists with all required methods

---

### Step 2: Create Auth Types

**Action**: Define TypeScript types for auth system

**File to create**: `backend/src/types/auth.types.ts`

**Required types**:
```typescript
- AuthenticatedRequest: extends Request with user & session
- SessionData: Interface for session metadata
- LuciaSession: Session interface with user data
```

**Checkpoint 2.2**: Create auth types
```bash
# Verify file created
ls -la backend/src/types/auth.types.ts
```

**Success Criteria**: All types defined and exported

---

### Step 3: Update Auth Module

**Action**: Register LuciaAuthService in AuthModule

**File to modify**: `backend/src/modules/auth/auth.module.ts`

**Changes**:
- Import `LuciaAuthService`
- Add to `providers` array
- Export if needed by other modules

**Checkpoint 2.3**: Verify module compiles
```bash
cd backend && npx tsc --noEmit
```

**Success Criteria**: No TypeScript errors

---

### Step 4: Verify AuthService Integration

**Action**: Ensure AuthService uses SessionService correctly

**File to review**: `backend/src/modules/auth/auth.service.ts`

**Already implemented** (verified):
- Uses `SessionService.createSession()` for login
- Uses `SessionService.validateSession()` for session validation
- Uses `SessionService.invalidateSession()` for logout

**Checkpoint 2.4**: Run type checking
```bash
cd backend && npx tsc --noEmit
```

**Success Criteria**: No errors, AuthService compiles

---

### Step 5: Update Auth Guard

**Action**: Update guards to use session validation

**File to modify**: `backend/src/guards/auth.guard.ts`

**Required changes**:
- Inject `SessionService`
- Validate session ID from cookie
- Attach user to request object

**Checkpoint 2.5**: Verify guard implementation
```bash
cd backend && grep -A 20 "class AuthGuard" src/guards/auth.guard.ts
```

**Success Criteria**: Guard uses session validation

---

### Step 6: Configure Cookie Parser

**Action**: Ensure Express can parse session cookies

**File to modify**: `backend/src/main.ts`

**Required changes**:
- Install `cookie-parser` if not present: `npm install cookie-parser @types/cookie-parser`
- Register middleware before routes

**Checkpoint 2.6**: Verify cookie middleware
```bash
cd backend && grep "cookie-parser" src/main.ts
```

**Success Criteria**: Cookie parser configured

---

### Step 7: Install Missing Dependencies

**Action**: Ensure all required packages are installed

**Checkpoint 2.7**: Verify dependencies
```bash
cd backend && npm list lucia @lucia-auth/adapter-prisma cookie-parser @types/cookie-parser
```

**Success Criteria**: All packages installed

---

### Step 8: Run Lucia Auth Tests

**Checkpoint 2.8**: Execute Lucia-specific tests
```bash
cd backend && npm test -- lucia-auth.spec.ts
```

**Success Criteria**: All Lucia tests pass

---

### Step 9: Integration Test - Full Auth Flow

**Checkpoint 2.9**: Manual auth flow test
```bash
# Using curl or Postman, test:
# 1. Register user
# 2. Login (should return session cookie)
# 3. Access protected route with session cookie
# 4. Logout (should invalidate session)
```

**Success Criteria**: Full auth flow works

---

### Step 10: Security Verification

**Checkpoint 2.10**: Verify cookie security attributes
```bash
cd backend && grep -A 5 "secure\|httpOnly\|sameSite" src/modules/auth/lucia-auth.service.ts
```

**Success Criteria**:
- HttpOnly: true
- Secure: true (in production)
- SameSite: 'lax' or 'strict'

---

## Rollback Strategy

If Lucia implementation causes issues:
1. **Quick rollback**: Comment out LuciaAuthService, revert to JWT
2. **Database**: Sessions table can be safely ignored (no data loss)
3. **Code**: Keep Lucia code, disable via feature flag

Rollback commands:
```bash
git checkout develop
npm test  # Verify old state
```

## Success Criteria

- [x] LuciaAuthService created and registered
- [x] All TypeScript types defined
- [x] Auth module compiles without errors
- [x] All Lucia tests pass
- [x] Session cookies secure (HttpOnly: true, Secure in prod, SameSite: lax)
- [x] Auth guards validate sessions correctly
- [x] Full auth flow working (register -> login -> access -> logout)
- [x] No JWT references in production code

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Lucia API changes break existing code | High | Low | Use stable v3.2.0, lock version |
| Session DB migration fails | Medium | Low | Sessions table already exists |
| Cookie configuration issues | Medium | Medium | Test in dev environment first |
| Breaking existing auth endpoints | High | Medium | Keep JWT as fallback during migration |

## Dependencies

- **Phase 01**: Tests must be passing to verify Lucia implementation
- **Database**: PostgreSQL with sessions table
- **Environment**: `.env` with DATABASE_URL configured

## Lucia Configuration Reference

Based on project requirements (docs/plan-maestro.md):

```typescript
- Session storage: Prisma adapter
- Session duration: 30 days (configurable)
- Cookie: HttpOnly, Secure, SameSite
- Multi-session: Yes (tracked in DB)
- Session refresh: Automatic via SessionService
```

## Next Steps

After completing this phase:
- [ ] Update plan.md status to "completed"
- [ ] Update project-changelog.md with Lucia Auth completion
- [ ] Run full test suite to verify no regressions
- [ ] Document auth flow in api-documentation.md

## Open Questions

1. Should JWT be completely removed or kept as fallback?
2. What session timeout should be default?
3. Should we implement session rotation on refresh?

## Checkpoints Summary

| ID | Command | Expected Result |
|----|---------|-----------------|
| 2.1 | `ls -la .../lucia-auth.service.ts` | File exists |
| 2.2 | `ls -la .../auth.types.ts` | File exists |
| 2.3 | `npx tsc --noEmit` | No TS errors |
| 2.4 | `npx tsc --noEmit` | AuthService compiles |
| 2.5 | `grep -A 20 AuthGuard` | Uses sessions |
| 2.6 | `grep "cookie-parser"` | Middleware configured |
| 2.7 | `npm list lucia ...` | All deps installed |
| 2.8 | `npm test -- lucia-auth.spec.ts` | All pass |
| 2.9 | Manual flow test | Works end-to-end |
| 2.10 | `grep secure/httpOnly` | Security verified |