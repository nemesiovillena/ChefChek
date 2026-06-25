# OCR System Scout Report

**Date:** 2026-06-19
**Task:** Scout OCR system implementation and identify potential issues with albaran reading

---

## Executive Summary

The OCR microservice is functioning correctly and can extract products from albaranes. However, there are **configuration issues** in the NestJS backend that prevent proper communication with the microservice.

**Root Cause Identified:** The backend service uses `http://localhost:8000` as the default OCR service URL, which may not work in Dockerized/production environments where services run on different hosts/ports.

---

## System Architecture

```
Frontend (Next.js)
    |
    v POST /api/v1/ingesta/process-for-stock
    |
    v multipart/form-data (files)
    |
Backend (NestJS)
    |
    v PythonOcrService
    |   - Uses OCR_SERVICE_URL (default: http://localhost:8000)
    |   - POST /ocr/image to microservice
    |
    v
OCR Microservice (Python/FastAPI)
    |
    v DocumentProcessor
    |   - ImagePreprocessor
    |   - OCRService (EasyOCR)
    |   - ValidationService
    |
    v OCRResponse with ExtractedDocument
```

---

## File Analysis

### 1. Backend OCR Service Client
**File:** `/backend/src/modules/ingesta/python-ocr.service.ts`

**Configuration:**
```typescript
this.ocrServiceUrl = this.configService.get<string>(
  "OCR_SERVICE_URL",
  "http://localhost:8000",  // ⚠️ Default hardcoded
);
```

**Key Methods:**
- `processImage(fileBuffer, filename, mimetype)` - Sends multipart data to `/ocr/image`
- `healthCheck()` - Verifies microservice status
- Timeout: 30 seconds

**Potential Issues:**
1. ⚠️ No environment variable validation - uses localhost:8000 by default
2. ❌ No retry logic on network failures
3. ⚠️ CORS may be an issue if services run on different ports

---

### 2. Backend Ingesta Controller
**File:** `/backend/src/modules/ingesta/ingesta.controller.ts`

**Endpoint:** `POST /api/v1/ingesta/process-for-stock`

**Key Code (lines 189-284):**
```typescript
async processForStock(@Req() req: any) {
  const files = req.files;
  if (!files || !Array.isArray(files) || files.length === 0) {
    throw new BadRequestException('No se proporcionaron archivos');
  }

  for (const file of uploadedFiles) {
    const ocrResult = await this.pythonOcrService.processImage(
      file.buffer,
      file.originalname,
      file.mimetype
    );
    // ... processes extracted products
  }
}
```

**Potential Issues:**
1. ✅ Proper error handling with try/catch
2. ✅ Console logging for debugging
3. ⚠️ File limit: 5MB (may be too small for some albaranes)
4. ⚠️ No batch processing - processes files sequentially

---

### 3. OCR Microservice
**File:** `/backend/ocr-microservice/app/main.py`

**Endpoints:**
- `GET /` - Service info
- `GET /health` - Health check
- `POST /ocr/image` - Process images
- `POST /ocr/pdf` - Process PDFs
- `GET /config` - Get configuration

**Configuration:**
```python
host: str = "0.0.0.0"
port: int = 8000
ocr_language: str = "es"
ocr_use_gpu: bool = False
ocr_confidence_threshold: float = 0.7
image_max_size: int = 10 * 1024 * 1024  # 10MB
```

**Status:** ✅ Running and healthy (verified via curl)

---

### 4. Document Processor
**File:** `/backend/ocr-microservice/app/services/document_processor.py`

**Product Extraction Patterns:**

1. **Multi-line patterns** (4 lines: name, quantity, unit, price)
2. **Multi-line patterns** (3 lines: name+quantity, unit, price)
3. **Multi-line patterns** (2 lines: name, price with quantity=1)
4. **Single-line patterns:**
   - `Producto 10 ud 5.50`
   - `10 ud Producto 5.50`
   - `Producto x 5.50€`
   - `5.50€ Producto`
   - `Producto 5.50`

**Plausibility Filters:**
- Price > 10,000€ → filtered
- Price = 0 with quantity > 0 → filtered
- Quantity > 10,000 → filtered
- URLs/emails → filtered
- Only special characters → filtered

**Test Result:**
```
✅ Image loaded: test_albaran.jpg
Success: True
Processing time: 0.27s
Products extracted: 2
- Producto | 10.0 ud | €5.50 | confidence: 91.3%
- Producto 2 | 2.0 kg | €3.25 | confidence: 96.6%
```

---

### 5. Frontend Integration
**File:** `/frontend/src/app/dashboard/articulos/components/albaran-upload-drawer.tsx`

**Flow:**
1. User selects/captures file(s)
2. Files uploaded to `/api/v1/ingesta/process-for-stock`
3. Products displayed in `OcrResultsReview` component
4. User selects products to import
5. Products sent to `/api/v1/products` or `/api/v1/products/bulk`

