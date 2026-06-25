---
title: "Phase 04: Testing"
description: "Comprehensive testing of OCR enhancements: HEIC support, CIF/NIF recognition, and supplier integration"
status: pending
priority: P1
effort: 2h
branch: develop
tags: [testing, e2e, unit-tests, validation]
created: 2026-06-19
---

# Phase 04: Testing

## Context Links

- Existing Tests: `backend/ocr-microservice/tests/test_accuracy.py`
- OCR Implementation Guide: `Documentacion/4-Systems/ocr-implementation-guide.md`
- NestJS E2E Tests: `backend/test/e2e/products-crud.e2e-spec.ts`
- Product Recognition Tests: `backend/src/modules/ingesta/product-recognition.service.spec.ts`

## Overview

**Priority:** P1
**Status:** pending
**Description:** Validate all three enhancement phases with comprehensive unit tests, integration tests, and end-to-end testing. Ensure >=80% code coverage for new modules.

## Key Insights

1. **Test Strategy**:
   - Unit tests for individual modules (cif_validator, supplier_db_service)
   - Integration tests for OCR pipeline
   - E2E tests for full workflow
2. **Test Data Required**:
   - HEIC sample files (iOS screenshots)
   - PDF invoices with CIF/NIF
   - Sample supplier database entries
3. **Existing Test Coverage**: `test_accuracy.py` exists but focuses on OCR accuracy only
4. **Performance Testing**: Ensure no regressions in processing time

## Requirements

### Functional Requirements
1. Unit tests for all new modules (>=80% coverage)
2. Integration tests for OCR pipeline
3. E2E tests for full workflow (upload → OCR → validation → storage)
4. Performance tests for latency and throughput
5. Error handling tests (DB failures, malformed files)
6. Tenant isolation tests

### Non-Functional Requirements
1. All tests pass before Phase 05 (documentation)
2. No regressions in existing OCR functionality
3. Test execution time < 5 minutes for full suite
4. Clear failure messages and debugging info

## Architecture

### Test Layers

```
┌─────────────────────────┐
│  E2E Tests              │
│  - Full OCR workflow    │
│  - Frontend to DB       │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Integration Tests      │
│  - OCR Pipeline         │
│  - API Endpoints        │
│  - DB Integration       │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Unit Tests             │
│  - cif_validator        │
│  - supplier_db_service  │
│  - image preprocessing  │
└─────────────────────────┘
```

### Test Coverage Targets

| Module | Target Coverage | Current | Gap |
|--------|----------------|---------|-----|
| cif_validator.py | 90% | 0% | 90% |
| supplier_db_service.py | 90% | 0% | 90% |
| document_processor.py (HEIC) | 80% | 0% | 80% |
| validation_service.py (supplier) | 80% | 0% | 80% |
| Total | >=80% | ~30% | ~50% |

## Related Code Files

### To Create

**1. `backend/ocr-microservice/tests/test_cif_validator.py`**

Purpose: Unit tests for CIF/NIF extraction and validation

Test cases:
- Valid CIF with correct checksum
- Invalid CIF with wrong checksum
- Valid NIF with correct letter
- Invalid NIF with wrong letter
- OCR error correction (O→0, I→1)
- Confidence scoring
- Edge cases (empty string, malformed, no match)

**2. `backend/ocr-microservice/tests/test_supplier_db_service.py`**

Purpose: Unit tests for supplier database queries

Test cases:
- Exact supplier name match
- Fuzzy supplier name match
- Unknown supplier (not found)
- Tenant isolation (no cross-tenant leaks)
- Database connection errors
- Connection pool behavior

**3. `backend/ocr-microservice/tests/test_heic_support.py`**

Purpose: Unit tests for HEIC format support

Test cases:
- HEIC file upload acceptance
- HEIC to JPEG conversion
- OCR accuracy after conversion
- Conversion time measurement
- Large HEIC file handling
- Malformed HEIC file handling

**4. `backend/ocr-microservice/tests/integration/test_ocr_pipeline.py`**

Purpose: Integration tests for full OCR pipeline

Test cases:
- HEIC image → OCR → validation → result
- PDF with CIF/NIF → extraction → validation
- Supplier matching workflow
- Multi-tenant scenario
- End-to-end error handling

**5. `backend/test/e2e/ocr-enhancements.e2e-spec.ts`**

Purpose: E2E tests via NestJS framework

