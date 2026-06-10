---
title: "Phase 02: Backend DTO + Service + Controller"
status: pending
priority: P1
effort: 3h
---

## Context Links

- Schema changes: Phase 01 (new Product fields, PurchaseFormat, NutritionalInfo models)
- DTOs: `backend/src/modules/products/dto/create-product.dto.ts`
- Response DTOs: `backend/src/modules/products/dto/product-response.dto.ts`
- Service: `backend/src/modules/products/products.service.ts`
- Controller: `backend/src/modules/products/products.controller.ts`
- Module: `backend/src/modules/products/products.module.ts`
- Allergen DTOs: `backend/src/modules/allergens/dto/allergens.dto.ts:9-59`
- No multer/FileInterceptor exists in backend currently (verified: grep returned empty, NOT in package.json)
- No dedicated Suppliers module/controller exists — only `GET /api/v1/products/suppliers` returns IDs (verified: no supplier module in app.module.ts)
- Must add supplier list endpoint querying Supplier table directly

## Overview

Update backend to support new Product fields, nested creation/update of PurchaseFormat and NutritionalInfo, and image upload endpoint. All new DTO fields are optional for backward compatibility.

## Key Insights

- `CreateProductDto` at `create-product.dto.ts:16-80` uses `@IsOptional()` for all non-required fields — new fields follow same pattern
- `UpdateProductDto` at `create-product.dto.ts:82-149` mirrors Create with all optional — add new optional fields
- `ProductsService.create()` at `products.service.ts:17-85` manually maps DTO fields to Prisma create data — must extend for nested relations
- `ProductsService.update()` at `products.service.ts:175-242` uses spread copy — must handle nested PurchaseFormat/NutritionalInfo upserts
- `ProductsService.findOne()` at `products.service.ts:156-173` currently returns raw product without includes — must add `include` for new relations
- `ProductsController` at `products.controller.ts:36-130` — standard CRUD, needs new image upload endpoint
- Products module at `products.module.ts:8-18` imports PrismaModule, AuthModule, UsersModule — may need MulterModule for uploads

## Requirements

### Functional

- CreateProductDto accepts new scalar fields (iva, qr, barcode, brand, hideAllergens, imageUrl)
- CreateProductDto accepts nested `purchaseFormats` array and `nutritionalInfo` object
- UpdateProductDto accepts same new fields + nested upsert logic
- GET /api/v1/products/:id returns product with `purchaseFormats` and `nutritionalInfo` included
- POST /api/v1/products/:id/image handles file upload (multer), stores locally, returns URL
- Validate barcode format (EAN-8 or EAN-13) if provided
- Validate nutritional info fields are positive numbers if provided

### Non-Functional

- All new DTO fields are `@IsOptional()` — existing API consumers unaffected
- Image upload: max 2MB, JPG/PNG/WebP only
- Nested creates use Prisma's `create` syntax; nested updates use `deleteMany + create` for PurchaseFormat (simpler than upsert per row)

## Architecture

### Data Flow — Create Product

```
POST /api/v1/products
  Body: { name, ..., iva, qr, barcode, brand, hideAllergens, purchaseFormats: [...], nutritionalInfo: {...} }
  → CreateProductDto (validation)
  → ProductsService.create()
    → prisma.product.create({
        data: {
          ...scalarFields,
          purchaseFormats: { create: dto.purchaseFormats },
          nutritionalInfo: dto.nutritionalInfo ? { create: dto.nutritionalInfo } : undefined
        },
        include: { purchaseFormats: true, nutritionalInfo: true }
      })
```

### Data Flow — Update Product

```
PATCH /api/v1/products/:id
  Body: { ..., purchaseFormats: [...], nutritionalInfo: {...} }
  → UpdateProductDto (validation)
  → ProductsService.update()
    → if purchaseFormats provided: prisma.purchaseFormat.deleteMany({ where: { productId: id } })
      then prisma.product.update({ data: { purchaseFormats: { create: dto.purchaseFormats } } })
    → if nutritionalInfo provided: prisma.nutritionalInfo.upsert({ where: { productId: id }, create: ..., update: ... })
    → prisma.product.update({ data: scalarFields, include: { purchaseFormats: true, nutritionalInfo: true } })
```

