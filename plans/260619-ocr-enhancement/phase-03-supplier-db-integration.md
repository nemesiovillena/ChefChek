---
title: "Phase 03: Supplier Database Integration"
description: "Integrate OCR microservice with ChefChek PostgreSQL supplier database for validation and auto-matching"
status: pending
priority: P1
effort: 4h
branch: develop
tags: [ocr, database, supplier, validation, prisma]
created: 2026-06-19
---

# Phase 03: Supplier Database Integration

## Context Links

- Supplier Model: `backend/prisma/schema.prisma:957-982`
- Validation Service: `backend/ocr-microservice/app/services/validation_service.py:299-339` (currently "skipped")
- Business Validation: `backend/ocr-microservice/app/services/validation_service.py:319-326`
- NestJS Service: `backend/src/modules/ingesta/product-recognition.service.ts`

## Overview

**Priority:** P1
**Status:** pending
**Description:** Connect OCR microservice to ChefChek PostgreSQL supplier database via Prisma to:
1. Validate extracted supplier names against database
2. Auto-match suppliers using CIF/NIF
3. Enable business rule validation layer
4. Add supplier confidence scoring
5. Support multi-tenant isolation

## Key Insights

1. **Current State**: Business rule validation is "skipped" (see `validation_service.py:319-326`) due to missing DB access
2. **Supplier Schema**: `Supplier` model exists with `name`, `contactPerson`, `email`, `phone`, `isActive`, etc.
3. **Multi-Tenancy**: All queries must filter by `tenantId` for isolation
4. **Matching Strategy**:
   - **Exact Match**: Supplier name exactly matches DB
   - **Fuzzy Match**: Supplier name similar (Levenshtein distance)
   - **CIF Match**: Extracted CIF matches supplier CIF (if stored)
   - **Combined**: Multiple signals improve confidence
5. **Architecture Decision**: Direct DB access from Python vs via NestJS
   - **Decision**: Direct access from Python using `asyncpg` + `psycopg2`
   - **Why**: Avoid extra HTTP round-trip, keep validation synchronous
   - **Trade-off**: Duplicate DB connection config (manage via environment variables)

## Requirements

### Functional Requirements
1. Connect to PostgreSQL database with tenant-scoped queries
2. Validate supplier name against database (exact + fuzzy match)
3. Match supplier by CIF/NIF (if available)
4. Return supplier confidence score (0-1)
5. Update business rule validation from "skipped" to "valid"/"invalid"
6. Log supplier metadata in validation results
7. Handle missing/invalid suppliers gracefully

### Non-Functional Requirements
1. DB query latency < 100ms per document
2. No impact on existing OCR performance
3. Tenant isolation enforced (no cross-tenant data leaks)
4. Graceful degradation if DB unavailable
5. Connection pooling for concurrent requests

## Architecture

### Data Flow

```
┌──────────────────────────┐
│  ExtractedDocument       │
│  - supplier_name: "ABC"  │
│  - cif_code: "X1234567"  │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ ValidationService        │
│  _validate_business_rules│
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ SupplierDbService        │ ← NEW MODULE
│  - query_supplier_by_name│
│  - query_supplier_by_cif │
│  - fuzzy_match_supplier  │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│  PostgreSQL              │
│  SELECT * FROM suppliers │
│  WHERE tenantId = ?       │
└──────────────────────────┘
```

### Component Changes

| Component | Change | Impact |
|-----------|--------|--------|
| `app/services/supplier_db_service.py` | **NEW FILE** - DB connection & queries | ~200 lines |
| `app/services/validation_service.py` | Replace "skipped" with real validation | ~30 lines |
| `app/config.py` | Add DB connection config | ~10 lines |
| `app/models.py` | Add supplier_id to ExtractedDocument | 1 line |
| `requirements.txt` | Add `asyncpg`, `psycopg2-binary` | 2 lines |

## Related Code Files

### To Create

**1. `backend/ocr-microservice/app/services/supplier_db_service.py`**