Test cases:
- Frontend upload → OCR service → database
- Supplier validation in business rules
- Tenant isolation enforcement
- Performance under load

### To Modify

**1. `backend/ocr-microservice/tests/test_accuracy.py`**
- Add HEIC format to test suite
- Add CIF/NIF extraction accuracy tests
- Update baseline metrics

## Implementation Steps

1. **Create Test Fixtures**
   - Create sample HEIC files (iOS screenshots)
   - Create PDF samples with CIF/NIF
   - Create test supplier database entries
   - Mock database responses for unit tests

2. **Implement Unit Tests**
   - Create `test_cif_validator.py` with full coverage
   - Create `test_supplier_db_service.py` with mocked DB
   - Create `test_heic_support.py` with file fixtures
   - Run and fix failing tests

3. **Implement Integration Tests**
   - Create `test_ocr_pipeline.py`
   - Test full workflow with real dependencies
   - Test error scenarios
   - Verify tenant isolation

4. **Implement E2E Tests**
   - Create `ocr-enhancements.e2e-spec.ts`
   - Test via NestJS HTTP layer
   - Validate database state after processing
   - Measure performance

5. **Performance Testing**
   - Measure HEIC conversion time
   - Measure DB query latency
   - Measure end-to-end latency
   - Compare with baseline (existing OCR)

6. **Coverage Analysis**
   - Run coverage report
   - Identify gaps
   - Add tests for uncovered code
   - Verify >=80% coverage

7. **Test Documentation**
   - Document test requirements
   - Document test data requirements
   - Document how to run tests

## Todo List

- [ ] Create test fixtures directory
- [ ] Add sample HEIC files
- [ ] Add sample PDF with CIF/NIF
- [ ] Create mock supplier database
- [ ] Create test_cif_validator.py
- [ ] Create test_supplier_db_service.py
- [ ] Create test_heic_support.py
- [ ] Create integration test_ocr_pipeline.py
- [ ] Create e2e test ocr-enhancements.e2e-spec.ts
- [ ] Update test_accuracy.py
- [ ] Run unit tests and fix failures
- [ ] Run integration tests and fix failures
- [ ] Run e2e tests and fix failures
- [ ] Measure test coverage
- [ ] Add tests for uncovered code
- [ ] Measure performance (latency, throughput)
- [ ] Document test execution

## Success Criteria

1. All new tests pass (0 failures)
2. Test coverage >=80% for new modules
3. No regressions in existing tests
4. Performance within limits:
   - HEIC conversion < 500ms
   - DB query < 100ms
   - End-to-end < 5s (typical document)
5. Tenant isolation verified (0 cross-tenant leaks)
6. E2E tests validate full workflow

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Test data not representative of real documents | Medium | Medium | Use real customer documents (anonymized) for validation |
| Database mocking doesn't match real behavior | Medium | Medium | Use test database for integration tests |
| Flaky tests due to timing or async issues | Low | Medium | Use explicit waits, avoid race conditions |
| Performance tests fail in CI environment | Low | Low | Adjust timeouts for CI, use performance thresholds |
| HEIC sample files not available | Medium | Low | Generate test HEIC files with conversion tools |

## Test Execution

### Unit Tests
```bash
cd backend/ocr-microservice
python -m pytest tests/test_cif_validator.py -v --cov=app.services.cif_validator
python -m pytest tests/test_supplier_db_service.py -v --cov=app.services.supplier_db_service
python -m pytest tests/test_heic_support.py -v --cov=app.services.image_preprocessing
```

### Integration Tests
```bash
cd backend/ocr-microservice
python -m pytest tests/integration/test_ocr_pipeline.py -v
```

### E2E Tests
```bash
cd backend
npm run test:e2e -- ocr-enhancements.e2e-spec.ts
```

### Coverage Report
```bash
cd backend/ocr-microservice
python -m pytest --cov=app --cov-report=html
```

## Rollback Plan

If tests reveal critical issues:
1. Revert changes to failing phase
2. Fix issues locally
3. Re-run tests
4. Phase completion only when all tests pass

## Next Steps

After Phase 04 completion:
- All tests passing with >=80% coverage
- Proceed to Phase 05: Documentation
- Ready for deployment

---

**Dependencies:** Phase 01, Phase 02, Phase 03
**Blocked by:** All implementation phases
**Blocks:** Phase 05 (documentation follows successful testing)