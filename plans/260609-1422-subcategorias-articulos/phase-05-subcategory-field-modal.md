## Phase 5: Add Subcategory Field to Create/Edit Modal

**Priority:** P2 | **Status:** [ ] | **Effort:** 1h | **Depends on:** Phase 2, Phase 4

### Context Links
- Articles page modal: `frontend/src/app/dashboard/articulos/page.tsx:358-588` (create/edit form)
- Current category field: lines 433-447 (plain text input for "Categoria")
- Current supplier field: lines 448-461 (plain text input for "Proveedor")
- Category tree hook: `frontend/src/hooks/use-categories.ts` (implemented in Phase 2)
- Product hook types: `frontend/src/hooks/use-products.ts:20-33` (CreateProductData)

### Overview
Replace the plain text "Categoria" input in the create/edit modal with chained dropdowns (same pattern as filters). Subcategory is disabled until category is selected. The selected subcategory ID is sent as `categoryId` to the backend.

### Key Insights
- Current form uses `formData.category` (string) mapped to `CreateProductData.category` — but the backend `Product` model uses `categoryId` (FK to Category). The form field mapping is inconsistent: `formData.category` → `productData.category` at line 92, but the product has `categoryId`.
- `CreateProductData` at `use-products.ts:20-33` has `category?: string` (not `categoryId`). This maps to whatever the backend DTO accepts. Need to verify the products controller DTO.
- The modal needs its own category/subcategory state independent of the filter dropdowns above.
- When editing, `product.categoryId` should be resolved to its parent to pre-populate the category dropdown, then the subcategory dropdown shows the parent's children with the matching subcategory pre-selected.

### Requirements
- Replace text input for "Categoria" with dropdown using parent categories from `useCategoryTree`
- Add "Subcategoria" dropdown that appears when category is selected
- Subcategoria dropdown shows children of selected category
- On form submit, send the selected subcategory ID as `categoryId`
- On edit, resolve product's `categoryId` to its parent and pre-select both dropdowns
- On category change, clear subcategory selection

### Architecture — Data Flow

```
Modal Form State:
  formData.parentCategory (new field — parent category ID)
  formData.subcategory    (maps to categoryId sent to backend)

On Submit:
  productData.categoryId = formData.subcategory  ← subcategory is the actual categoryId

On Edit (populate form):
  Given product.categoryId:
    1. Search tree for parent whose children contain this categoryId
    2. Set formData.parentCategory = parent.id
    3. Set formData.subcategory = product.categoryId
```

### Related Code Files
- **Modify:** `frontend/src/app/dashboard/articulos/page.tsx`

### Implementation Steps

1. **Add form state fields** for parent category and subcategory:
   ```ts
   const [formData, setFormData] = useState({
     name: '',
     description: '',
     parentCategory: '',    // NEW — parent category ID for UI
     subcategory: '',       // RENAMED from 'category' — actual categoryId sent to backend
     supplier: '',
     unit: '',
     purchasePrice: '',
     wastePercentage: '',
     profitMargin: '',
     allergens: '',
   });
   ```

2. **Derive subcategory options** for modal (reuse `tree` from Phase 4):
   ```ts
   const modalSubcategories = tree.find(c => c.id === formData.parentCategory)?.children ?? [];
   ```

3. **Replace category text input** (lines 433-447) with two dropdowns:
   ```tsx
   <div>
     <label className="block text-sm font-medium text-gray-700">Categoria</label>
     <select
       name="parentCategory"
       value={formData.parentCategory}
       onChange={(e) => setFormData({ ...formData, parentCategory: e.target.value, subcategory: '' })}
       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
     >
       <option value="">Seleccionar categoria</option>
       {tree.map((cat) => (
         <option key={cat.id} value={cat.id}>{cat.name}</option>
       ))}
     </select>
   </div>
   <div>
     <label className="block text-sm font-medium text-gray-700">Subcategoria</label>
     <select
       name="subcategory"
       value={formData.subcategory}
       onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
       disabled={!formData.parentCategory}
       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
     >
       <option value="">Seleccionar subcategoria</option>
       {modalSubcategories.map((sub) => (
         <option key={sub.id} value={sub.id}>{sub.name}</option>
       ))}
     </select>
   </div>
   ```

4. **Update handleSubmit** — send `categoryId` as the subcategory value:
   ```ts
   const productData = {
     name: formData.name,
     description: formData.description || undefined,
     categoryId: formData.subcategory || undefined,  // subcategory IS the categoryId
     supplierId: formData.supplier || undefined,
     // ... rest unchanged
   };
   ```
   Note: Need to verify which field name the backend products DTO expects. Check `products.controller.ts` create DTO.

5. **Update handleEdit** — resolve categoryId to parent:
   ```ts
   const handleEdit = (product: Product) => {
     // Find parent category for this product's categoryId
     let parentCategory = '';
     if (product.categoryId) {
       for (const parent of tree) {
         const isChild = parent.children?.some(c => c.id === product.categoryId);
         if (isChild) {
           parentCategory = parent.id;
           break;
         }
       }
     }
     setSelectedProduct(product);
     setFormData({
       name: product.name,
       description: '',
       parentCategory,
       subcategory: product.categoryId || '',
       supplier: product.supplierId || '',
       unit: product.purchaseUnit,
       purchasePrice: product.purchasePrice.toString(),
       wastePercentage: '',
       profitMargin: '',
       allergens: JSON.stringify(product.allergens),
     });
     setShowCreateForm(true);
   };
   ```

6. **Update modal title** from "Crear Producto"/"Editar Producto" to "Crear Articulo"/"Editar Articulo".

7. **Update form reset** — include `parentCategory` and `subcategory` fields in all reset calls:
   ```ts
   parentCategory: '',
   subcategory: '',
   ```

### Todo List
- [ ] Add parentCategory and subcategory to formData state
- [ ] Replace category text input with chained dropdowns
- [ ] Derive modal subcategories from selected parent
- [ ] Update handleSubmit to send subcategory as categoryId
- [ ] Update handleEdit to resolve categoryId to parent
- [ ] Update modal title labels
- [ ] Update all form reset calls

### Success Criteria
- Create modal shows category dropdown with 7 parent categories
- Selecting a category enables subcategory dropdown with its children
- Submitting the form sends the subcategory ID as `categoryId`
- Edit modal pre-populates both category and subcategory from existing product data
- Changing category clears subcategory
- Modal title says "Crear Articulo" / "Editar Articulo"

### Risk Assessment
| Risk | Mitigation |
|------|-----------|
| Backend products DTO field name mismatch | Verify products controller create DTO before implementation; may need `categoryId` not `category` |
| Product categoryId points to a parent category (not child) | Lookup handles both: if no parent found for the categoryId, it's likely a parent itself — set parentCategory to the categoryId and leave subcategory empty |

### Next Steps
- Phase 6 updates remaining "producto" references in other pages
