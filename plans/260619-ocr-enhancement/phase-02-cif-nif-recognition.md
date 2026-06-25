---
title: "Phase 02: CIF/NIF Recognition"
description: "Extract and validate Spanish CIF/NIF tax identifiers from OCR documents"
status: pending
priority: P1
effort: 3h
branch: develop
tags: [ocr, cif, nif, validation, spain]
created: 2026-06-19
---

# Phase 02: CIF/NIF Recognition

## Context Links

- Document Processor: `backend/ocr-microservice/app/services/document_processor.py:233-268`
- Models: `backend/ocr-microservice/app/models.py:44-54` (ExtractedDocument)
- Validation Service: `backend/ocr-microservice/app/services/validation_service.py:299-339`
- Spanish CIF Specification: https://es.wikipedia.org/wiki/C%C3%B3digo_de_identificaci%C3%B3n_fiscal

## Overview

**Priority:** P1
**Status:** pending
**Description:** Extract Spanish CIF (Código de Identificación Fiscal) and NIF (Número de Identificación Fiscal) from OCR text, validate format using Luhn checksum, and add confidence scoring.

## Key Insights

1. **Spanish Tax IDs**:
   - CIF: Company tax ID (format: letter + 7 digits + control digit)
   - NIF: Personal tax ID (format: 8 digits + letter)
   - Both follow strict format rules and checksums
2. **OCR Challenges**:
   - OCR often confuses letters with numbers (O vs 0, I vs 1)
   - OCR text may have extra spaces or line breaks
   - Need fuzzy matching + checksum validation to reduce false positives
3. **Document Patterns**:
   - "CIF:", "NIF:", "C.I.F.", "N.I.F."
   - Usually in header area
   - May be grouped with company name
4. **Integration**:
   - Extracted CIF/NIF will be used in Phase 03 for supplier matching
   - Add to `ExtractedDocument` model
   - Validate in business rules layer

## Requirements

### Functional Requirements
1. Extract CIF/NIF from OCR text using regex patterns
2. Validate CIF format with Luhn checksum algorithm
3. Validate NIF format with Spanish letter rules
4. Return confidence score for each extraction
5. Handle common OCR errors (O/0 confusion)
6. Support multiple formats: "CIF:", "NIF:", "C.I.F.", "N.I.F."

### Non-Functional Requirements
1. Extraction accuracy >= 80% on clean documents
2. False positive rate < 10%
3. Processing overhead < 50ms per document
4. Confidence scoring calibrated for Phase 03 use

## Architecture

### Data Flow

```
┌──────────────────────┐
│  OCR Raw Text         │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────┐
│ CIF/NIF Extractor        │
│  - Regex pattern match   │
│  - OCR error correction  │ ← NEW MODULE
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ CIF/NIF Validator        │
│  - Format validation     │ ← NEW MODULE
│  - Checksum calculation  │
│  - Confidence scoring    │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ ExtractedDocument        │
│  - cif_code              │ ← NEW FIELD
│  - nif_code              │ ← NEW FIELD
│  - tax_id_confidence     │ ← NEW FIELD
└──────────────────────────┘
```

### Component Changes

| Component | Change | Impact |
|-----------|--------|--------|
| `app/models.py` | Add cif_code, nif_code, tax_id_confidence fields | 3 lines |
| `app/services/document_processor.py` | Call CIF/NIF extraction | ~15 lines |
| `app/services/validation_service.py` | Add CIF/NIF validation to business rules | ~20 lines |
| `app/services/cif_validator.py` | **NEW FILE** - CIF/NIF extraction & validation | ~150 lines |

## Related Code Files

### To Create

**1. `backend/ocr-microservice/app/services/cif_validator.py`**

Purpose: Extract, validate, and score confidence for Spanish CIF/NIF tax IDs

Key functions:
- `extract_cif_nif(text: str) -> dict` - Find all CIF/NIF patterns
- `validate_cif(cif: str) -> tuple[bool, str]` - Validate format + checksum
- `validate_nif(nif: str) -> tuple[bool, str]` - Validate format + letter
- `calculate_confidence(match: dict, text_context: str) -> float` - Score extraction

### To Modify

**1. `backend/ocr-microservice/app/models.py`**
- Line 44-54: `ExtractedDocument` class
- Add fields:
  ```python
  cif_code: Optional[str] = Field(None, description="Código CIF extraído")
  nif_code: Optional[str] = Field(None, description="Código NIF extraído")
  tax_id_confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Confianza en CIF/NIF")
  ```

