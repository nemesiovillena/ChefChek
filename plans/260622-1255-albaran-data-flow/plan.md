---
title: "Albaran Data Flow"
description: "Persistent albaran model with line-level product matching, status workflow, and stock entry"
status: completed
priority: P1
effort: 18h
branch: develop
tags: [albaran, ingesta, product-matching, stock, fullstack]
created: 2026-06-22
---

# Albaran Data Flow — Implementation Tracker

## Overview

Replace transient OCR→product pipeline with a persistent albaran model: upload → OCR → create Albaran(PENDIENTE) → user reviews lines → confirm → stock entry.

## Phase Checklist

| # | Phase | Status | Effort | Depends On | Key Files |
|---|-------|--------|--------|------------|-----------|
| 1 | Schema: Albaran + AlbaranLine models | ✅ Done | 2h | — | `prisma/schema.prisma` |
| 2 | Backend: Albaran CRUD + status endpoints | ✅ Done | 3h | Phase 1 | `src/modules/albaranes/albaranes.{controller,service,module}.ts`, `services/albaran-{status,number}.service.ts`, `dto/*` |
| 3 | Backend: Supplier matching + CIF/NIF | ✅ Done | 2h | Phase 1 | `services/supplier-matching.service.ts`, `src/common/utils/string-similarity.ts` |
| 4 | Backend: Product matching per line | ✅ Done | 2h | Phase 1 | `services/line-matching.service.ts` |
| 5 | Backend: Stock entry on confirmation | ✅ Done | 2h | Phase 2 | `services/albaran-stock.service.ts`, `services/albaran-status.service.ts` (updated) |
| 6 | Frontend: Albaran list + detail pages | ✅ Done | 3h | Phase 2 | `frontend/src/app/dashboard/albaranes/**`, `frontend/src/lib/api-albaran.ts`, `frontend/src/hooks/use-albaranes.ts` |
| 7 | Frontend: Line review + matching workflow | ✅ Done | 3h | Phase 4, 6 | `frontend/src/components/albaranes/{product-picker,create-product-inline,supplier-picker,line-actions-toolbar}.tsx` |
| 8 | Integration: end-to-end + migration | ✅ Done | 1h | All | `albaranes.service.ts` (createFromUpload), `albaranes.controller.ts`, `ingestion/page.tsx` |

**Progress: 8/8 phases (100%)** | **Effort done: ~18h / 18h**

## Dependency Graph

```
Phase 1 (Schema) ✅
├── Phase 2 (CRUD) ✅ ──→ Phase 5 (Stock) ✅ ────→ Phase 8 (Integration) ✅
├── Phase 3 (Supplier Match) ✅ ──────────────────→ Phase 8 ✅
├── Phase 4 (Line Match) ✅ ──→ Phase 7 (FE Review) ✅
│                                         ↑
└── Phase 2 ✅ ──→ Phase 6 (FE Pages) ✅ ─┘──→ Phase 8 ✅
```

**All phases complete!** 🎉

## Phase Details

### ✅ Phase 1: Schema — Albaran + AlbaranLine

- `Albaran` model with `AlbaranStatus` enum (PENDIENTE → REVISADO → CONFIRMADO → ARCHIVADO)
- `AlbaranLine` model with `LineMatchStatus` (NUEVO / MATCH_ALTO / MATCH_DUDOSO) and `LineStatus` (PENDIENTE / CONFIRMADO / RECHAZADO)
- `cifNif` field added to `Supplier` model
- Migration applied, `prisma generate` passes

### ✅ Phase 2: Backend — Albaran CRUD + Status Endpoints

- 9 REST endpoints under `/api/v1/albaranes`
- Status transitions with validation (forward-only, preconditions checked)
- `AlbaranNumberService` for internal numbering
- `AlbaranStatusService` for transition validation
- DTOs: `CreateAlbaranDto`, `UpdateAlbaranDto`, `AlbaranQueryDto`, `MatchLineDto`

