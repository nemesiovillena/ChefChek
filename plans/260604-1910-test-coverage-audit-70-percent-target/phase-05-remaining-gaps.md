---
title: "Phase 05: Fill Remaining Gaps"
description: "Add tests to medium-priority modules and edge cases"
status: pending
priority: P1
effort: 2h
branch: develop
tags: [testing, medium-priority, edge-cases, coverage-boost]
created: 2026-06-04
---

# Phase 05: Fill Remaining Gaps

## Overview

Implement test coverage for medium-priority modules that support business operations and add targeted edge case testing to existing test suites.

## Medium-Priority Modules (Support Functions)

| Module | Lines | Core Features | Methods to Test | Est. Tests | Effort |
|--------|-------|---------------|-----------------|------------|--------|
| menus.service.ts | 577 | Menu management, pricing, margins | create, findAll, findOne, update, delete, calculateTotalCost | 25-35 | 45min |
| appcc.service.ts | 732 | APPCC compliance, critical control points | create, findAll, findOne, update, delete, validateCCP | 30-40 | 1h |
| almacenes.service.ts | 662 | Warehouse/inventory management | create, findAll, findOne, update, delete, stockAlerts | 30-40 | 1h |

**Total estimated effort**: 2.5h for 3 modules
**Expected coverage gain**: +8-10%

## Implementation Steps

### Step 5.1: Create menus.service.spec.ts

**Action**: Implement tests for menu management system

**Key methods to test**:
```typescript
- create(): Create new menu with items
- findAll(): List menus with pagination and filtering
- findOne(): Get menu by ID with items
- update(): Update menu and item relationships
- delete(): Delete menu with validation
- calculateTotalCost(): Calculate menu total cost
- getMenusByCategory(): Get menus by category
```

**Test cases to include**:
- Menu creation with multiple items
- Menu-item relationships (many-to-many)
- Menu margin calculations
- Menu total cost accuracy
- Active/inactive menu filtering
- Multi-tenant menu isolation
- Menu deletion with validation (cannot delete if in use)

**Checkpoint 5.1.1**: menus.service tests passing
```bash
npm test -- menus.service.spec.ts
```

**Success Criteria**: 25-35 tests passing, >40% coverage

---

### Step 5.2: Create appcc.service.spec.ts

**Action**: Implement tests for APPCC compliance system

**Key methods to test**:
```typescript
- create(): Create new APPCC plan
- findAll(): List APPCC plans with filtering
- findOne(): Get APPCC plan by ID with CCPs
- update(): Update APPCC plan and CCP relationships
- delete(): Delete APPCC plan
- validateCCP(): Validate critical control point
- getCriticalControlPoints(): Get active CCPs
```

**Test cases to include**:
- APPCC plan creation with CCPs
- CCP validation rules (temperature, time, hygiene)
- Critical limit monitoring
- Corrective action tracking
- Multi-tenant APPCC isolation
- APPCC plan versioning (if applicable)

**Checkpoint 5.2.1**: appcc.service tests passing
```bash
npm test -- appcc.service.spec.ts
```

**Success Criteria**: 30-40 tests passing, >40% coverage

---

### Step 5.3: Create almacenes.service.spec.ts

**Action**: Implement tests for warehouse/inventory management

**Key methods to test**:
```typescript
- create(): Create new warehouse/storage location
- findAll(): List warehouses with filtering
- findOne(): Get warehouse by ID with stock
- update(): Update warehouse details
- delete(): Delete warehouse with validation
- stockAlerts(): Get stock alerts for warehouses
- transferStock(): Transfer stock between warehouses (if applicable)
```

**Test cases to include**:
- Warehouse creation and management
- Stock level monitoring
- Low stock alerts
- Multi-warehouse inventory tracking
- Stock transfer validation (if applicable)
- Multi-tenant warehouse isolation
- Warehouse deletion with validation

**Checkpoint 5.3.1**: almacenes.service tests passing
```bash
npm test -- almacenes.service.spec.ts
```

**Success Criteria**: 30-40 tests passing, >40% coverage

---

### Step 5.4: Targeted Edge Case Testing

**Action**: Add edge case tests to existing suites to boost coverage

**Target areas**:
```typescript
- products.service.spec.ts: Add pagination edge cases, concurrent updates
- auth services: Add error handling, expired sessions, invalid tokens
- dashboard.service.spec.ts: Add edge cases for KPI calculations
- notifications.service.spec.ts: Add retry logic, batch processing
```

**Edge case patterns**:
- Empty result sets (findMany returns [])
- Null/undefined parameters
- Database connection errors (mock rejection)
- Concurrent modifications
- Large result sets (pagination limits)
- Invalid ID formats
- Multi-tenant isolation violations

**Checkpoint 5.4.1**: Edge case tests passing
```bash
npm test -- --coverage --coverageReporters=text
```

**Expected outcome**: +2-3% coverage from edge cases

**Success Criteria**: Edge cases added, no new failures

---

### Step 5.5: Verify Coverage Progress

**Action**: Run full test suite and measure coverage improvement

**Checkpoint 5.5.1**: Coverage measurement
```bash
npm test -- --coverage --coverageReporters=text
```

**Expected outcome**:
- Coverage increase: +8-10%
- New total coverage: ~73-78%
- All medium-priority module tests passing
- Test count: ~500-540 total

**Success Criteria**:
- Coverage >= 73%
- 0 failing tests
- Test execution time < 60s

## Expected Outcomes

### By End of Phase 05
- ✅ 3 medium-priority modules with >40% coverage
- ✅ Support functionality tested (menus, APPCC, warehouses)
- ✅ ~500-540 tests passing (was 396)
- ✅ Coverage target: ~73-78% (exceeding 70% target!)
- ✅ Edge cases added to existing test suites

### Test Quality Standards
- All CRUD operations tested
- Business rules validated (APPCC compliance, menu margins)
- Error cases covered
- Multi-tenant isolation verified
- Edge cases tested (empty results, null params, errors)

## Rollback Strategy

If tests break existing functionality:
1. Isolate breaking test to specific module
2. Review service implementation for test misunderstandings
3. Fix test expectations before changing service code
4. Rollback individual test files if needed

Rollback commands:
```bash
git checkout HEAD~1 -- path/to/failing.spec.ts
npm test  # Verify other tests still pass
```

## Success Criteria

- [ ] All 3 medium-priority module test suites created
- [ ] All medium-priority tests passing (0 failures)
- [ ] Medium-priority module coverage >40% each
- [ ] Edge cases added to existing suites
- [ ] Overall coverage >= 73%
- [ ] Test execution time < 60s
- [ ] No regressions in existing tests

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| APPCC compliance rules complex | Medium | Medium | Document CCP validation rules before testing |
| Menu-item relationships tricky | Medium | Medium | Reuse patterns from recipes service tests |
| Edge cases increase execution time | Low | Low | Target critical edge cases only, not exhaustive |
| Breaking changes to service code | Low | Low | Tests only, no service modifications |

## Dependencies

- **Phase 04**: P0 modules tested (business-critical patterns established)
- **Database**: Test database stable and accessible
- **Patterns**: Existing test files provide successful patterns (dashboard, session, permissions)

## Open Questions

1. Are there specific APPCC compliance rules that need documentation before testing?
2. Should we prioritize edge cases for specific modules (auth, products)?
3. Is the test execution time target acceptable (<60s for 500+ tests)?

## Next Steps

After completing this phase:
- [ ] Proceed to Phase 06: Critical Path Validation (or skip if 73%+ coverage is sufficient)
- [ ] Update progress in main plan.md
- [ ] Generate final coverage report