# OCR Diagnostic Report

## Date
2026-06-19

## Summary
OCR functionality is partially working but produces very poor quality results (<30% confidence) on real albaran images, though it works well on simple test images (93% confidence).

## Root Cause Analysis

### Issue 1: EasyOCR Installation Status
**Status**: CRITICAL ISSUE

The Python OCR microservice is running but has inconsistent EasyOCR installation:
- The service is using Python 3.14 with `python_env/` venv
- The `python_env/` venv is nearly empty (only pip and wheel installed)
- EasyOCR models and dependencies appear to be missing or corrupted

**Evidence**:
```
$ /opt/homebrew/Cellar/python@3.14/3.14.2_1/Frameworks/Python.framework/Versions/3.14/Resources/Python.app/Contents/MacOS/Python /Users/nemesioj/Documents/Trabajos offline/ChefChek/chefchek/backend/ocr-microservice/python_env/bin/pip3 list
Package Version
------- -------
pip     25.3
wheel   0.46.3
```

### Issue 2: OCR Quality on Real Images
**Status**: CRITICAL

When processing real albaran images:
- Confidence: 20-28%
- Output: Gibberish text (e.g., "INombu", "Miehu", "sluekkr")
- Products: Incorrectly extracted with random names

**Example from user_albaran3.png**:
```
Confidence: 19.9%
Products extracted:
1. INombu | 11.0 ud | €1.00 | confidence: 18.3%
2. INomnbnda | 1.0 ud | €1.00 | confidence: 15.8%
3. Luihl+o | 1.0 ud | €2.00 | confidence: 13.3%
```

### Issue 3: Preprocessing Over-aggressive
**Status**: MODERATE

The image preprocessing pipeline applies several aggressive transformations:
1. Grayscale conversion
2. CLAHE enhancement
3. Vertical line removal
4. Dilation (2x2 kernel, 1 iteration)
5. Adaptive binarization (31 block size)

For some images, this may be degrading quality rather than improving it.

## Architecture Analysis

### Data Flow
```
Frontend (albaran-upload-drawer.tsx)
    ↓ POST /api/v1/ingesta/process-for-stock
Backend (ingesta.controller.ts)
    ↓ pythonOcrService.processImage()
Python OCR Microservice (localhost:8000/ocr/image)
    ↓ DocumentProcessor.process_image()
    ↓ ImagePreprocessor.preprocess_image()
    ↓ OCRService.process_image() [EasyOCR]
    ↓ DocumentProcessor._extract_structured_data()
    ↓ DocumentProcessor._extract_products()
    ↓ ValidationService.validate_document()
Backend Response → Frontend
```

### Key Files
- `backend/src/modules/ingesta/python-ocr.service.ts` - NestJS OCR client
- `backend/src/modules/ingesta/ingesta.controller.ts` - OCR endpoint
- `backend/ocr-microservice/app/main.py` - FastAPI service
- `backend/ocr-microservice/app/services/ocr_service.py` - EasyOCR wrapper
- `backend/ocr-microservice/app/services/document_processor.py` - Product extraction
- `backend/ocr-microservice/app/services/image_preprocessing.py` - Image preprocessing
- `frontend/src/app/dashboard/articulos/components/albaran-upload-drawer.tsx` - UI

## Diagnosis Results

### Working
- Python OCR service is running and responding to requests
- Simple test images work well (93% confidence)
- Frontend integration is correct
- Backend endpoint is functional
- Validation logic works (rejects low confidence results)

### Not Working
- Real albaran images produce garbage results
- EasyOCR models appear corrupted or missing
- Low confidence (<30%) causes products to be rejected by validation
- Product extraction patterns don't match real albaran formats

## Specific Issues

### Issue A: Missing EasyOCR Dependencies
The service cannot access EasyOCR language models properly. This explains why the OCR produces gibberish - it's likely using corrupted or incomplete models.

### Issue B: Validation Too Strict
Validation requires 70% confidence threshold (`ocr_confidence_threshold = 0.7`), but real images produce only 20-30% confidence.

### Issue C: Product Extraction Patterns
The product extraction in `document_processor.py` uses multi-line patterns that don't match real albaran formats.

## Recommended Fixes

### Fix 1: Reinstall EasyOCR and Models (HIGH PRIORITY)
```bash
cd backend/ocr-microservice
python_env/bin/pip3 install --upgrade easyocr==1.7.1
python_env/bin/pip3 install --upgrade opencv-python-headless==4.8.1.78
python_env/bin/pip3 install --upgrade numpy==1.24.3
python_env/bin/pip3 install --upgrade pillow==10.1.0
python_env/bin/pip3 install --upgrade pdf2image==1.16.3
```

Then verify:
```bash
python_env/bin/python3 -c "import easyocr; reader = easyocr.Reader(['es']); print('OK')"
```

### Fix 2: Reduce Validation Threshold (MEDIUM PRIORITY)
In `app/config.py`:
```python
ocr_confidence_threshold: float = 0.3  # Change from 0.7 to 0.3
```

### Fix 3: Test with Better Images
Test OCR with properly scanned, high-resolution albaran images:
- Resolution: 300 DPI or higher
- Format: PNG or uncompressed JPG
- Good lighting and contrast

### Fix 4: Add OCR Debugging
In `app/services/ocr_service.py`, add more detailed logging to show:
- Actual raw OCR text
- Confidence per line
- Whether preprocessing helps or hurts

## Unresolved Questions

1. Why does the service work for `test_albaran.jpg` (93% confidence) but fail for real images?
2. Are the test images using a different preprocessing pipeline?
3. Should we consider using PaddleOCR instead of EasyOCR for better Spanish support?
4. Are there better product extraction patterns for Spanish albaranes?

## Next Steps

1. Reinstall EasyOCR in the correct Python environment
2. Test with fresh language model downloads
3. Reduce confidence threshold to 0.3 for testing
4. Try processing raw (un-preprocessed) images to isolate the issue
5. Consider switching to PaddleOCR which has better Spanish support

## Environment Details

- Python: 3.14 (via Homebrew)
- OCR Service: Running on port 8000
- EasyOCR: 1.7.1 (supposedly, but models corrupted)
- OpenCV: 4.8.1.78
- Backend: NestJS
- Frontend: Next.js 14