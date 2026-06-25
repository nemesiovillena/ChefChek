---
title: "Albaran Data Flow"
description: "Persistent albaran document model with line-level product matching, status workflow, and stock entry"
status: pending
priority: P1
effort: 18h
branch: develop
tags: [albaran, ingesta, product-matching, stock, fullstack]
created: 2026-06-22
---

# Albaran Data Flow — Implementation Plan

## Overview

Replace the current transient OCR→product pipeline with a **persistent albaran model** that stores delivery notes, their lines, and supports a review-then-confirm workflow before stock entry.

**Current flow (transient):** Upload → OCR → auto-create products + stock (no review, no traceability)
**New flow (persistent):** Upload → OCR → create Albaran(PENDIENTE) → user reviews lines → confirm → stock entry

### Phase Summary

| Phase | Description | Effort | Depends On |
|-------|-------------|--------|------------|
| 1 | Schema: Albaran + AlbaranLine models | 2h | — |
| 2 | Backend: Albaran CRUD + status endpoints | 3h | Phase 1 |
| 3 | Backend: Supplier matching + CIF/NIF | 2h | Phase 1 |
| 4 | Backend: Product matching per line | 2h | Phase 1 |
| 5 | Backend: Stock entry on confirmation | 2h | Phase 2 |
| 6 | Frontend: Albaran list + detail pages | 3h | Phase 2 |
| 7 | Frontend: Line review + matching workflow | 3h | Phase 4, 6 |
| 8 | Integration: end-to-end + migration | 1h | All |

**Total: ~18h**

---

## Data Flow

```
Upload (image/PDF)
  ↓
Python OCR Service (existing)
  ↓
POST /api/v1/albaranes/from-upload
  → Create Albaran(PENDIENTE) + AlbaranLines
  → Auto-match supplier (CIF/NIF → fuzzy name)
  → Auto-match products per line (confidence thresholds)
  → Return albaran with lines + match suggestions
  ↓
GET /api/v1/albaranes (list, filter by supplier/status)
  ↓
GET /api/v1/albaranes/:id (detail with lines)
  ↓
PUT /api/v1/albaranes/:id/lines/:lineId (user edits/reassigns product)
PUT /api/v1/albaranes/:id/supplier (user confirms/reassigns supplier)
  ↓
PUT /api/v1/albaranes/:id/status → REVISADO
  (all lines have match status != NUEVO or user confirmed)
  ↓
PUT /api/v1/albaranes/:id/status → CONFIRMADO
  → Create StockMovements(ENTRANCE) for each confirmed line
  → Update Product prices where matched
  → Update Stock quantities
  → Set Albaran status = CONFIRMADO
  ↓
PUT /api/v1/albaranes/:id/status → ARCHIVADO
  (no side effects, just archival)
```

---

## Phase 1: Schema — Albaran + AlbaranLine

**Priority:** P1 | **Effort:** 2h | **Status:** pending

### Key Insights

- Current `Document` + `ExtractedProduct` models are too generic; albaran needs structured line data (article number, lot, VAT%, line amount, match status)
- Supplier model lacks CIF/NIF — must add for auto-matching
- All models must have `tenantId` for multi-tenant isolation
- `AlbaranLine.matchStatus` and `AlbaranLine.lineStatus` are orthogonal: matchStatus = "did we find the product?", lineStatus = "did the user accept this line?"

### Schema Changes

**File:** `backend/prisma/schema.prisma`

Add to `Tenant` model relations:
```prisma
albaranes          Albaran[]
```

New enum:
```prisma
enum AlbaranStatus {
  PENDIENTE
  REVISADO
  CONFIRMADO
  ARCHIVADO
}

enum LineMatchStatus {
  NUEVO        // confidence < 0.5
  MATCH_ALTO   // confidence >= 0.8, auto-matched
  MATCH_DUDOSO // confidence 0.5-0.8, needs user pick
}

enum LineStatus {
  PENDIENTE
  CONFIRMADO
  RECHAZADO
}
```