### Data Flow — Image Upload

```
POST /api/v1/products/:id/image
  FormData: { file: File }
  → Multer disk storage (uploads/products/)
  → ProductsService.updateImageUrl(id, url)
  → return { success: true, data: { imageUrl } }
```

## Related Code Files

### Modify

- `backend/src/modules/products/dto/create-product.dto.ts` — add new fields to Create + Update DTOs
- `backend/src/modules/products/dto/product-response.dto.ts` — add new fields to response shapes
- `backend/src/modules/products/products.service.ts` — extend create/update/findOne for nested relations
- `backend/src/modules/products/products.controller.ts` — add image upload endpoint
- `backend/src/modules/products/products.module.ts` — add MulterModule or configure multer

### Create

- `backend/src/modules/products/dto/purchase-format.dto.ts` — PurchaseFormat DTO
- `backend/src/modules/products/dto/nutritional-info.dto.ts` — NutritionalInfo DTO

### No Deletions

## Implementation Steps

1. **Install multer** — `npm install multer @types/multer` (NOT currently in package.json, verified)

2. **Create `purchase-format.dto.ts`**
   - `CreatePurchaseFormatDto`: name (String, required), format (String, required), price (Float, required, @IsPositive)

3. **Create `nutritional-info.dto.ts`**
   - `CreateNutritionalInfoDto`: 13 fields, all `@IsOptional() @IsNumber() @Min(0)` — energyKj, energyKcal, fat, saturatedFat, transFat, monounsaturatedFat, polyunsaturatedFat, omega3, cholesterol, carbohydrates, sugars, protein, salt

4. **Update `create-product.dto.ts`**
   - Add to `CreateProductDto`: iva (@IsOptional @IsNumber @Min(0) @Max(100)), qr (@IsOptional @IsString), barcode (@IsOptional @IsString), brand (@IsOptional @IsString), hideAllergens (@IsOptional @IsBoolean), imageUrl (@IsOptional @IsString)
   - Add: purchaseFormats (@IsOptional @IsArray @ValidateNested({ each: true }) @Type(() => CreatePurchaseFormatDto))
   - Add: nutritionalInfo (@IsOptional @ValidateNested() @Type(() => CreateNutritionalInfoDto))
   - Mirror all new fields in `UpdateProductDto`
   - Add custom barcode validator: `@Matches(/^[0-9]{8}$|^[0-9]{13}$/, { message: 'Barcode must be EAN-8 or EAN-13' })`

5. **Update `product-response.dto.ts`**
   - Add new scalar fields to `ProductResponseDto.data`
   - Add `purchaseFormats: Array<{id, name, format, price}>`
   - Add `nutritionalInfo: { ...fields } | null`

6. **Update `products.service.ts` — create method**
   - Destructure new fields from dto: `purchaseFormats`, `nutritionalInfo`, `iva`, `qr`, `barcode`, `brand`, `hideAllergens`, `imageUrl`
   - Build `createData` with nested creates:
     ```
     purchaseFormats: purchaseFormats ? { create: purchaseFormats } : undefined,
     nutritionalInfo: nutritionalInfo ? { create: nutritionalInfo } : undefined,
     ```
   - Add `include: { purchaseFormats: true, nutritionalInfo: true }` to prisma create call

7. **Update `products.service.ts` — update method**
   - Extract `purchaseFormats` and `nutritionalInfo` from updateData before spread
   - Before main update: if purchaseFormats provided → `prisma.purchaseFormat.deleteMany({ where: { productId: id } })`
   - In update data: `purchaseFormats: { create: purchaseFormats }` (recreate all)
   - If nutritionalInfo provided → `prisma.nutritionalInfo.upsert({ where: { productId: id }, create: nutritionalInfo, update: nutritionalInfo })`
   - Remove purchaseFormats/nutritionalInfo from updateData to avoid Prisma error on direct scalar assignment
   - Add `include: { purchaseFormats: true, nutritionalInfo: true }` to prisma update call

8. **Update `products.service.ts` — findOne method**
   - Add `include: { purchaseFormats: true, nutritionalInfo: true }` to prisma findFirst

