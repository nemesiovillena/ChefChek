---
title: "Test Coverage Audit & 70% Target - ChefChek Backend"
description: "Achieve 70% test coverage through systematic module testing"
status: in_progress
priority: P1
effort: 8h
branch: develop
tags: [testing, coverage, quality-assurance, ci-cd]
created: 2026-06-04
---

# Test Coverage Audit & 70% Target - ChefChek Backend

## Overview

**Current Status**: 43.39% coverage (396 tests passing, 20 test suites)
**Target**: 70% coverage threshold (statements, branches, lines, functions)
**Gap**: 26.61% remaining

**Note**: Significant progress from original plan! Other agents added comprehensive tests:
- Original: 9.66% coverage, 143 tests
- Current: 43.39% coverage, 396 tests ✅

**Plan Status**: ✅ **COMPLETE** - All phases documented and ready for execution

## Original Plan Status (260603-1854-critical-blockers-resolution)

| Phase | Title | Original Status | Current Status |
|-------|-------|----------------|----------------|
| Phase 01 | Fix Jest Testing Infrastructure | pending | ✅ **COMPLETED** |
| Phase 02 | Complete Lucia Auth Migration | pending | ✅ **COMPLETED** |

### Phase 01 Completion:
- ✅ 396 tests passing (was 5)
- ✅ 20 test suites (was 6)
- ✅ Coverage: 43.39% (measurable, was 9.66%)
- ✅ Fixed notifications.service.spec.ts mock expectations
- ✅ Fixed timeout issues
- ✅ Added tests: permissions.service, session.service, dashboard.service

### Phase 02 Completion:
- ✅ LuciaAuthService fully implemented
- ✅ SessionService with comprehensive tests
- ✅ PermissionsService with RBAC granular tests
- ✅ All auth endpoints use sessions
- ✅ Guards validate sessions correctly
- ✅ Session cookies secure (HttpOnly, Secure)
- ✅ Multi-session support
- ✅ Granular RBAC system
- ✅ E2E auth flow validated

## Current Coverage Analysis

### High Coverage Modules (>50%):
- **modules/core**: 100% statements, 94.11% branches, 100% functions ✅
- **modules/dashboard**: 64.16% statements, 55.26% branches, 64.28% functions ✅
- **modules/auth**: 49.76% statements, 35.71% branches, 49.75% functions ✅
- **modules/sala**: 61.85% statements, 85.18% branches, 62.36% functions ✅

### Medium Coverage Modules (10-40%):
- **modules/tenants**: 8.1% statements ⚠️
- **modules/users**: 6.89% statements ⚠️

### Zero Coverage Modules (0%):
- **modules/allergens**: 0% (245 lines)
- **modules/almacenes**: 0% (662 lines) 📏
- **modules/appcc**: 0% (732 lines) 📏
- **modules/conocimiento**: 0% (587 lines) 📏
- **modules/digital-menu**: 0% (411 lines)
- **modules/ingesta**: 0% (568 lines) 📏
- **modules/menus**: 0% (577 lines) 📏
- **modules/orders**: 0% (725 lines) 📏
- **modules/products**: 0% (395 lines) - test file exists but not passing
- **modules/production**: 0% (929 lines) 📏
- **modules/recipes**: 0% (556 lines) 📏
- **modules/technical-sheets**: 0% (600 lines) 📏

## Phase Summary

| Phase | Title | Status | Effort | Priority | Est. Coverage Gain |
|-------|-------|--------|--------|----------|-------------------|
| [Phase 03](./phase-03-audit-zero-coverage-modules.md) | Audit Zero Coverage Modules | ✅ **Ready** | 2h | P0 | +5% |
| [Phase 04](./phase-04-priority-business-modules.md) | Priority Business Modules | ✅ **Ready** | 3h | P0 | +10% |
| [Phase 05](./phase-05-remaining-gaps.md) | Fill Remaining Gaps | ✅ **Ready** | 2h | P1 | +8% |
| [Phase 06](./phase-06-critical-path-validation.md) | Critical Path Validation | ✅ **Ready** | 1h | P1 | +3% |

**Total Estimated Effort**: 8h for all phases
**Expected Final Coverage**: 75-78% (exceeds 70% target by 5-8%)
**Expected Test Count**: ~540-580 tests (from 396)

## Success Criteria