New model `Albaran`:
```prisma
model Albaran {
  id              String        @id @default(cuid())
  tenantId        String
  supplierId      String?       // null = no match yet
  albaranNumber   String?       // supplier's albarán reference
  date            DateTime      @default(now())
  base            Float         @default(0)       // base imponible
  vatTotal        Float         @default(0)       // total IVA
  total           Float         @default(0)       // total con IVA
  status          AlbaranStatus @default(PENDIENTE)
  originalFileUrl String?       // URL del archivo original subido
  ocrConfidence   Float         @default(0)       // 0-1 confianza global OCR
  ocrRawData      Json?         // respuesta cruda del OCR
  notes           String?
  createdBy       String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  tenant    Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  supplier  Supplier?      @relation(fields: [supplierId], references: [id], onDelete: SetNull)
  lines     AlbaranLine[]

  @@index([tenantId])
  @@index([supplierId])
  @@index([status])
  @@index([date])
  @@map("albaranes")
}
```

New model `AlbaranLine`:
```prisma
model AlbaranLine {
  id             String          @id @default(cuid())
  albaranId      String
  articleNumber  String?         // supplier's article code
  lot            String?
  description    String
  quantity       Float
  unit           String          @default("ud")
  unitPrice      Float
  vatPercent     Float           @default(10)
  lineAmount     Float           // quantity * unitPrice (pre-VAT)
  matchStatus    LineMatchStatus @default(NUEVO)
  lineStatus     LineStatus      @default(PENDIENTE)
  matchedProductId String?       // FK to Product if matched
  confidence     Float           @default(0)    // 0-1 match confidence
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  albaran        Albaran         @relation(fields: [albaranId], references: [id], onDelete: Cascade)
  matchedProduct Product?        @relation(fields: [matchedProductId], references: [id], onDelete: SetNull)

  @@index([albaranId])
  @@index([matchedProductId])
  @@index([matchStatus])
  @@map("albaran_lines")
}
```

Add to `Supplier` model:
```prisma
cifNif    String?   // CIF/NIF for auto-matching
```

Add to `Supplier` relations:
```prisma
albaranes Albaran[]
```

Add to `Product` relations:
```prisma
albaranLines AlbaranLine[]
```

### Migration

```bash
npx prisma migrate dev --name add_albaran_models
```

### Success Criteria

- `npx prisma generate` succeeds
- All new indexes exist
- Tenant cascade delete removes albaranes
- AlbaranLine cascade-deletes with Albaran

### Risk

| Risk | L×I | Mitigation |
|------|-----|------------|
| Migration fails on existing DB | L×H | Test on staging first; migration is additive only (no column changes) |
| Large existing Document rows | L×L | New models don't touch Document; coexist during migration |

### Rollback

- `npx prisma migrate resolve --rolled-back <migration_name>`
- Remove new models from schema, re-generate

---

## Phase 2: Backend — Albaran CRUD + Status Endpoints

**Priority:** P1 | **Effort:** 3h | **Depends On:** Phase 1 | **Status:** pending

### Key Insights

- Reuse existing `req.tenantId` pattern from `products.controller.ts:55`
- Use `AuthGuard + TenantGuard` on all endpoints
- Status transitions are: PENDIENTE → REVISADO → CONFIRMADO → ARCHIVADO (forward only)
- REVISADO requires all lines have `lineStatus != PENDIENTE` (at least CONFIRMADO or RECHAZADO)
- CONFIRMADO triggers stock entry (Phase 5)

### New Files

| File | Purpose | Lines est. |
|------|---------|------------|
| `src/modules/albaranes/albaranes.module.ts` | Module definition | ~30 |
| `src/modules/albaranes/albaranes.controller.ts` | REST endpoints | ~120 |
| `src/modules/albaranes/albaranes.service.ts` | Business logic | ~180 |
| `src/modules/albaranes/dto/create-albaran.dto.ts` | Create/upload DTO | ~60 |
| `src/modules/albaranes/dto/update-albaran.dto.ts` | Update/status DTOs | ~40 |
| `src/modules/albaranes/dto/albaran-response.dto.ts` | Response shapes | ~50 |
| `src/modules/albaranes/albaranes.controller.spec.ts` | Controller tests | ~80 |
| `src/modules/albaranes/albaranes.service.spec.ts` | Service tests | ~120 |