Purpose: Query PostgreSQL supplier database with tenant isolation

Key functions:
- `__init__(db_url: str)` - Initialize connection pool
- `get_supplier_by_name(tenant_id: str, name: str)` - Exact name match
- `get_supplier_by_cif(tenant_id: str, cif: str)` - CIF match (if stored)
- `fuzzy_match_suppliers(tenant_id: str, name: str, threshold: float)` - Fuzzy name match
- `match_supplier(tenant_id: str, name: str, cif: str = None)` - Combined matching with confidence

Configuration:
- Database URL from environment (`SUPPLIERS_DB_URL`)
- Connection pool (min 1, max 10)
- Timeout 5s

### To Modify

**1. `backend/ocr-microservice/app/config.py`**
- Add DB connection config:
  ```python
  # Supplier Database
  suppliers_db_url: str = "postgresql://user:pass@localhost:5432/chefchek"
  suppliers_db_pool_min: int = 1
  suppliers_db_pool_max: int = 10
  suppliers_db_timeout: int = 5
  ```

**2. `backend/ocr-microservice/app/models.py`**
- Line 44-54: `ExtractedDocument` class
- Add field:
  ```python
  supplier_id: Optional[str] = Field(None, description="ID del proveedor matcheado en BD")
  ```

**3. `backend/ocr-microservice/app/services/validation_service.py`**
- Line 299-339: `_validate_business_rules()` method
- Replace "skipped" with real validation:
  ```python
  from .supplier_db_service import SupplierDbService

  # In __init__:
  self.supplier_db = SupplierDbService(settings.suppliers_db_url)

  # In _validate_business_rules:
  if document.supplier_name:
      # Try exact match
      supplier = self.supplier_db.get_supplier_by_name(
          tenant_id=document.tenant_id,  # Need to add tenant_id to ExtractedDocument
          name=document.supplier_name
      )
      if supplier:
          results['business_rules']['supplier_validation'] = {
              'status': 'valid',
              'supplier_id': supplier['id'],
              'supplier_name': supplier['name'],
              'message': 'Supplier found in database'
          }
          document.supplier_id = supplier['id']
      else:
          # Try fuzzy match
          fuzzy_matches = self.supplier_db.fuzzy_match_suppliers(
              tenant_id=document.tenant_id,
              name=document.supplier_name,
              threshold=0.7
          )
          if fuzzy_matches:
              results['business_rules']['supplier_validation'] = {
                  'status': 'fuzzy_match',
                  'matches': fuzzy_matches,
                  'message': f'{len(fuzzy_matches)} similar suppliers found'
              }
          else:
              results['business_rules']['supplier_validation'] = {
                  'status': 'not_found',
                  'supplier_name': document.supplier_name,
                  'message': 'Supplier not found in database'
              }
              results['warnings'].append(f'Unknown supplier: {document.supplier_name}')
  ```

**4. `backend/ocr-microservice/app/models.py` (additional)**
- Line 44-54: `ExtractedDocument` class
- Add field:
  ```python
  tenant_id: Optional[str] = Field(None, description="ID del tenant para multi-tenancy")
  ```

**5. `backend/ocr-microservice/requirements.txt`**
- Add:
  ```
  asyncpg==0.29.0
  psycopg2-binary==2.9.9
  ```

### Database Considerations

**Supplier Table Fields** (from schema.prisma:957-982):
- `id`: String (cuid)
- `tenantId`: String (for isolation)
- `name`: String
- `isActive`: Boolean

**Note**: Supplier table does NOT currently store CIF/NIF. For Phase 03:
1. Match by name only (exact + fuzzy)
2. Prepare for future CIF column addition
3. Use extracted CIF/NIF as supplemental signal

## Implementation Steps

1. **Add Dependencies**
   - Update requirements.txt with `asyncpg==0.29.0` and `psycopg2-binary==2.9.9`
   - Install dependencies