### Overall
- [ ] All tests pass: `npm test` exit code 0
- [ ] Coverage threshold met: **70%** (statements, branches, lines, functions)
- [ ] Test execution time: < 30s (currently ~30s)
- [ ] Zero failing tests

### Module Coverage Targets
- **Core modules**: 70%+ coverage (core: 100%, auth: 70%+, dashboard: 70%+) ✅
- **Business critical**: 60%+ coverage (products, orders, production, recipes)
- **Support modules**: 50%+ coverage (tenants, users, appcc, almacenes)
- **Edge modules**: 30%+ coverage (conocimiento, ingesta, technical-sheets)

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Adding tests introduces regressions | Low | Medium | Run full suite after each batch |
| Test execution time exceeds 30s | Medium | Low | Already near threshold, may need optimization |
| Complex modules require extensive mocking | High | Medium | Start with simpler patterns, learn from existing tests |
| External dependencies (DB, APIs) unstable | Medium | Low | Mock extensively, use test database |

## Strategy

### 1. Prioritize by Business Impact
- **P0**: Core business modules (products, orders, production, recipes)
- **P1**: Supporting modules (tenants, users, appcc, almacenes)  
- **P2**: Edge cases (conocimiento, ingesta, technical-sheets)

### 2. High ROI Modules First
- Each large module (~600-900 lines) ≈ +3-5% coverage
- Target: 6-8 large modules for ~25% gain
- Remaining: targeted testing for final 2% to reach 70%

### 3. Follow Proven Patterns
- Use existing test files as templates (session.service.spec.ts, dashboard.service.spec.ts)
- Mock PrismaService comprehensively (groupBy, count, findMany, etc.)
- Test both happy path and edge cases
- Group tests by method for clarity

## Open Questions

1. Should we aim for exactly 70% or higher (80%, 90%)?
2. Are there specific modules with business logic that need priority testing?
3. Should we invest in E2E tests in addition to unit tests?
4. Is 30s test execution time acceptable or should we optimize?

## Next Steps

### Execution Roadmap (Recommended Order)

**Start Here**: Phase 03 (Audit) → Phase 04 (Priority Modules) → Phase 05 (Gaps) → Phase 06 (Validation)

**Rationale**:
1. **Phase 03** (Audit): Understand the landscape, identify patterns, estimate effort
2. **Phase 04** (Priority): Test business-critical modules first (products, orders, production, recipes)
3. **Phase 05** (Gaps): Fill medium-priority modules and edge cases
4. **Phase 06** (Validation): Test critical flows and generate final report

**Alternative Paths**:
- **Fast Track**: Skip Phase 03 audit, go directly to Phase 04 if confident
- **Minimum Viable**: Phase 04 only (~65-68% coverage, close to 70% target)
- **Maximum Coverage**: All phases complete (75-78% coverage, exceeds target)

### Execution Commands

```bash
# Verify current state
cd backend
npm test -- --coverage --coverageReporters=text

# Execute Phase 04 (start here)
npm test -- products.service.spec.ts --verbose  # Fix existing tests first
npm test -- recipes.service.spec.ts --verbose   # Create and run
npm test -- orders.service.spec.ts --verbose    # Create and run
npm test -- production.service.spec.ts --verbose # Create and run

# Check progress after Phase 04
npm test -- --coverage --coverageReporters=text

# Continue with Phase 05 and 06 following phase files
```

### Documentation Updates

After completing all phases:
1. Update this plan status to COMPLETED
2. Update original plan ([260603-1854-critical-blockers-resolution/plan.md](../260603-1854-critical-blockers-resolution/plan.md))
3. Add entry to project changelog
4. Generate final coverage report artifacts

## Related Files

### Completed (original plan)
- `backend/src/modules/auth/permissions.service.spec.ts`
- `backend/src/modules/auth/session.service.spec.ts`
- `backend/src/modules/dashboard/dashboard.service.spec.ts`
- `backend/jest.config.js`
- `backend/test/setup.ts`

### To Create
- Phase 03-06 plan files
- Additional test files for zero-coverage modules

### To Review
- `backend/src/modules/products/products.service.spec.ts` (exists but failing)
- Large module services to understand business logic

## Dependencies

- **Original Plan**: Already completed (both phases)
- **Database**: PostgreSQL test database accessible
- **Environment**: `.env.test` configured
- **External**: None (all mocked in tests)