---
title: "Critical Blockers Resolution - Testing & Lucia Auth"
description: "Fix Jest configuration issues and complete Lucia Auth migration for ChefChek backend"
status: pending
priority: P1
effort: 6h
branch: develop
tags: [testing, lucia-auth, critical-blockers, ci-cd]
created: 2026-06-03
---

# Critical Blockers Resolution Plan

## Overview

Resolving two critical blockers preventing ChefChek backend from being production-ready:
1. **Testing Infrastructure**: Jest configuration issues causing test failures
2. **Lucia Auth Migration**: Complete session-based auth system implementation

## Phase Summary

| Phase | Title | Status | Effort | Dependencies |
|-------|-------|--------|--------|--------------|
| [Phase 01](./phase-01-fix-jest-testing.md) | Fix Jest Testing Infrastructure | pending | 2h | - |
| [Phase 02](./phase-02-complete-lucia-auth.md) | Complete Lucia Auth Migration | pending | 4h | Phase 01 |

## Current State

### Testing (Phase 01 - Critical)
- **Issue**: Jest config converted to CommonJS, but tests still failing
- **Test Status**: 5 passed, 1 failed (NotificationsService - 4 assertions failing)
- **Coverage**: Not measurable due to test failures
- **Root Cause**: Mock expectations don't match actual Prisma query execution

### Lucia Auth (Phase 02 - High Priority)
- **Status**: Partially implemented (session service exists, tests written)
- **Package Status**: Lucia v3.2.0 installed, @lucia-auth/adapter-prisma v4.0.1 installed
- **Missing**: LuciaAuthService implementation, auth module refactoring

## Success Criteria

### Overall
- [ ] All tests pass (100% success rate)
- [ ] Coverage threshold met (70% global)
- [ ] Lucia Auth fully functional with sessions in DB
- [ ] E2E auth flow working end-to-end

### Phase 01
- [ ] `npm test` passes with 0 failures
- [ ] `npm run test:cov` meets 70% coverage
- [ ] Test execution time < 15s
- [ ] NotificationsService tests pass

### Phase 02
- [ ] LuciaAuthService fully implemented
- [ ] All auth endpoints use sessions (no JWT)
- [ ] Guards validate sessions correctly
- [ ] Session cookies secure (HttpOnly, Secure in prod)
- [ ] Multi-session support working

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Breaking existing auth during migration | High | Medium | Keep old code commented, rollback branch |
| Test mock mismatch persists | Medium | Low | Verify with actual Prisma queries |
| Lucia package version conflicts | Medium | Low | Test in isolated environment first |
| Coverage regression | Low | Low | Baseline current coverage first |

## Rollback Strategy

### Phase 01 Rollback
- Keep backup of current `jest.config.js`
- If tests break further, revert to previous commit: `3f6df17`

### Phase 02 Rollback
- Create feature branch before Lucia changes
- Keep JWT code as fallback
- Database migration revertable

## Dependencies

- **Internal**: Phase 02 depends on Phase 01 (tests needed to validate Lucia)
- **External**: None
- **Database**: PostgreSQL test DB must be accessible

## Related Files

### Phase 01
- `backend/jest.config.js`
- `backend/src/modules/core/notifications.service.spec.ts`
- `backend/test/setup.ts`

### Phase 02
- `backend/src/modules/auth/lucia-auth.service.ts`
- `backend/src/modules/auth/session.service.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/guards/auth.guard.ts`
- `backend/test/lucia-auth/lucia-auth.spec.ts`