2. **Create Database Service**
   - Create `app/services/supplier_db_service.py`
   - Implement connection pooling with asyncpg
   - Implement query methods with tenant isolation
   - Add fuzzy matching using Levenshtein distance

3. **Update Configuration**
   - Add DB connection config to config.py
   - Add environment variable for `SUPPLIERS_DB_URL`
   - Default to local development database

4. **Update Data Models**
   - Add supplier_id to ExtractedDocument
   - Add tenant_id to ExtractedDocument
   - Add pydantic validators

5. **Integrate into Validation Service**
   - Import and instantiate SupplierDbService
   - Replace "skipped" business rule validation
   - Add exact match query
   - Add fuzzy match fallback
   - Update validation results

6. **Add Tenant Context**
   - Pass tenant_id from NestJS to Python OCR service
   - Update API endpoint to accept tenant_id parameter
   - Use tenant_id in all DB queries

7. **Handle Database Errors**
   - Catch connection errors
   - Graceful degradation if DB unavailable
   - Log warnings without breaking OCR

8. **Test with Real Data**
   - Test with known suppliers (exact match)
   - Test with similar suppliers (fuzzy match)
   - Test with unknown suppliers (not found)
   - Test tenant isolation (no cross-tenant leaks)

## Todo List

- [ ] Add asyncpg and psycopg2-binary to requirements.txt
- [ ] Update config.py with DB connection config
- [ ] Create app/services/supplier_db_service.py
- [ ] Implement connection pooling
- [ ] Implement get_supplier_by_name()
- [ ] Implement fuzzy_match_suppliers() with Levenshtein
- [ ] Implement match_supplier() with confidence scoring
- [ ] Add tenant_id to ExtractedDocument model
- [ ] Add supplier_id to ExtractedDocument model
- [ ] Update validation_service.py with real validation
- [ ] Update API endpoints to accept tenant_id
- [ ] Add database error handling
- [ ] Test with known suppliers
- [ ] Test tenant isolation
- [ ] Test database unavailability scenario
- [ ] Measure query latency

## Success Criteria

1. Business rule validation no longer returns "skipped"
2. Exact supplier match accuracy >= 95% for known suppliers
3. Fuzzy match accuracy >= 70% for similar suppliers
4. DB query latency < 100ms per document
5. Tenant isolation enforced (zero cross-tenant data exposure)
6. Graceful degradation when DB unavailable
7. No impact on existing OCR performance

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| DB connection pool exhaustion under load | Medium | Medium | Configure max pool size, implement query timeout |
| Fuzzy matching produces wrong supplier | Medium | Low | Use high similarity threshold (0.7), require manual review |
| Tenant_id not passed from frontend | Low | High | Add tenant_id to OCR API contract, validate on backend |
| Supplier table doesn't have CIF column | High | Low | Match by name only, document for future enhancement |
| DB schema changes break queries | Low | Medium | Use explicit column names, version migration scripts |
| Connection latency affects OCR performance | Low | Medium | Async queries, connection pooling, cache results |

## Security Considerations

1. **Tenant Isolation**: All queries MUST include `WHERE tenantId = ?`
2. **SQL Injection**: Use parameterized queries only (asyncpg prevents injection)
3. **Credentials**: Store DB URL in environment variables, never in code
4. **Logging**: Do not log raw supplier names (PII), use supplier_id
5. **Rate Limiting**: Prevent DB scanning via OCR API rate limiting

## Rollback Plan

1. Remove supplier_db_service.py file
2. Revert validation_service.py to "skipped" status
3. Remove supplier_id and tenant_id from ExtractedDocument
4. Remove DB config from config.py
5. Remove asyncpg and psycopg2-binary from requirements.txt
6. Existing OCR functionality unchanged

## Next Steps

After Phase 03 completion:
- Proceed to Phase 04: Testing (validate all three phases together)
- Proceed to Phase 05: Documentation (update implementation guide)

---

**Dependencies:** Phase 02 (CIF/NIF extraction)
**Blocked by:** Phase 02
**Blocks:** Phase 04 (testing requires complete implementation)