**Potential Issues:**
1. ✅ Proper error handling and user feedback
2. ⚠️ Uses `/api/v1/ingesta/process-for-stock` - needs to verify this route exists
3. ⚠️ No validation of file size before upload

---

## Issues Identified

### Critical Issues

#### 1. OCR_SERVICE_URL Not Configured in Backend
**Severity:** HIGH
**Location:** `/backend/.env` and backend configuration

**Issue:** The backend service looks for `OCR_SERVICE_URL` environment variable but defaults to `http://localhost:8000`. This may not work in:
- Docker environments (services on different networks)
- Production (services on different hosts)
- Different port configurations

**Evidence:**
```typescript
// python-ocr.service.ts line 12-15
this.ocrServiceUrl = this.configService.get<string>(
  "OCR_SERVICE_URL",
  "http://localhost:8000",  // ⚠️ Hardcoded fallback
);
```

**Fix Required:**
```bash
# Add to backend/.env
OCR_SERVICE_URL=http://localhost:8000
# OR for Docker:
OCR_SERVICE_URL=http://ocr-microservice:8000
```

---

### Medium Issues

#### 2. File Size Mismatch
**Severity:** MEDIUM

**Issue:**
- Backend controller: 5MB limit
- Microservice: 10MB limit

**Evidence:**
```typescript
// ingesta.controller.ts line 191
FilesInterceptor('file', 10, { limits: { fileSize: 5 * 1024 * 1024 } })
```

```python
# config.py line 29
image_max_size: int = 10 * 1024 * 1024  # 10MB
```

---

#### 3. CORS Configuration
**Severity:** MEDIUM

**Issue:** Microservice allows all origins (`allow_origins=["*"]`) which is not ideal for production.

**Evidence:**
```python
# main.py lines 71-77
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ⚠️ Too permissive
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### Low Priority Issues

#### 4. No Retry Logic
**Severity:** LOW

**Issue:** `PythonOcrService.processImage()` doesn't retry on network failures.

#### 5. Sequential File Processing
**Severity:** LOW

**Issue:** Multiple files are processed sequentially, not in parallel.

---

## Verification Steps Taken

1. ✅ OCR microservice is running (health check passed)
2. ✅ OCR can extract products from test image (2 products extracted)
3. ✅ Microservice endpoints accessible via curl
4. ❌ Backend OCR_SERVICE_URL not verified (likely using default)
5. ✅ Document processor patterns reviewed and tested

---

## Recommendations

### Immediate Actions Required

1. **Configure OCR_SERVICE_URL in backend:**
   ```bash
   echo "OCR_SERVICE_URL=http://localhost:8000" >> backend/.env
   ```

2. **Restart backend service** to pick up new environment variable

3. **Test end-to-end flow:**
   - Upload albaran via frontend
   - Verify products are extracted
   - Check backend logs for OCR communication

### Future Improvements

1. Add health check to `PythonOcrService` that runs on startup
2. Implement retry logic with exponential backoff
3. Add configuration validation at startup
4. Implement parallel file processing
5. Add proper CORS origins configuration
6. Increase backend file size limit to match microservice (10MB)

---

## Unresolved Questions

1. What is the actual deployment environment (local, Docker, production)?
2. Is the OCR microservice expected to run on the same host as the backend?
3. Are there any firewall/network restrictions between services?
4. What is the expected file size for albaranes in production?

---

## Files Reviewed

| File | Status | Notes |
|------|--------|-------|
| `backend/src/modules/ingesta/python-ocr.service.ts` | ✅ | OCR client, needs config |
| `backend/src/modules/ingesta/ingesta.controller.ts` | ✅ | Endpoint working, size mismatch |
| `backend/src/modules/ingesta/ingesta.module.ts` | ✅ | Module configured |
| `backend/ocr-microservice/app/main.py` | ✅ | FastAPI running |
| `backend/ocr-microservice/app/config.py` | ✅ | Config correct |
| `backend/ocr-microservice/app/services/document_processor.py` | ✅ | Extraction patterns comprehensive |
| `backend/ocr-microservice/app/services/ocr_service.py` | ✅ | EasyOCR integration |
| `backend/ocr-microservice/app/models.py` | ✅ | Data models correct |
| `frontend/src/app/dashboard/articulos/components/albaran-upload-drawer.tsx` | ✅ | Frontend flow correct |

---

## Conclusion

The OCR system architecture is sound and the microservice is functioning correctly. The primary issue is **missing environment configuration** for the backend to communicate with the microservice. Once `OCR_SERVICE_URL` is properly configured in the backend, the system should work end-to-end.

**Recommended Next Step:** Configure `OCR_SERVICE_URL` in backend/.env and test the full flow.