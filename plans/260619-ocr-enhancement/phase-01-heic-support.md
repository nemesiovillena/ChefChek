---
title: "Phase 01: HEIC Format Support"
description: "Add HEIC image format support to OCR microservice for iOS device compatibility"
status: pending
priority: P1
effort: 2h
branch: develop
tags: [ocr, heic, image-processing]
created: 2026-06-19
---

# Phase 01: HEIC Format Support

## Context Links

- Main Config: `backend/ocr-microservice/app/config.py` (allowed_formats at line 30)
- Image Preprocessing: `backend/ocr-microservice/app/services/image_preprocessing.py`
- Document Processor: `backend/ocr-microservice/app/services/document_processor.py:99-150`
- Python Pillow Docs: https://pillow.readthedocs.io/en/stable/

## Overview

**Priority:** P1
**Status:** pending
**Description:** Enable OCR processing of HEIC (High Efficiency Image Container) format images, which is the default format for iOS devices. Currently only jpg, jpeg, png, pdf are supported.

## Key Insights

1. **HEIC Challenge**: HEIC is not natively supported by OpenCV; requires conversion to JPEG/PNG first
2. **Two Library Options**:
   - `pillow-heif`: Pillow plugin, minimal code changes
   - `pyheif`: Standalone, more control but more code
   - **Decision**: Use `pillow-heif` for simplicity and Pillow integration
3. **Image Size**: HEIC files can be larger; maintain 10MB max size limit
4. **iOS Impact**: Mobile users (iPad/iPhone) can upload camera photos directly without format conversion

## Requirements

### Functional Requirements
1. Accept .heic files via API endpoints
2. Convert HEIC to JPEG internally
3. Apply existing preprocessing pipeline after conversion
4. Maintain existing OCR accuracy (no degradation)

### Non-Functional Requirements
1. Conversion time < 500ms per image
2. No quality loss > 5% compared to original HEIC
3. Memory usage increase < 50MB per processed image
4. Error handling with user-friendly messages

## Architecture

### Data Flow

```
┌─────────────┐
│  HEIC Image │ ← iOS device upload
└──────┬──────┘
       │ POST /ocr/image
       ▼
┌──────────────────────────┐
│ DocumentProcessor         │
│  - Detect HEIC format    │
│  - Convert to JPEG       │ ← NEW STEP
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ ImagePreprocessor        │
│  - Grayscale conversion  │
│  - CLAHE enhancement     │
│  - Line removal          │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ OCR Service              │
│  - Text extraction       │
└──────────────────────────┘
```

### Component Changes

| Component | Change | Impact |
|-----------|--------|--------|
| `config.py` | Add `heic` to allowed_formats | 1 line |
| `requirements.txt` | Add `pillow-heif` | 1 line |
| `document_processor.py` | Add HEIC conversion in `process_image()` | ~20 lines |
| `image_preprocessing.py` | No changes | - |

## Related Code Files

### To Modify

**1. `backend/ocr-microservice/app/config.py`**
- Line 30: `image_allowed_formats: str = "jpg,jpeg,png,pdf"`
- Change to: `"jpg,jpeg,png,pdf,heic"`

**2. `backend/ocr-microservice/requirements.txt`**
- Add: `pillow-heif==0.13.0`

**3. `backend/ocr-microservice/app/services/document_processor.py`**
- Line 99-150: `process_image()` method
- Add HEIC conversion logic between file read and numpy conversion
- Import: `from pillow_heif import register_heif_opener`

### No Changes Needed
- `app/services/image_preprocessing.py` - Works with any PIL Image
- `app/services/ocr_service.py` - Works with numpy arrays
- `app/services/validation_service.py` - No image processing

## Implementation Steps

1. **Add Dependency**
   - Update `requirements.txt` with `pillow-heif==0.13.0`
   - Install: `pip install pillow-heif==0.13.0`

2. **Register HEIC Support**
   - Add to `document_processor.py` imports:
     ```python
     from pillow_heif import register_heif_opener
     register_heif_opener()
     ```

3. **Update Config**
   - Modify `config.py` line 30 to include "heic"

4. **Update Document Processor**
   - In `process_image()` method, after PIL Image open, check format
   - If HEIC detected, convert to RGB JPEG
   - Log conversion metadata

5. **Add Validation**
   - Validate file extension before processing
   - Return clear error if HEIC conversion fails

6. **Test Conversion**
   - Verify HEIC → JPEG conversion quality
   - Measure conversion time
   - Test with real iOS screenshots

## Todo List

- [ ] Add `pillow-heif==0.13.0` to requirements.txt
- [ ] Update `config.py` allowed_formats
- [ ] Add HEIC import and registration to document_processor.py
- [ ] Implement HEIC conversion logic
- [ ] Add error handling for failed conversions
- [ ] Log conversion metadata
- [ ] Test with sample HEIC files
- [ ] Measure conversion time baseline
- [ ] Verify OCR accuracy after conversion

## Success Criteria

1. HEIC files upload without format errors
2. OCR results from HEIC match JPEG reference (>=95% similarity)
3. Conversion time < 500ms for 5MB HEIC
4. Memory usage increase < 50MB per image
5. No regressions in existing format support

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| pillow-heif incompatible with Python 3.14 | Low | High | Test early, fallback to pyheif if needed |
| HEIC conversion artifacts affect OCR accuracy | Medium | Medium | Use high-quality JPEG (95%), verify with test images |
| Large HEIC files exceed memory limits | Low | Medium | Validate file size before conversion, maintain 10MB limit |
| iOS HEIC format variations not supported | Low | Low | Test with different iOS versions, apple-heic spec compliance |

## Security Considerations

1. **File Validation**: Ensure HEIC file structure is valid before processing
2. **Memory Safety**: Enforce max file size to prevent OOM attacks
3. **Conversion Safety**: Handle malformed HEIC files gracefully

## Rollback Plan

1. Remove `pillow-heif` from requirements.txt
2. Revert `config.py` line 30 to original
3. Remove HEIC conversion code from document_processor.py
4. All existing formats continue to work

## Next Steps

After Phase 01 completion:
- Proceed to Phase 02: CIF/NIF Recognition (uses same image preprocessing)
- HEIC format enables mobile users to test Phase 02 features

---

**Dependencies:** None (first phase)
**Blocked by:** None
**Blocks:** Phase 02 (not strictly, but Phase 02 benefits from HEIC support)