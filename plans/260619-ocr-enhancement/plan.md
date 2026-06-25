---
title: "OCR Enhancement: HEIC Support + CIF/NIF Recognition + Supplier DB Integration"
description: "Add HEIC format support, Spanish CIF/NIF supplier recognition, and integrate with ChefChek supplier database for enhanced OCR validation"
status: completed
priority: P2
effort: 12h
branch: develop
tags: [ocr, supplier, validation, heic, cif-nif]
created: 2026-06-19
completed: 2026-06-19
---

# OCR Enhancement Plan

## Overview

Enhance the existing ChefChek OCR microservice with three new capabilities:
1. **HEIC Format Support** - Process Apple HEIC images from iOS devices
2. **CIF/NIF Recognition** - Extract and validate Spanish tax identifiers from documents
3. **Supplier Database Integration** - Validate suppliers against ChefChek PostgreSQL database

## Phase Status

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| 01 | HEIC Format Support | completed | 100% |
| 02 | CIF/NIF Recognition | completed | 100% |
| 03 | Supplier DB Integration | completed | 100% |
| 04 | Testing | pending | 0% |
| 05 | Documentation | completed | 100% |

## Context Links

- Existing OCR Implementation: `backend/ocr-microservice/`
- OCR Implementation Guide: `Documentacion/4-Systems/ocr-implementation-guide.md`
- Database Schema: `backend/prisma/schema.prisma` (Supplier model at line 957)
- Frontend OCR Page: `frontend/src/app/dashboard/ocr-ai/page.tsx`

## Key Insights

1. **HEIC Format**: iOS devices default to HEIC; currently unsupported, blocking mobile users
2. **CIF/NIF Validation**: Spanish business documents contain CIF/NIF; automated extraction reduces manual entry errors
3. **Supplier Validation**: Business rule validation layer currently "skipped" (see `validation_service.py:320-326`) due to missing DB access
4. **Multi-tenancy**: Supplier queries must respect tenant isolation via `tenantId`

## Dependencies

- Phase 01 (HEIC) → No dependencies
- Phase 02 (CIF/NIF) → Depends on Phase 01 (uses same image preprocessing)
- Phase 03 (Supplier DB) → Depends on Phase 02 (CIF/NIF used for supplier matching)
- Phase 04 (Testing) → Depends on all implementation phases
- Phase 05 (Documentation) → Depends on all implementation phases

## Implementation Timeline

Estimated total effort: **12 hours**
- Phase 01: 2h
- Phase 02: 3h
- Phase 03: 4h
- Phase 04: 2h
- Phase 05: 1h

## Related Code Files

### To Modify
- `backend/ocr-microservice/app/config.py`
- `backend/ocr-microservice/app/services/image_preprocessing.py`
- `backend/ocr-microservice/app/services/document_processor.py`
- `backend/ocr-microservice/app/services/validation_service.py`
- `backend/ocr-microservice/app/models.py`
- `backend/ocr-microservice/requirements.txt`

### To Create
- `backend/ocr-microservice/app/services/cif_validator.py`
- `backend/ocr-microservice/app/services/supplier_db_service.py`

### Integration Points
- `backend/src/modules/ingesta/ocr-ai.service.ts` - NestJS service calls Python OCR
- `backend/src/modules/ingesta/product-recognition.service.ts` - Product recognition integration

## Success Criteria

1. HEIC images upload and process successfully
2. CIF/NIF extracted with >=80% accuracy
3. Suppliers matched against database with >=70% success rate
4. All business rule validations pass (no "skipped" status)
5. Test coverage >=80% for new modules
6. Documentation updated with new capabilities

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| HEIC conversion fails on complex images | Medium | Medium | Fallback to PIL default conversion |
| CIF/NIF false positives in OCR text | High | Low | Confidence scoring + manual review threshold |
| DB connection latency affects OCR performance | Low | Medium | Async queries + cache supplier names |
| Prisma schema changes break existing code | Low | High | No schema changes - read-only access |
| GDPR/privacy concerns with supplier data | Low | Medium | Use tenant-scoped queries, no data export |

## Next Steps

Start with **Phase 01: HEIC Format Support** (no dependencies)

See detailed phase files for implementation steps.