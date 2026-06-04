---
title: "Phase 01: Fix Jest Testing Infrastructure"
description: "Resolve Jest configuration issues and fix failing tests"
status: pending
priority: P1
effort: 2h
branch: develop
tags: [testing, jest, unit-tests]
created: 2026-06-03
---

# Phase 01: Fix Jest Testing Infrastructure

## Overview

Fix Jest testing infrastructure to enable reliable test execution and accurate coverage reporting.

## Context

Current test status:
- **5 test suites passing**
- **1 test suite failing** (NotificationsService - 4 assertions)
- **Root Cause**: Mock expectations don't match actual Prisma query execution
- **Last Change**: Jest config converted from JSON to CommonJS (commit 3f6df17)

## Files to Modify

| File | Action | Lines | Priority |
|------|--------|-------|----------|
| `backend/src/modules/core/notifications.service.spec.ts` | Fix mock expectations | ~400 | P0 |
| `backend/test/setup.ts` | Review and cleanup | ~70 | P1 |
| `backend/jest.config.js` | Verify configuration | ~40 | P2 |

## Implementation Steps

### Step 1: Diagnose NotificationsService Test Failures

**Checkpoint 1.1**: Run failing tests with verbose output
```bash
cd backend && npm test -- notifications.service.spec.ts --verbose --no-coverage
```

**Success Criteria**: Output shows exact mock mismatches

---

### Step 2: Analyze NotificationsService Implementation

**Action**: Read actual service implementation to understand query patterns
```bash
cat backend/src/modules/core/notifications.service.ts | grep -A 10 "findMany\|findFirst"
```

**Checkpoint 1.2**: Verify actual Prisma query patterns

**Success Criteria**: Documented query patterns from service

---

### Step 3: Fix Mock Expectations

**Action**: Update mock expectations in test file

**Files to edit**:
- `backend/src/modules/core/notifications.service.spec.ts`

**Changes needed** (based on test failures):
1. Line ~387: Add `select` property to mock expectation
2. Line ~429: Add `select` property to mock expectation

**Mock expectation pattern**:
```typescript
// Current (failing):
expect(mockPrismaService.alert.findMany).toHaveBeenCalledWith({
  where: { tenantId: "tenant-1" },
});

// Should be (matching actual query):
expect(mockPrismaService.alert.findMany).toHaveBeenCalledWith({
  where: { tenantId: "tenant-1" },
  select: { id: true },  // or whatever the service actually requests
});
```

**Checkpoint 1.3**: Run tests after fixing mocks
```bash
cd backend && npm test -- notifications.service.spec.ts
```

**Success Criteria**: All NotificationsService tests pass

---

### Step 4: Verify Jest Configuration

**Action**: Ensure CommonJS config is correct

**Checkpoint 1.4**: Validate Jest configuration
```bash
cd backend && node -e "console.log(require('./jest.config.js'))"
```

**Success Criteria**: Configuration loads without errors

---

### Step 5: Run Full Test Suite

**Checkpoint 1.5**: Execute all tests
```bash
cd backend && npm test
```

**Success Criteria**:
- All 6 test suites pass
- 0 failed tests
- Exit code 0

---

### Step 6: Verify Coverage Reporting

**Checkpoint 1.6**: Generate coverage report
```bash
cd backend && npm run test:cov
```

**Success Criteria**:
- Coverage report generated in `coverage/` directory
- No errors during coverage generation
- Execution time < 15s

---

### Step 7: Test Environment Setup Verification

**Action**: Ensure test environment is properly configured

**Checkpoint 1.7**: Verify test database connectivity
```bash
cd backend && DATABASE_URL="your-test-db-url" node -e "require('./test/setup.ts')"
```

**Success Criteria**: Setup script executes without errors

---

## Rollback Strategy

If tests break after changes:
1. Revert `notifications.service.spec.ts` to previous state
2. Verify Jest config is still valid: `npm test -- --listTests`
3. If config issue, revert to commit `3f6df17`

## Success Criteria

- [ ] All tests pass: `npm test` exit code 0
- [ ] NotificationsService tests: 100% passing
- [ ] Coverage report generated: `coverage/index.html` exists
- [ ] Test execution time: < 15 seconds
- [ ] No warnings in Jest output

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Mock fixes break other tests | Medium | Run full suite after each fix |
| Jest config regression | Low | Config is simple, CommonJS is stable |
| Coverage threshold too high | Low | Currently 70%, will verify |

## Dependencies

- **None**: This phase has no dependencies

## Next Steps

After completing this phase:
- [ ] Update plan.md status
- [ ] Proceed to Phase 02 (Lucia Auth Migration)

## Open Questions

1. What is the actual Prisma query pattern in NotificationsService?
2. Are there other test suites with similar mock issues?

## Checkpoints Summary

| ID | Command | Expected Result |
|----|---------|-----------------|
| 1.1 | `npm test -- notifications.service.spec.ts --verbose` | Show mock mismatches |
| 1.2 | Read service implementation | Document query patterns |
| 1.3 | `npm test -- notifications.service.spec.ts` | All pass |
| 1.4 | `node -e "require('./jest.config.js')"` | Config loads |
| 1.5 | `npm test` | 6/6 suites pass, 0 failures |
| 1.6 | `npm run test:cov` | Report generated |
| 1.7 | Test setup verification | No errors |