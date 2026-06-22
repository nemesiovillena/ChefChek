---
title: "Phase 04: Frontend Hooks + API Integration"
status: pending
priority: P1
effort: 2h
---

## Context Links

- Product hooks: `frontend/src/hooks/use-products.ts` (useCrud factory, needs new fields)
- API factory: `frontend/src/hooks/use-api.ts` (useCrud, useApiQuery, useApiMutation)
- Warehouse hooks: `frontend/src/hooks/use-warehouse.ts` (has warehouses + stock movements)
- Category hooks: `frontend/src/hooks/use-categories.ts` (useCategoryTree, useCategories)
- Backend controller: `backend/src/modules/products/products.controller.ts` (Phase 02 adds image endpoint)
- Backend service: `backend/src/modules/products/products.service.ts` (Phase 02 extends create/update)

## Overview

Update frontend hooks and API integration to support new Product fields, nested models (PurchaseFormat, NutritionalInfo), image upload, and proper supplier fetching. Wire hooks into Phase 03 modal components.

## Key Insights

- `use-products.ts:3-18` Product interface lacks: iva, qr, barcode, brand, hideAllergens, imageUrl, purchaseFormats, nutritionalInfo, storageUnit, recipeUnit
- `use-products.ts:20-33` CreateProductData uses `unit: string` (single field) instead of 3 separate unit fields — backend expects purchaseUnit/storageUnit/recipeUnit
- `use-products.ts:49-55` useCrud factory generates hooks against `/v1/products` — correct base URL
- `use-api.ts:97-171` useCrud provides useList, useGet, useCreate, useUpdate, useDelete — no custom mutation support for image upload
- No supplier list hook exists — current page.tsx:245 extracts supplier IDs from products (incorrect: only finds IDs, not names)
- Warehouse hook at `use-warehouse.ts` fetches `/v1/almacenes/warehouses` — contains stocks with product info

## Requirements

### Functional

- Update Product interface with all new fields
- Update CreateProductData/UpdateProductData for new fields + nested models
- Create `useProductImageUpload` mutation hook
- Create `useSuppliers` query hook for proper supplier list
- Ensure unit fields map correctly (purchaseUnit/storageUnit/recipeUnit, not single `unit`)

### Non-Functional

- Reuse existing `useApiMutation` and `useApiQuery` patterns from `use-api.ts`
- Keep hooks focused; no business logic in hooks

## Architecture

### Data Flow — Create Product (updated)

```
create-article-modal Guardar click
  → map formData to CreateProductData
  → useCreateProduct().mutateAsync(data)
  → if imageFile: useProductImageUpload().mutateAsync({ id, file })
  → invalidate products query
```

### Data Flow — Supplier List (new)

```
Tab 4 renders
  → useSuppliers() query
  → GET /api/v1/products/suppliers (existing endpoint at controller:69-75)
  → Returns supplier IDs — PROBLEM: only IDs, not full supplier objects
  → Need: GET /api/v1/suppliers endpoint (verify if exists)
```

### Data Flow — Product Stock Info (for Tab 4 visual)

```
Tab 4 renders for edit mode
  → useProduct(id) or included in product response
  → Stock model is per-warehouse; modal shows aggregate minimumStock/maximumStock
  → Option A: include stock info in product GET response
  → Option B: fetch stock separately from warehouse hook
  → Chosen: Option A — add stock include to findOne (Phase 02 handles this)
```

## Related Code Files

### Modify

- `frontend/src/hooks/use-products.ts` — update interfaces, add image upload hook

### Create

- `frontend/src/hooks/use-suppliers.ts` — supplier list hook

### No Deletions

## Implementation Steps

1. **Verify supplier API endpoint exists**
   - Phase 02 will update `GET /api/v1/products/suppliers` to return full Supplier objects (verified: no dedicated Suppliers module exists)
   - Frontend hook targets `/api/v1/products/suppliers` endpoint
   - Response shape: `{ success: true, data: Array<{ id, name, email, phone }> }`

