---
title: "Phase 01: Schema Migration + Prisma Changes"
status: pending
priority: P1
effort: 2h
---

## Context Links

- Schema: `backend/prisma/schema.prisma:97-138` (Product model)
- Schema: `backend/prisma/schema.prisma:922-945` (Stock model)
- Schema: `backend/prisma/schema.prisma:896-919` (Supplier model)
- Schema: `backend/prisma/schema.prisma:1009-1033` (Category model)
- Existing migrations: `backend/prisma/migrations/20260531182003_init`

## Overview

Add 6 new fields to Product model, create 2 new models (PurchaseFormat, NutritionalInfo), and generate migration. All new fields must have defaults or be nullable to not break existing data.

## Key Insights

- Product model at `schema.prisma:97-138` currently has: name, description, categoryId, supplierId, purchaseUnit, storageUnit, recipeUnit, purchasePrice, netPrice, profitMargin, wastePercentage, yieldFactor, allergens Int[]
- Stock model at `schema.prisma:922-945` has: minimumStock, maximumStock, quantity, reservedStock — tied to product via productId, but also has warehouseId (unique composite [productId, warehouseId])
- No multer/FileInterceptor currently exists in backend — image upload endpoint must be created in Phase 02
- Category has `parentId` for hierarchy — already maps to familia/subfamilia
- Supplier model has `products Product[]` relation already

## Requirements

### Functional

- Add 6 new fields to Product: iva (Float @default(10)), qr (String?), barcode (String?), brand (String?), hideAllergens (Boolean @default(false)), imageUrl (String?)
- Create PurchaseFormat model with 1:N relation to Product
- Create NutritionalInfo model with 1:1 relation to Product
- All existing Product rows must continue to work without manual data changes

### Non-Functional

- Migration must be reversible (down migration drops new columns/tables)
- New indexes on frequently-queried fields (barcode for future scanning)

## Architecture

### Data Flow

```
Product (existing) ──┬──< PurchaseFormat (new, 1:N)
                      ├──1 NutritionalInfo (new, 1:1)
                      └── + 6 scalar fields
```

### New Models

**PurchaseFormat** (mapped to `purchase_formats`):

```
id           String   @id @default(cuid())
productId    String
name         String   // "Caja 10kg", "Bote 5L"
format       String   // "10kg", "5L"
price        Float    // Precio del formato
createdAt    DateTime @default(now())
product      Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
@@index([productId])
@@map("purchase_formats")
```

**NutritionalInfo** (mapped to `nutritional_info`):

```
id                   String  @id @default(cuid())
productId            String  @unique
energyKj             Float?
energyKcal           Float?
fat                  Float?
saturatedFat         Float?
transFat             Float?
monounsaturatedFat   Float?
polyunsaturatedFat   Float?
omega3               Float?
cholesterol          Float?
carbohydrates        Float?
sugars               Float?
protein              Float?
salt                 Float?
product              Product @relation(fields: [productId], references: [id], onDelete: Cascade)
@@map("nutritional_info")
```

### Product Model Additions (insert after `allergens Int[]` at line 120)

```
iva            Float    @default(10)
qr             String?
barcode        String?
brand          String?
hideAllergens  Boolean  @default(false)
imageUrl       String?
```

### New Relations on Product (add to existing relations block)

```
purchaseFormats   PurchaseFormat[]
nutritionalInfo   NutritionalInfo?
```

### New Indexes

```
@@index([barcode])   // for future barcode scanning
```

## Related Code Files

### Modify

- `backend/prisma/schema.prisma:97-138` — Product model (add 6 fields + 2 relations)
- `backend/prisma/schema.prisma` — add PurchaseFormat model (after Product)
- `backend/prisma/schema.prisma` — add NutritionalInfo model (after PurchaseFormat)

### Create

- `backend/prisma/migrations/<timestamp>_add_product_extended_fields/migration.sql` — via `npx prisma migrate dev`

### No Deletions

## Implementation Steps

1. **Add 6 new fields to Product model** in `schema.prisma:120` (after `allergens Int[]`)
   - `iva Float @default(10)` — % IVA, default 10%
   - `qr String?` — QR code string
   - `barcode String?` — EAN barcode
   - `brand String?` — brand name
   - `hideAllergens Boolean @default(false)` — hide allergens in labeling
   - `imageUrl String?` — ficha tecnica/etiqueta image URL

2. **Add 2 new relations to Product** in relations block (after `unitConversions UnitConversion[]` at line 132)
   - `purchaseFormats PurchaseFormat[]`
   - `nutritionalInfo NutritionalInfo?`

3. **Add `@@index([barcode])`** to Product indexes block (after line 136)

4. **Create PurchaseFormat model** after Product model (after line 138)

5. **Create NutritionalInfo model** after PurchaseFormat model

6. **Run migration**: `npx prisma migrate dev --name add_product_extended_fields`

7. **Verify migration**: check `prisma/migrations/<timestamp>/migration.sql` has:
   - ALTER TABLE "products" ADD COLUMN for each new field
   - CREATE TABLE "purchase_formats"
   - CREATE TABLE "nutritional_info"
   - All new fields have DEFAULT or are nullable

8. **Run `npx prisma generate`** to update Prisma client types

## Todo List

- [ ] Add 6 fields to Product model in schema.prisma
- [ ] Add 2 relations to Product model
- [ ] Add barcode index
- [ ] Create PurchaseFormat model
- [ ] Create NutritionalInfo model
- [ ] Run prisma migrate dev
- [ ] Verify migration SQL
- [ ] Run prisma generate

## Success Criteria

- Migration runs without error on existing database
- All existing Product rows have: iva=10, qr=null, barcode=null, brand=null, hideAllergens=false, imageUrl=null
- PurchaseFormat and NutritionalInfo tables exist with correct columns
- `npx prisma generate` succeeds with new types
- Down migration (`prisma migrate revert`) works

## Risk Assessment

| Risk                                             | Mitigation                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| Float precision for iva/nutritional values       | Acceptable for food labeling; if precision matters later, switch to Decimal |
| NutritionalInfo 1:1 via @unique on productId     | Correct pattern; ensures one nutritional record per product                 |
| Cascade delete on PurchaseFormat/NutritionalInfo | Desired: deleting product removes its formats and nutritional info          |

## Security Considerations

- No PII in new fields
- imageUrl will be validated server-side in Phase 02 (no arbitrary URL injection)
- barcode field: validate EAN format in DTO (Phase 02)

## Next Steps

- Phase 02 depends on this: backend DTO/service/controller changes use new Prisma types
