---
title: "Phase 05: Integration Testing + Validation"
status: pending
priority: P1
effort: 3h
---

## Context Links

- All phases 01-04 must be complete
- Backend test patterns: `backend/src/modules/products/products.service.spec.ts`, `products.controller.spec.ts`
- Frontend has no test infrastructure visible (no test files found under `frontend/src/app/dashboard/`)
- Existing test runner: Jest (backend)
- Coverage target: maintain existing >80% on backend

## Overview

Validate the full end-to-end flow: schema migration, backend API, frontend hooks, and 5-tab modal. Fix any integration issues. Add/update backend tests for new DTOs and service methods.

## Key Insights

- Backend test suites exist at `products.service.spec.ts` and `products.controller.spec.ts` — must update for new fields
- PrismaService is mocked in tests — new models (PurchaseFormat, NutritionalInfo) need mock setup
- Frontend testing: no existing test infrastructure for dashboard pages; manual E2E validation required
- Image upload: manual test only (multer + disk storage behavior hard to unit test without file system mocking)

## Requirements

### Functional

- Backend unit tests pass for updated ProductsService (create/update/findOne with new fields)
- Backend DTO validation tests pass for new fields (iva range, barcode format, nested DTOs)
- Image upload endpoint responds correctly to valid and invalid files
- Full E2E manual test: open modal, fill all 5 tabs, save, verify data persists

### Non-Functional

- No regression on existing tests
- Backend coverage maintained at current level or above

## Architecture

### Test Matrix

| Layer    | What                                       | Type        | How                         |
| -------- | ------------------------------------------ | ----------- | --------------------------- |
| Backend  | CreateProductDto validation (new fields)   | Unit        | Jest + class-validator      |
| Backend  | UpdateProductDto validation (new fields)   | Unit        | Jest + class-validator      |
| Backend  | CreatePurchaseFormatDto validation         | Unit        | Jest + class-validator      |
| Backend  | CreateNutritionalInfoDto validation        | Unit        | Jest + class-validator      |
| Backend  | ProductsService.create with nested models  | Unit        | Jest + PrismaService mock   |
| Backend  | ProductsService.update with nested models  | Unit        | Jest + PrismaService mock   |
| Backend  | ProductsService.findOne includes relations | Unit        | Jest + PrismaService mock   |
| Backend  | Image upload endpoint                      | Integration | Manual or supertest         |
| Frontend | 5-tab modal renders all tabs               | Manual      | Browser                     |
| Frontend | Allergen chip toggle                       | Manual      | Browser                     |
| Frontend | Purchase format add/delete rows            | Manual      | Browser                     |
| Frontend | Dependent dropdown familia/subfamilia      | Manual      | Browser                     |
| Frontend | Image upload < 2MB validation              | Manual      | Browser                     |
| Frontend | Create product → save → verify list        | Manual      | Browser                     |
| Frontend | Edit product → populate all tabs → save    | Manual      | Browser                     |
| Full     | Migration rollback                         | Manual      | `npx prisma migrate revert` |

### E2E Validation Scenarios

**Scenario 1: Create article with all fields**

1. Click "Crear Articulo"
2. Enter name "Tomate frito"
3. Tab 1: Set UC=kg, UA=kg, UR=g, Merma=5%, Precio=2.50, IVA=10, Formato/kg="1kg", Precio formato=2.50, QR="TOM-001", Marca="Hida", Barcode="12345678"
4. Tab 2: Add format "Caja 12u" / "12u" / 30.00; Add format "Bote 500g" / "500g" / 4.50
5. Tab 3: Select allergens Cereales con Gluten + Sulfitos; check "Ocultar en etiquetado"; upload image
6. Tab 4: Select supplier, Familia="Conservas", Subfamilia="Tomate", Stock min=10, Stock max=100
7. Tab 5: Enter energyKcal=75, fat=3.2, protein=1.5, salt=0.8
8. Click Guardar
9. Verify: product appears in list with correct data
10. Click Editar on new product
11. Verify: all 5 tabs populated with saved data

**Scenario 2: Create article with minimum fields (backward compat)**

1. Click "Crear Articulo"
2. Enter name "Sal"
3. Tab 1: Set UC=kg, Precio=0.50
4. Click Guardar
5. Verify: product created with defaults (iva=10, no formats, no nutritional info, no allergens)

**Scenario 3: Image upload validation**

1. Try uploading a 5MB file → should show error "Max 2MB"
2. Try uploading a .pdf → should show error "Only images allowed"
3. Upload valid 1MB .jpg → should succeed

