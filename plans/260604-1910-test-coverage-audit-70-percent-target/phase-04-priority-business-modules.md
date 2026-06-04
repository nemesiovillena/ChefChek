---
title: "Phase 04: Priority Business Modules"
description: "Implement tests for high-priority business-critical modules"
status: pending
priority: P0
effort: 3h
branch: develop
tags: [testing, business-logic, coverage, critical-path]
created: 2026-06-04
---

# Phase 04: Priority Business Modules

## Overview

Implement comprehensive test coverage for business-critical modules that have 0% coverage but are essential for ChefChek operations.

## Priority P0 Modules (Business Critical)

| Module | Lines | Core Features | Methods to Test | Est. Tests | Effort |
|--------|-------|---------------|-----------------|------------|--------|
| products.service.ts | 395 | Product management, pricing, stock | create, findAll, findOne, update, delete, getByCategory, lowStockAlerts | 30-40 | 1.5h |
| recipes.service.ts | 556 | Recipe management, costs, ingredients | create, findAll, findOne, update, delete, calculateCost, duplicate | 40-50 | 2h |
| orders.service.ts | 725 | Order processing, status, fulfillment | create, findAll, findOne, updateStatus, cancel, fulfill | 45-55 | 2.5h |
| production.service.ts | 929 | Production planning, execution, tracking | create, findAll, findOne, updateStatus, complete, schedule | 55-65 | 3h |

**Total estimated effort**: 9h for 4 modules
**Expected coverage gain**: +20-25%

## Implementation Steps

### Step 4.1: Fix products.service.spec.ts

**Current State**: Test file exists but failing

**Action**: Fix failing products.service tests

**Debug approach**:
```bash
npm test -- products.service.spec.ts --verbose
```

**Fixes needed** (likely):
- Mock PrismaService methods correctly
- Match actual service method signatures
- Fix test expectations to match actual response structure

**Checkpoint 4.1.1**: products.service tests passing
```bash
npm test -- products.service.spec.ts
```

**Success Criteria**: All products.service tests pass

---

### Step 4.2: Create recipes.service.spec.ts

**Action**: Implement comprehensive tests for recipe management

**Key methods to test**:
```typescript
- create(): Create new recipe with ingredients
- findAll(): List recipes with pagination and filtering
- findOne(): Get recipe by ID with details
- update(): Update recipe and ingredient relationships
- delete(): Delete recipe (with validation)
- calculateCost(): Calculate recipe total cost
- duplicate(): Duplicate recipe with new ID
```

**Mock requirements**:
```typescript
const mockPrismaService = {
  recipe: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  recipeIngredient: {
    findMany: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
  },
};
```

**Test cases to include**:
- Happy path for all CRUD operations
- Recipe with ingredients relationships
- Cost calculation accuracy
- Duplicate recipe functionality
- Recipe deletion with existing references validation
- Pagination and filtering

**Checkpoint 4.2.1**: recipes.service tests passing
```bash
npm test -- recipes.service.spec.ts
```

**Success Criteria**: 40-50 tests passing, >50% coverage

---

### Step 4.3: Create orders.service.spec.ts

**Action**: Implement comprehensive tests for order processing

**Key methods to test**:
```typescript
- create(): Create new order
- findAll(): List orders with filtering and pagination
- findOne(): Get order by ID with details
- updateStatus(): Update order status (PENDING→IN_PROGRESS→COMPLETED)
- cancel(): Cancel order with validation
- fulfill(): Mark order as fulfilled
- getOrdersByStatus(): Get orders by status
```

**Test cases to include**:
- Order creation with validation
- Status transitions (validate allowed transitions)
- Order cancellation business rules
- Order fulfillment tracking
- Revenue calculations
- Customer data included in orders
- Multi-tenant order isolation

**Checkpoint 4.3.1**: orders.service tests passing
```bash
npm test -- orders.service.spec.ts
```

**Success Criteria**: 45-55 tests passing, >50% coverage

---

### Step 4.4: Create production.service.spec.ts

**Action**: Implement comprehensive tests for production management

**Key methods to test**:
```typescript
- create(): Create new production plan
- findAll(): List productions with filtering
- findOne(): Get production by ID with details
- updateStatus(): Update production status (PLANNED→IN_PROGRESS→COMPLETED)
- complete(): Mark production as completed
- schedule(): Schedule production for specific date/time
- getActiveProductions(): Get currently active productions
```

**Test cases to include**:
- Production creation with validation
- Production scheduling conflicts
- Status transitions and validation
- Production completion tracking
- Resource allocation (if applicable)
- Multi-tenant production isolation
- Production vs recipe relationship

**Checkpoint 4.4.1**: production.service tests passing
```bash
npm test -- production.service.spec.ts
```

**Success Criteria**: 55-65 tests passing, >50% coverage

---

### Step 4.5: Verify Coverage Progress

**Action**: Run full test suite and measure coverage improvement

**Checkpoint 4.5.1**: Coverage measurement
```bash
npm test -- --coverage --coverageReporters=text
```

**Expected outcome**:
- Coverage increase: +20-25%
- New total coverage: ~65-68%
- All P0 module tests passing
- Test count: ~450-490 total

**Success Criteria**:
- Coverage >= 65%
- 0 failing tests
- Test execution time < 45s

## Expected Outcomes

### By End of Phase 04
- ✅ 4 business-critical modules with >50% coverage
- ✅ Core product/order/production/recipe functionality tested
- ✅ ~450-490 tests passing (was 396)
- ✅ Coverage target: ~65-68% (getting close to 70%)

### Test Quality Standards
- All CRUD operations tested
- Business logic validated
- Error cases covered
- Multi-tenant isolation verified
- Mock comprehensive (PrismaService methods)

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

- [ ] All 4 P0 module test suites created
- [ ] All P0 tests passing (0 failures)
- [ ] P0 module coverage >50% each
- [ ] Overall coverage >= 65%
- [ ] Test execution time < 45s
- [ ] No regressions in existing tests

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Complex business logic misunderstood | High | Medium | Document thoroughly before testing |
| Mock setup too complex | Medium | Medium | Reuse patterns from existing tests |
| Test execution time exceeds 45s | Medium | Low | Tests already near limit, may need parallelization |
| Breaking changes to service code | Low | Low | Tests only, no service modifications |

## Dependencies

- **Phase 03**: Audit results (method documentation, test estimates)
- **Database**: Test database stable and accessible
- **Patterns**: Existing test files provide successful patterns

## Open Questions

1. Should we add integration tests for critical flows (order fulfillment, production execution)?
2. Are there business rules that need explicit documentation before testing?
3. What's the acceptable test execution time target (currently 45s)?

## Next Steps

After completing this phase:
- [ ] Proceed to Phase 05: Fill Remaining Gaps
- [ ] Or skip directly to Phase 06 if 65% coverage is sufficient
- [ ] Update progress in main plan.md