### Endpoints

```
POST   /api/v1/albaranes/from-upload    → Upload + OCR + create albaran
POST   /api/v1/albaranes/manual         → Manual albaran creation
GET    /api/v1/albaranes                → List (filter: supplierId, status, dateRange)
GET    /api/v1/albaranes/:id            → Detail with lines + matched products
PUT    /api/v1/albaranes/:id            → Update header (supplier, date, notes)
PUT    /api/v1/albaranes/:id/status     → Transition status (with validation)
PUT    /api/v1/albaranes/:id/lines/:lineId → Update single line (match, status, product)
POST   /api/v1/albaranes/:id/lines/:lineId/match → Assign product match
DELETE /api/v1/albaranes/:id            → Soft delete (only PENDIENTE/REVISADO)
```

### Status Transition Validation

```
PENDIENTE → REVISADO:    all lines have lineStatus in [CONFIRMADO, RECHAZADO]
REVISADO → CONFIRMADO:   all non-rejected lines have matchedProductId set
CONFIRMADO → ARCHIVADO:  no validation needed
```

Attempted backward transitions → 400 BadRequestException.

### Data Flow: `POST /from-upload`

1. Receive files via `FilesInterceptor` (reuse existing pattern from `ingesta.controller.ts:208`)
2. Call `PythonOcrService.processImage()` for each file
3. Parse OCR document → extract supplier info, totals, line items
4. Call supplier matching (Phase 3) for supplier detection
5. Call product matching (Phase 4) for each line
6. Create `Albaran` + `AlbaranLine[]` in a transaction
7. Return full albaran with lines, match suggestions, and confidence

### File Ownership

**This phase owns:** `src/modules/albaranes/**`

### Success Criteria

- All 9 endpoints return correct status codes
- Status transitions enforce rules (backward = 400)
- Tenant isolation: albaran from tenant A not visible to tenant B
- `POST /from-upload` creates albaran with lines from OCR

### Risk

| Risk | L×I | Mitigation |
|------|-----|------------|
| OCR fails mid-upload | M×M | Create albaran as PENDIENTE with partial data; log error on lines that failed |
| Concurrent status updates | L×H | Use Prisma `update` with `where: { id, status: currentStatus }` — fails if stale |

### Rollback

- Delete `src/modules/albaranes/` directory
- Remove module import from `app.module.ts`

---

## Phase 3: Backend — Supplier Matching + CIF/NIF

**Priority:** P2 | **Effort:** 2h | **Depends On:** Phase 1 | **Status:** pending

### Key Insights

- Supplier model currently has NO `cifNif` field — added in Phase 1
- Existing `findOrCreateSupplier()` in `ingesta.service.ts:482` only does name match
- Need 3-tier matching: CIF/NIF exact → name fuzzy → create new
- CIF/NIF is extracted from OCR by `python-ocr.service.ts` (already detects `CIF_NIF_DETECTION`)

### New Files

| File | Purpose | Lines est. |
|------|---------|------------|
| `src/modules/albaranes/services/supplier-matching.service.ts` | Supplier matching logic | ~80 |
| `src/modules/albaranes/services/supplier-matching.service.spec.ts` | Tests | ~60 |

### Matching Logic

```
Input: { cifNif?: string, name?: string, tenantId: string }
Output: { supplierId?: string, matchType: 'CIF_EXACT' | 'NAME_FUZZY' | 'NONE', suggestions: Supplier[] }

1. If cifNif provided:
   → SELECT FROM suppliers WHERE tenantId AND cifNif = input (case-insensitive)
   → If found: return { supplierId, matchType: 'CIF_EXACT', suggestions: [] }

2. If name provided:
   → SELECT FROM suppliers WHERE tenantId AND name ILIKE %name%
   → Rank by Levenshtein similarity (reuse from product-recognition.service.ts:242)
   → If best >= 0.8: return { supplierId, matchType: 'NAME_FUZZY', suggestions: top3 }
   → If best 0.5-0.8: return { supplierId: null, matchType: 'NONE', suggestions: top5 }

3. No match: return { supplierId: null, matchType: 'NONE', suggestions: [] }
```