**Scenario 4: Purchase format dynamic rows**

1. Tab 2: Click "Anadir formato" 3 times → 3 empty rows
2. Fill 2 rows, delete 1 → 2 rows remain
3. Delete all → 0 rows, table empty
4. Save → purchaseFormats saved as 2-item array

**Scenario 5: Stock visual warning**

1. Edit product with stock quantity=5, minimumStock=10
2. Verify: stock field shows red border/text
3. Edit product with stock quantity=150, maximumStock=100
4. Verify: stock field shows red border/text

## Related Code Files

### Modify

- `backend/src/modules/products/products.service.spec.ts` — add tests for new fields + nested creates
- `backend/src/modules/products/products.controller.spec.ts` — add tests for image upload endpoint

### No New Files (tests go in existing spec files)

## Implementation Steps

1. **Update `products.service.spec.ts`**
   - Add test: "create product with iva, qr, barcode, brand, hideAllergens"
   - Add test: "create product with purchaseFormats array"
   - Add test: "create product with nutritionalInfo"
   - Add test: "create product with all nested relations"
   - Add test: "update product replaces purchaseFormats"
   - Add test: "update product upserts nutritionalInfo"
   - Add test: "findOne includes purchaseFormats and nutritionalInfo"
   - Mock setup: add PurchaseFormat and NutritionalInfo to prisma mock

2. **Add DTO validation tests** (in service spec or separate describe block)
   - Test iva: valid (0-100), invalid (negative, >100)
   - Test barcode: valid EAN-8 ("12345678"), valid EAN-13 ("1234567890123"), invalid ("abc")
   - Test purchaseFormats: valid array, invalid (negative price)
   - Test nutritionalInfo: valid (all positive), invalid (negative fat)

3. **Update `products.controller.spec.ts`**
   - Add test: "POST /api/v1/products/:id/image uploads file and returns URL"
   - Add test: "POST /api/v1/products/:id/image rejects file > 2MB"
   - Add test: "POST /api/v1/products/:id/image rejects non-image file"

4. **Run full backend test suite**
   - `cd backend && npm test`
   - Verify all existing tests still pass
   - Verify new tests pass
   - Check coverage: `npm run test:cov`

5. **Manual E2E validation**
   - Start backend: `cd backend && npm run start:dev`
   - Start frontend: `cd frontend && npm run dev`
   - Execute all 5 scenarios from test matrix above
   - Document any issues found

6. **Verify migration rollback**
   - `npx prisma migrate revert`
   - Confirm new tables dropped, new columns removed
   - Re-run migration: `npx prisma migrate dev`

7. **Fix any issues found during E2E**

## Todo List

- [ ] Update products.service.spec.ts with new test cases
- [ ] Add DTO validation tests
- [ ] Update products.controller.spec.ts with image upload tests
- [ ] Run full backend test suite
- [ ] Manual E2E: Scenario 1 (full create)
- [ ] Manual E2E: Scenario 2 (minimum fields)
- [ ] Manual E2E: Scenario 3 (image validation)
- [ ] Manual E2E: Scenario 4 (dynamic format rows)
- [ ] Manual E2E: Scenario 5 (stock visual)
- [ ] Verify migration rollback
- [ ] Fix integration issues

## Success Criteria

- All backend unit tests pass (existing + new)
- No regression on existing test suite
- E2E Scenario 1: product created with all fields, editable, data persists
- E2E Scenario 2: backward-compatible create with defaults
- E2E Scenario 3: image validation works (size + type)
- E2E Scenario 4: dynamic format rows add/delete correctly
- E2E Scenario 5: stock visual warning renders red
- Migration rollback and re-apply succeeds

## Risk Assessment

| Risk                                 | Likelihood | Impact | Mitigation                                                            |
| ------------------------------------ | ---------- | ------ | --------------------------------------------------------------------- |
| Prisma mock doesn't cover new models | Medium     | Medium | Extend mock with PurchaseFormat/NutritionalInfo handlers              |
| Image upload fails in dev (no S3)    | Low        | Low    | Local disk storage configured in Phase 02; verify uploads/ dir exists |
| Frontend-backend field name mismatch | Medium     | Medium | Trace DTO → interface mapping carefully; test with real API call      |

## Security Considerations

- Verify image upload rejects executable files disguised as images (check MIME, not just extension)
- Verify barcode validation prevents injection
- Verify nutritional info fields reject negative values

## Next Steps

- All phases complete — mark plan as completed