### ✅ Phase 3: Backend — Supplier Matching + CIF/NIF

- `SupplierMatchingService`: 3-tier matching (CIF exact → name fuzzy → none)
- `string-similarity.ts`: shared Levenshtein distance util (extracted from ProductRecognitionService)
- CIF normalization (uppercase, strip hyphens/spaces)
- Fuzzy name match with confidence thresholds (≥0.8 auto-match, 0.5-0.8 suggestions only)
- 10 unit tests passing
- `ProductRecognitionService` refactored to use shared util

### ✅ Phase 4: Backend — Product Matching Per Line

- `LineMatchingService`: barcode exact → description fuzzy via ProductRecognitionService
- Confidence thresholds: ≥0.8 = MATCH_ALTO (auto-assign), 0.5-0.8 = MATCH_DUDOSO (suggestions), <0.5 = NUEVO
- `matchAllLines()` batch processing for albaran
- 14 unit tests passing
- `IngestaModule` imported with `forwardRef()` for ProductRecognitionService access

### ✅ Phase 5: Backend — Stock Entry on Confirmation

- `AlbaranStockService`: transaction-safe stock entry on CONFIRMADO transition
- Idempotency check (skip if movements already exist for this albaran)
- Product price update + notification on >10% change
- New product creation for NUEVO + CONFIRMADO lines
- Stock upsert with `increment` for atomic quantity updates
- Integrated with `AlbaranStatusService` — auto-triggers on CONFIRMADO transition
- 12 unit tests passing

### ✅ Phase 6: Frontend — Albaran List + Detail Pages

- `/dashboard/albaranes` list with filters (status, search, date range)
- `/dashboard/albaranes/[id]/resumen` summary tab with status transitions
- `/dashboard/albaranes/[id]/lineas` lines table with confirm/reject
- URL-based tabs (not useState)
- `api-albaran.ts` API client with all endpoints
- `use-albaranes.ts` + `use-albaran-detail.ts` hooks
- `albaran-status-badge.tsx`, `line-match-badge.tsx`, `albaran-card.tsx` components
- Build + type check passing

### ✅ Phase 7: Frontend — Line Review + Matching Workflow

- `product-picker-dialog.tsx`: Search + select product for MATCH_DUDOSO lines
- `create-product-inline.tsx`: Quick create product from NUEVO line (name, price, unit)
- `supplier-picker-dialog.tsx`: Search + reassign supplier on albaran header
- `line-actions-toolbar.tsx`: Bulk "confirm all matched" action
- `use-product-search.ts` + `use-supplier-search.ts`: Debounced search hooks
- Lineas page updated with interactive match actions per line status
- Resumen page updated with "Cambiar proveedor" button

### ✅ Phase 8: Integration — End-to-End + Backward Compat

- `createFromUpload()` in AlbaranesService wires OCR → supplier match → albaran creation → line match
- `POST /albaranes/from-upload` endpoint implemented (replaces placeholder)
- Graceful degradation: OCR failure creates PENDIENTE albaran with error notes
- Line matching runs non-blocking (fast response)
- Old ingesta endpoints preserved unchanged (backward compat)
- Ingestion page updated with "Ver en Albaranes" navigation link

## Unresolved Questions

1. **Warehouse assignment:** On confirmation, which warehouse gets stock? Recommend: user selects with fallback to first warehouse.
2. **Albaran numbering:** Auto-generated internal + supplier's reference. Already implemented in `AlbaranNumberService`.
3. **CIF/NIF on Supplier:** Added as optional field. Existing suppliers have null. Required for new suppliers? User decision pending.

## Context Links

- Full plan: `plans/260622-1255-albaran-data-flow/implementation-plan.md`
- OCR enhancement: `plans/260619-ocr-enhancement/`
- Schema: `backend/prisma/schema.prisma` (lines 305-318 enums, 1493+ models)