### Integration Points

- Called from `AlbaranesService.createAlbaranFromUpload()` during OCR processing
- Called from `PUT /albaranes/:id` when user manually assigns supplier
- Reuse `LevenshteinDistance` from `product-recognition.service.ts:255` — extract to shared util

### Refactor: Extract shared similarity util

| File | Purpose |
|------|---------|
| `src/common/utils/string-similarity.ts` | `levenshteinDistance()`, `calculateSimilarity()` |

Move the two private methods from `product-recognition.service.ts:242-281` to this shared file. Update `product-recognition.service.ts` to import from there.

### File Ownership

**This phase owns:** `src/modules/albaranes/services/supplier-matching.service.ts`, `src/common/utils/string-similarity.ts`

**Touches (refactor):** `src/modules/ingesta/product-recognition.service.ts` (import change only)

### Success Criteria

- CIF exact match returns correct supplier
- Fuzzy name match returns ranked suggestions
- No match returns empty suggestions
- Existing `ProductRecognitionService` still works after refactor

### Risk

| Risk | L×I | Mitigation |
|------|-----|------------|
| CIF/NIF OCR extraction unreliable | M×M | Fallback to name matching; CIF is best-effort |
| Refactor breaks existing recognition | L×H | Run existing `product-recognition.service.spec.ts` after refactor |

### Rollback

- Delete `supplier-matching.service.ts`
- Revert `product-recognition.service.ts` import change
- Revert `string-similarity.ts` creation

---

## Phase 4: Backend — Product Matching Per Line

**Priority:** P1 | **Effort:** 2h | **Depends On:** Phase 1 | **Status:** pending

### Key Insights

- Existing `ProductRecognitionService.recognizeProduct()` does exact → fuzzy → AI classification
- Current thresholds: 1.0 (exact), 0.7 (fuzzy) — need to align with spec: 0.8 (MATCH_ALTO), 0.5 (MATCH_DUDOSO)
- Each albaran line gets its own match attempt and matchStatus
- Lines with MATCH_ALTO auto-set `matchedProductId`; MATCH_DUDOSO leaves null for user to pick

### New Files

| File | Purpose | Lines est. |
|------|---------|------------|
| `src/modules/albaranes/services/line-matching.service.ts` | Line-level product matching | ~90 |
| `src/modules/albaranes/services/line-matching.service.spec.ts` | Tests | ~80 |

### Matching Logic

```
Input: { description: string, articleNumber?: string, tenantId: string }
Output: { matchedProductId?: string, matchStatus: LineMatchStatus, confidence: number, suggestions: Product[] }

1. Try articleNumber match:
   → SELECT FROM products WHERE tenantId AND barcode = articleNumber
   → If found: return { matchedProductId, matchStatus: MATCH_ALTO, confidence: 1.0 }

2. Try description match via ProductRecognitionService.recognizeProduct():
   → confidence >= 0.8: matchStatus = MATCH_ALTO, auto-assign matchedProductId
   → confidence 0.5-0.8: matchStatus = MATCH_DUDOSO, return top5 suggestions, matchedProductId = null
   → confidence < 0.5: matchStatus = NUEVO, suggestions = [], matchedProductId = null
```

### `POST /albaranes/:id/lines/:lineId/match`

User picks a product for a MATCH_DUDOSO or NUEVO line:
- Sets `matchedProductId` on the line
- Sets `matchStatus = MATCH_ALTO` (user-confirmed = high confidence)
- Sets `confidence = 1.0` (human override)

### Integration Points

- Called from `AlbaranesService.createAlbaranFromUpload()` for each OCR line
- Called from `PUT /albaranes/:id/lines/:lineId` when user reassigns product
- Delegates to existing `ProductRecognitionService` for actual matching

### File Ownership

**This phase owns:** `src/modules/albaranes/services/line-matching.service.ts`