**2. `backend/ocr-microservice/app/services/document_processor.py`**
- Line 233-268: `_extract_structured_data()` method
- Add CIF/NIF extraction call:
  ```python
  from .cif_validator import CifNifValidator

  # In _extract_structured_data:
  cif_validator = CifNifValidator()
  tax_ids = cif_validator.extract_and_validate(raw_text)
  cif_code = tax_ids.get('cif')
  nif_code = tax_ids.get('nif')
  tax_id_confidence = tax_ids.get('confidence', 0.0)
  ```

**3. `backend/ocr-microservice/app/services/validation_service.py`**
- Line 299-339: `_validate_business_rules()` method
- Add CIF/NIF validation to business rules:
  ```python
  # Validate CIF/NIF if present
  if document.cif_code or document.nif_code:
      cif_validator = CifNifValidator()
      if document.cif_code:
          cif_valid, cif_message = cif_validator.validate_cif(document.cif_code)
          results['business_rules']['cif_validation'] = {
              'status': 'valid' if cif_valid else 'invalid',
              'cif_code': document.cif_code,
              'message': cif_message
          }
  ```

## Implementation Steps

1. **Create CIF Validator Module**
   - Create `app/services/cif_validator.py`
   - Implement CIF/NIF regex patterns
   - Implement Luhn checksum for CIF
   - Implement letter validation for NIF
   - Add OCR error correction (O→0, I→1)

2. **Implement Extraction Logic**
   - Pattern 1: "CIF: X1234567X" (explicit prefix)
   - Pattern 2: "NIF: 12345678X" (explicit prefix)
   - Pattern 3: C.I.F./N.I.F. variants
   - Pattern 4: Standalone format near company name
   - Confidence scoring based on:
     - Explicit prefix (+0.3)
     - Proper format (+0.3)
     - Valid checksum (+0.4)

3. **Update Data Models**
   - Add cif_code, nif_code, tax_id_confidence to ExtractedDocument
   - Update pydantic validators

4. **Integrate into Document Processor**
   - Import and instantiate CifNifValidator
   - Call extraction in _extract_structured_data
   - Pass to ExtractedDocument constructor

5. **Add Business Rule Validation**
   - Add CIF/NIF validation to _validate_business_rules
   - Return validation status and messages
   - Add to warnings/errors as appropriate

6. **Test with Sample Documents**
   - Test clean documents (expected accuracy >90%)
   - Test noisy documents (expected accuracy >60%)
   - Test edge cases (no CIF/NIF, malformed, OCR errors)

## Todo List

- [ ] Create `app/services/cif_validator.py` file
- [ ] Implement CIF regex patterns
- [ ] Implement NIF regex patterns
- [ ] Implement CIF Luhn checksum validation
- [ ] Implement NIF letter validation
- [ ] Add OCR error correction (O→0, I→1)
- [ ] Implement confidence scoring algorithm
- [ ] Update ExtractedDocument model
- [ ] Integrate extraction into document_processor.py
- [ ] Add validation to validation_service.py
- [ ] Test with real Spanish invoices
- [ ] Measure accuracy on test dataset
- [ ] Calibrate confidence thresholds

## Success Criteria

1. CIF/NIF extraction accuracy >= 80% on clean documents
2. False positive rate < 10%
3. Processing overhead < 50ms per document
4. All valid CIF/NIF formats pass checksum validation
5. OCR errors (O/0, I/1) handled correctly
6. Confidence scores correlate with extraction accuracy

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OCR confuses similar characters (O/0, I/1) | High | Medium | Implement error correction, use checksum validation |
| Regex patterns miss some document formats | Medium | Medium | Test with diverse document templates, add fallback patterns |
| False positives in dense text areas | Medium | Low | Require explicit prefix OR proximity to company name |
| Spanish tax ID format changes | Low | Low | Reference official BOE documentation, modular validation logic |
| Performance impact from multiple regex passes | Low | Low | Compile patterns once, use efficient matching |

## Security Considerations

1. **PII Protection**: CIF/NIF are personal identifiers; handle as sensitive data
2. **Logging**: Do not log raw CIF/NIF in production logs
3. **Storage**: Ensure CIF/NIF stored securely in database (Phase 03)
4. **Access**: Tenant isolation prevents cross-tenant data exposure

## Rollback Plan

1. Remove cif_validator.py file
2. Revert ExtractedDocument model changes
3. Remove CIF/NIF extraction from document_processor.py
4. Remove CIF/NIF validation from validation_service.py
5. Existing OCR functionality unchanged

## Next Steps

After Phase 02 completion:
- Proceed to Phase 03: Supplier DB Integration (uses extracted CIF/NIF for matching)
- Phase 03 will validate CIF/NIF against supplier database

---

**Dependencies:** Phase 01 (for HEIC support, not strictly required)
**Blocked by:** None
**Blocks:** Phase 03 (CIF/NIF required for supplier matching)