9. **Update `products.service.ts` — findAll method**
   - Add `purchaseFormats: true` to select (not nutritionalInfo — too heavy for list view)

10. **Add image upload endpoint in `products.controller.ts`**
    - New route: `@Post(':id/image')` with `@UseInterceptors(FileInterceptor('file', multerOptions))`
    - multerOptions: storage = diskStorage({ destination: 'uploads/products/', filename: randomUUID + ext }), limits: { fileSize: 2 _ 1024 _ 1024 }, fileFilter: jpg/png/webp only
    - Call `productsService.updateImageUrl(id, file.path, tenantId)`
    - Return `{ success: true, data: { imageUrl: relativePath } }`

11. **Add `updateImageUrl` method to `products.service.ts`**
    - Verify product exists + tenant match
    - `prisma.product.update({ where: { id }, data: { imageUrl: relativePath } })`

12. **Create `uploads/products/` directory** (add .gitkeep)

13. **Add `uploads/` to `.gitignore`** if not already present

14. **Serve static files**: In `main.ts`, add `app.useStaticAssets(join(__dirname, '..', 'uploads'))` or configure ServeStaticModule

15. **Add supplier list endpoint to `products.controller.ts`** — replace existing `@Get('suppliers')` which only returns IDs
    - Change `getSuppliers` to query `prisma.supplier.findMany({ where: { tenantId } })` directly
    - Return full supplier objects: `{ id, name, email, phone, isActive }`
    - This avoids creating a whole Suppliers module (YAGNI) — just add one method to products service

16. **Update `products.service.ts` — getSuppliers method**
    - Replace current implementation (extracts IDs from products) with `prisma.supplier.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true, email: true, phone: true } })`
    - Return `{ success: true, data: suppliers }`

## Todo List

- [ ] Install multer + @types/multer
- [ ] Create purchase-format.dto.ts
- [ ] Create nutritional-info.dto.ts
- [ ] Update CreateProductDto with new scalar + nested fields
- [ ] Update UpdateProductDto with new scalar + nested fields
- [ ] Add barcode validation
- [ ] Update ProductResponseDto
- [ ] Update products.service.ts create() for nested relations
- [ ] Update products.service.ts update() for nested relations
- [ ] Update products.service.ts findOne() with includes
- [ ] Update products.service.ts findAll() with includes
- [ ] Add image upload endpoint to controller
- [ ] Add updateImageUrl to service
- [ ] Configure multer + static file serving
- [ ] Create uploads directory
- [ ] Update .gitignore
- [ ] Update getSuppliers to return full Supplier objects (not just IDs)

## Success Criteria

- POST /api/v1/products with all new fields + nested data creates correctly
- PATCH /api/v1/products/:id updates scalar fields + replaces purchaseFormats + upserts nutritionalInfo
- GET /api/v1/products/:id returns product with purchaseFormats and nutritionalInfo included
- POST /api/v1/products/:id/image uploads file, returns URL, product.imageUrl updated
- Image upload rejects files > 2MB
- Image upload rejects non-image MIME types
- Barcode validation rejects non-EAN strings
- Existing API calls without new fields still work (backward compatible)
- All existing tests still pass

## Risk Assessment

| Risk                                                | Likelihood | Impact | Mitigation                                                                                        |
| --------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------- |
| Multer not installed                                | High       | Medium | `npm install multer @types/multer` — verify in package.json first                                 |
| PurchaseFormat deleteMany+create is not atomic      | Low        | Medium | Wrap in `$transaction` — if delete succeeds but create fails, formats are lost but product intact |
| Static file serving path differs in production      | Medium     | High   | Use environment variable for base URL; for now local dev only                                     |
| NutritionalInfo upsert conflict on unique productId | Low        | Low    | Prisma upsert handles this by design                                                              |

## Security Considerations

- Image upload: validate MIME type server-side (not just extension)
- Image upload: sanitize filename (use UUID, never user-provided filename)
- Image upload: max file size enforced at multer level
- Barcode: validate format to prevent injection
- NutritionalInfo fields: @Min(0) prevents negative values

## Next Steps

- Phase 04 (Frontend hooks) depends on this phase for API contract