### Success Criteria

- High-confidence matches auto-assign product
- Doubtful matches return suggestions without auto-assigning
- New products have no match
- User override sets MATCH_ALTO + confidence 1.0
- Article number barcode match works

### Risk

| Risk | L×I | Mitigation |
|------|-----|------------|
| ProductRecognitionService returns inconsistent confidence | M×M | Clamp confidence to [0,1]; log anomalies |
| Large product catalogs slow down matching | L×M | Add DB index on `barcode`; limit fuzzy search with `take: 10` |

### Rollback

- Delete `line-matching.service.ts`
- Albaranes created with matching still have their lines; just no new matching runs

---

## Phase 5: Backend — Stock Entry on Confirmation

**Priority:** P1 | **Effort:** 2h | **Depends On:** Phase 2 | **Status:** pending

### Key Insights

- Stock entry ONLY happens when albaran transitions to CONFIRMADO — never automatic
- Current `processManualAlbaran()` in `ingesta.service.ts:754` already does: create product → stock movement → update stock. Reuse pattern.
- Need to also update `Product.purchasePrice` for matched lines (price from albaran)
- `StockMovement` already exists with `type: ENTRANCE` and `reason` field
- `Stock` model has `unique([productId, warehouseId])` — need to handle upsert

### New Files

| File | Purpose | Lines est. |
|------|---------|------------|
| `src/modules/albaranes/services/albaran-stock.service.ts` | Stock entry logic | ~100 |
| `src/modules/albaranes/services/albaran-stock.service.spec.ts` | Tests | ~80 |

### Confirmation Logic (`REVISADO → CONFIRMADO`)

Transaction:
```
For each line WHERE lineStatus = CONFIRMADO AND matchedProductId IS NOT NULL:
  1. Update Product.purchasePrice = line.unitPrice (if different)
     Save previousPurchasePrice
  2. Create StockMovement:
     { productId, type: 'ENTRANCE', quantity, unit, reason: `Entrada desde albarán ${albaranNumber}` }
  3. Upsert Stock:
     - If exists: quantity += line.quantity
     - If not: create with quantity = line.quantity

For each line WHERE lineStatus = CONFIRMADO AND matchedProductId IS NULL (NUEVO):
  → Create new Product (name=description, purchasePrice=line.unitPrice, supplierId=albaran.supplierId)
  → Then same stock entry as above
  → Set line.matchedProductId = new product id
  → Set line.matchStatus = MATCH_ALTO

Set albaran.status = CONFIRMADO
```

### Integration Points

- Called from `AlbaranesService.updateStatus()` when transitioning to CONFIRMADO
- Uses `WarehousesService` for stock movement creation? No — direct Prisma to avoid circular deps. AlbaranStockService does its own Prisma calls.
- Notifies on significant price changes (>10%) — reuse `NotificationsService` pattern from `ingesta.service.ts:439`

### File Ownership

**This phase owns:** `src/modules/albaranes/services/albaran-stock.service.ts`

### Success Criteria

- Stock movements created for all CONFIRMADO lines
- Products with price changes get `previousPurchasePrice` updated
- New products created for NUEVO + CONFIRMADO lines
- Stock quantities incremented correctly
- Idempotency: calling confirm twice does not duplicate movements

### Risk

| Risk | L×I | Mitigation |
|------|-----|------------|
| Confirmation fails mid-transaction | L×H | Wrap entire confirmation in Prisma `$transaction`; if any step fails, nothing is committed |
| Race condition on stock update | L×M | Prisma `update` with `quantity: { increment: lineQuantity }` — atomic |
| Duplicate stock movements | M×H | Check `albaran.status` before creating movements; only CONFIRMADO from REVISADO creates movements |

### Rollback

- If confirmation fails: transaction rolls back automatically
- Manual rollback: delete StockMovements with reason containing albaran ID, revert stock quantities, set albaran back to REVISADO

---

## Phase 6: Frontend — Albaran List + Detail Pages

**Priority:** P1 | **Effort:** 3h | **Depends On:** Phase 2 | **Status:** pending

### Key Insights