2. **Update `use-products.ts` — Product interface**

   ```ts
   export interface PurchaseFormat {
     id: string;
     name: string;
     format: string;
     price: number;
   }

   export interface NutritionalInfo {
     id: string;
     energyKj: number | null;
     energyKcal: number | null;
     fat: number | null;
     saturatedFat: number | null;
     transFat: number | null;
     monounsaturatedFat: number | null;
     polyunsaturatedFat: number | null;
     omega3: number | null;
     cholesterol: number | null;
     carbohydrates: number | null;
     sugars: number | null;
     protein: number | null;
     salt: number | null;
   }

   export interface Product {
     id: string;
     name: string;
     description?: string;
     purchaseUnit: string;
     storageUnit: string;
     recipeUnit: string;
     purchasePrice: number;
     netPrice: number;
     profitMargin: number;
     wastePercentage: number;
     yieldFactor: number;
     iva: number;
     qr?: string;
     barcode?: string;
     brand?: string;
     hideAllergens: boolean;
     imageUrl?: string;
     categoryId?: string;
     supplierId?: string;
     allergens: number[];
     purchaseFormats: PurchaseFormat[];
     nutritionalInfo: NutritionalInfo | null;
     isActive: boolean;
     tenantId: string;
     createdAt: string;
     updatedAt: string;
   }
   ```

3. **Update `use-products.ts` — CreateProductData**

   ```ts
   export interface CreateProductData {
     name: string;
     description?: string;
     category?: string;
     supplier?: string;
     purchaseUnit: string;
     storageUnit: string;
     recipeUnit: string;
     purchasePrice: number;
     netPrice?: number;
     profitMargin?: number;
     wastePercentage?: number;
     yieldFactor?: number;
     iva?: number;
     qr?: string;
     barcode?: string;
     brand?: string;
     hideAllergens?: boolean;
     allergens?: number[];
     purchaseFormats?: Array<{ name: string; format: string; price: number }>;
     nutritionalInfo?: Record<string, number | null>;
   }
   ```

4. **Update `use-products.ts` — UpdateProductData**
   - Same shape as CreateProductData but all fields optional (except id)

5. **Add `useProductImageUpload` hook to `use-products.ts`**

   ```ts
   export function useProductImageUpload() {
     return useApiMutation<{ imageUrl: string }, { id: string; file: File }>(
       "/v1/products",
       "POST", // will be overridden in mutationFn
     );
   }
   ```

   - Actually, use `useMutation` directly since this needs FormData, not JSON:

   ```ts
   export function useProductImageUpload() {
     const queryClient = useQueryClient();
     return useMutation({
       mutationFn: async ({ id, file }: { id: string; file: File }) => {
         const formData = new FormData();
         formData.append("file", file);
         const response = await apiClient.post(
           `/api/v1/products/${id}/image`,
           formData,
           {
             headers: { "Content-Type": "multipart/form-data" },
           },
         );
         return response.data;
       },
       onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["products"] });
       },
     });
   }
   ```

6. **Create `use-suppliers.ts`**
   - Query hook for supplier list
   - Target: `GET /api/v1/products/suppliers` (Phase 02 updates this to return full objects)

   ```ts
   export interface Supplier {
     id: string;
     name: string;
     email?: string;
     phone?: string;
     isActive: boolean;
   }

   export function useSuppliers() {
     return useApiQuery<Supplier[]>(
       ["suppliers"],
       "/api/v1/products/suppliers",
     );
   }
   ```

7. **Verify supplier endpoint returns expected shape** after Phase 02

## Todo List

- [ ] Verify supplier endpoint returns full objects after Phase 02 update
- [ ] Update Product interface with new fields
- [ ] Update CreateProductData interface
- [ ] Update UpdateProductData interface
- [ ] Add useProductImageUpload hook
- [ ] Create use-suppliers.ts hook
- [ ] Test hooks compile without errors

## Success Criteria

- Product interface includes all new fields + nested models
- CreateProductData maps correctly to backend CreateProductDto
- useProductImageUpload sends FormData with file
- useSuppliers fetches supplier list (or fails gracefully if endpoint missing)
- No TypeScript compilation errors in hooks
- Existing useProducts/useCreateProduct/useUpdateProduct still work

## Risk Assessment

| Risk                                                     | Likelihood | Impact | Mitigation                                                              |
| -------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------- |
| Supplier endpoint returns only IDs (pre-Phase-02 state)  | Low        | Medium | Phase 02 verified to update endpoint to return full Supplier objects    |
| useCrud factory doesn't support custom mutation patterns | Medium     | Low    | Use raw useMutation for image upload instead of factory                 |
| Backend returns different shape than expected            | Medium     | Medium | Verify response DTOs match interfaces; add runtime validation if needed |

## Security Considerations

- FormData upload: only append 'file' key, no extra fields
- No auth token exposure in hooks — apiClient handles headers

## Next Steps

- Phase 05 validates end-to-end flow with real API calls