- Dashboard routes use Next.js App Router at `frontend/src/app/dashboard/`
- Code standards require URL-based tabs, not `useState`
- Content width must be consistent across app
- Existing ingestion page at `dashboard/ingestion/` will be refactored

### New Files

| File | Purpose | Lines est. |
|------|---------|------------|
| `frontend/src/app/dashboard/albaranes/page.tsx` | Albaran list | ~120 |
| `frontend/src/app/dashboard/albaranes/[id]/page.tsx` | Albaran detail | ~150 |
| `frontend/src/app/dashboard/albaranes/[id]/layout.tsx` | Detail layout with tabs | ~60 |
| `frontend/src/app/dashboard/albaranes/[id]/lineas/page.tsx` | Lines tab | ~150 |
| `frontend/src/app/dashboard/albaranes/[id]/resumen/page.tsx` | Summary tab | ~80 |
| `frontend/src/hooks/use-albaranes.ts` | Data fetching hook | ~100 |
| `frontend/src/hooks/use-albaran-detail.ts` | Single albaran hook | ~80 |
| `frontend/src/lib/api-albaran.ts` | API client for albaranes | ~60 |
| `frontend/src/components/albaranes/albaran-card.tsx` | List card component | ~50 |
| `frontend/src/components/albaranes/albaran-status-badge.tsx` | Status badge | ~30 |
| `frontend/src/components/albaranes/line-match-badge.tsx` | Match status badge | ~30 |

### Pages

**`/dashboard/albaranes`** — List
- Filter by: supplier, status (PENDIENTE/REVISADO/CONFIRMADO/ARCHIVADO), date range
- Cards showing: supplier name, albaran number, date, total, status badge, line count
- "Nuevo albarán" button → opens upload modal or manual form
- Sort by date desc

**`/dashboard/albaranes/[id]/resumen`** — Summary tab (default)
- Header: supplier, date, totals, OCR confidence
- Status transition buttons (valid transitions only)
- File preview link if originalFileUrl exists

**`/dashboard/albaranes/[id]/lineas`** — Lines tab
- Table: description, qty, unit, unit price, VAT%, line amount, match badge, line status
- Click row → expand or open match editor
- Bulk actions: confirm all matched, reject selected

### Refactor: Existing Ingestion Page

- `dashboard/ingestion/page.tsx` — keep as quick-upload shortcut
- After upload succeeds, redirect to `/dashboard/albaranes/[newId]/lineas`
- `useAlbaranUpload` hook: modify `processFiles()` to call new `POST /albaranes/from-upload` and return albaran ID

### File Ownership

**This phase owns:** `frontend/src/app/dashboard/albaranes/**`, `frontend/src/components/albaranes/**`, `frontend/src/hooks/use-albaranes.ts`, `frontend/src/hooks/use-albaran-detail.ts`, `frontend/src/lib/api-albaran.ts`

**Touches (refactor):** `frontend/src/hooks/use-albaran-upload.ts`, `frontend/src/app/dashboard/ingestion/page.tsx`

### Success Criteria

- List page loads albaranes with filters
- Detail page shows tabs with URL-based routing
- Status badges show correct colors
- Upload from ingestion page redirects to new albaran detail

### Risk

| Risk | L×I | Mitigation |
|------|-----|------------|
| Large albaran lists slow render | M×L | Paginate (reuse existing query pattern with page/limit) |
| Upload redirect breaks existing flow | M×M | Feature flag: if new albaran module not available, fall back to old import flow |

### Rollback

- Delete `dashboard/albaranes/` directory
- Revert `use-albaran-upload.ts` changes
- Old ingestion page still works independently

---

## Phase 7: Frontend — Line Review + Matching Workflow

**Priority:** P1 | **Effort:** 3h | **Depends On:** Phase 4, Phase 6 | **Status:** pending

### Key Insights

- MATCH_DUDOSO lines need a product picker (search + select from existing products)
- NUEVO lines need a "create product" flow
- User can edit line fields (quantity, price) before confirming
- Confirm all = batch update lines to CONFIRMADO

### New Files

| File | Purpose | Lines est. |
|------|---------|------------|
| `frontend/src/components/albaranes/line-review-row.tsx` | Expandable line row | ~120 |
| `frontend/src/components/albaranes/product-picker-dialog.tsx` | Product search & select | ~100 |
| `frontend/src/components/albaranes/create-product-inline.tsx` | Quick create product | ~100 |
| `frontend/src/components/albaranes/supplier-picker-dialog.tsx` | Supplier search & assign | ~80 |
| `frontend/src/components/albaranes/line-actions-toolbar.tsx` | Bulk confirm/reject | ~60 |
| `frontend/src/hooks/use-product-search.ts` | Product search hook | ~50 |
| `frontend/src/hooks/use-supplier-search.ts` | Supplier search hook | ~50 |

### Line Review Row States

| matchStatus | lineStatus | UI |
|-------------|------------|-----|
| MATCH_ALTO | PENDIENTE | Green badge "Auto-matché", product name shown, Confirm/Reject buttons |
| MATCH_DUDOSO | PENDIENTE | Yellow badge "Dudoso", "Elegir producto" button, Confirm/Reject |
| NUEVO | PENDIENTE | Red badge "Nuevo", "Crear producto" button, Confirm/Reject |
| MATCH_ALTO | CONFIRMADO | Green check, locked |
| * | RECHAZADO | Gray strikethrough, locked |

### Product Picker Dialog

- Search input → calls `GET /api/v1/products?search=`
- Shows name, supplier, current price, category
- On select → calls `POST /albaranes/:id/lines/:lineId/match`

### Supplier Picker Dialog

- Used in albaran summary when supplier is unassigned or wrong
- Search → calls existing supplier endpoint
- On select → calls `PUT /albaranes/:id` with new supplierId

### File Ownership

**This phase owns:** All files listed above

### Success Criteria

- MATCH_ALTO lines show auto-matched product with confirm option
- MATCH_DUDOSO lines show product picker
- NUEVO lines show inline create product form
- Bulk confirm/reject works
- Supplier reassignment works

### Risk

| Risk | L×I | Mitigation |
|------|-----|------------|
| Product search slow on large catalogs | M×L | Debounce search (300ms), limit results to 20 |
| Inline product creation incomplete | M×M | Minimal form: name, price, unit, category. Full edit later on product page |

### Rollback

- Delete component files
- Lines table falls back to read-only (no editing)

---

## Phase 8: Integration — End-to-End + Migration Path

**Priority:** P1 | **Effort:** 1h | **Depends On:** All | **Status:** pending

### Migration Path for Existing Data

1. Existing `Document` records with `type = 'DELIVERY_NOTE'` remain untouched
2. Existing `ExtractedProduct` records remain untouched
3. New `Albaran` + `AlbaranLine` tables are empty — no data migration needed
4. Old `processForStock` endpoint remains functional for backward compat
5. Old `processManualAlbaran` endpoint remains functional
6. New albaran endpoints are the recommended path going forward

### Backward Compatibility

| Old Endpoint | Status | New Endpoint |
|-------------|--------|-------------|
| `POST /ingesta/process-for-stock` | Keep (deprecated) | `POST /albaranes/from-upload` |
| `POST /ingesta/manual` | Keep (deprecated) | `POST /albaranes/manual` |
| `GET /ingesta/documents` | Keep | `GET /albaranes` |
| `GET /ingesta/documents/:id` | Keep | `GET /albaranes/:id` |

### End-to-End Test Scenarios

1. Upload image → albaran created PENDIENTE → review lines → confirm → stock updated
2. Manual albaran → match products → confirm → stock updated
3. Doubtful match → user picks product → confirm line → stock updated
4. New product line → create product inline → confirm → stock updated
5. Reject lines → confirm albaran → only non-rejected lines create stock
6. Attempt backward status transition → 400 error
7. Tenant A cannot see tenant B's albaranes
8. Duplicate confirmation → idempotent (no duplicate stock movements)

### File Ownership

**This phase owns:** Test files only

### Success Criteria

- All 8 e2e scenarios pass
- Old endpoints still return 200
- New endpoints handle all match scenarios

### Risk

| Risk | L×I | Mitigation |
|------|-----|------------|
| Old frontend still calls deprecated endpoints | M×M | Keep old endpoints working; frontend migration in Phase 6/7 |
| Performance regression on upload | L×M | Measure OCR→albaran creation time; should be same as current processForStock |

### Rollback

- Remove albaran routes from frontend navigation
- All old endpoints continue working
- New albaran data in DB is harmless (just unused)

---

## Dependency Graph

```
Phase 1 (Schema)
├── Phase 2 (CRUD) ──→ Phase 5 (Stock) ──→ Phase 8 (Integration)
├── Phase 3 (Supplier Match) ──────────────→ Phase 8
├── Phase 4 (Line Match) ──→ Phase 7 (FE Review)
│                                      ↑
└── Phase 2 ──→ Phase 6 (FE Pages) ───┘──→ Phase 8
```

**Parallelizable:** Phases 3, 4 can run in parallel (both depend only on Phase 1)
**Parallelizable:** Phases 5, 6 can run in parallel (both depend on Phase 2)

---

## Test Matrix

| Layer | What | How |
|-------|------|-----|
| Unit | Supplier matching (CIF, fuzzy, none) | Jest + mock Prisma |
| Unit | Line matching (high, doubtful, new) | Jest + mock ProductRecognitionService |
| Unit | Status transitions (valid/invalid) | Jest + mock Prisma |
| Unit | Stock entry logic (confirm, idempotent) | Jest + mock Prisma |
| Integration | CRUD endpoints with real DB | Supertest + test DB |
| Integration | Upload → OCR → albaran creation | Supertest + mock Python OCR |
| E2E | Full workflow from upload to stock | Playwright or manual |
| E2E | Tenant isolation | API calls with different tenants |

---

## File Ownership Summary

| Phase | Owns | Touches (refactor only) |
|-------|------|------------------------|
| 1 | `prisma/schema.prisma` | — |
| 2 | `src/modules/albaranes/**` (controller, service, DTOs) | `src/app.module.ts` (import) |
| 3 | `src/modules/albaranes/services/supplier-matching.service.ts`, `src/common/utils/string-similarity.ts` | `src/modules/ingesta/product-recognition.service.ts` (import) |
| 4 | `src/modules/albaranes/services/line-matching.service.ts` | — |
| 5 | `src/modules/albaranes/services/albaran-stock.service.ts` | — |
| 6 | `frontend/src/app/dashboard/albaranes/**`, `frontend/src/lib/api-albaran.ts`, `frontend/src/hooks/use-albaranes.ts`, `frontend/src/hooks/use-albaran-detail.ts` | `frontend/src/hooks/use-albaran-upload.ts`, `frontend/src/app/dashboard/ingestion/page.tsx` |
| 7 | `frontend/src/components/albaranes/**`, `frontend/src/hooks/use-product-search.ts`, `frontend/src/hooks/use-supplier-search.ts` | — |
| 8 | Test files | — |

No two parallel phases touch the same files.

---

## Unresolved Questions

1. **Warehouse assignment:** When confirming an albaran, which warehouse does stock go into? Options: (a) default warehouse per tenant, (b) user selects during confirmation, (c) first warehouse. Recommend (b) with fallback to (c).
2. **Albaran numbering:** Should albaran numbers be auto-generated or always from the supplier's document? Current spec says `albaranNumber` is optional. If auto-generated, need a sequence per tenant.
3. **Partial OCR failure:** If OCR extracts 8 of 10 lines, should the albaran still be created with 8 lines + a note? Recommend yes, with `ocrConfidence` reflecting the gap.
4. **Product price update strategy:** When a matched line has a different price than the current `Product.purchasePrice`, should we always update? Current code updates always. Recommend keeping this behavior but with notification on >10% change.
5. **CIF/NIF on Supplier model:** Adding `cifNif` to Supplier is a breaking schema change. Existing suppliers will have null. Need to decide if CIF/NIF should be required going forward or optional.
