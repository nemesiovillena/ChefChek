---
title: "Phase 03: Frontend Modal Component Decomposition"
status: pending
priority: P1
effort: 4h
---

## Context Links

- Current page: `frontend/src/app/dashboard/articulos/page.tsx` (487 lines, monolith)
- UI Tabs component: `frontend/src/components/ui/tabs.tsx` (base-ui Tabs primitive)
- UI Input: `frontend/src/components/ui/input.tsx`
- UI Select: `frontend/src/components/ui/select.tsx`
- UI Button: `frontend/src/components/ui/button.tsx`
- UI Badge: `frontend/src/components/ui/badge.tsx`
- UI Label: `frontend/src/components/ui/label.tsx`
- Allergen data: `backend/src/modules/allergens/dto/allergens.dto.ts:26-59` (ALLERGENS_INFO array with id, name, icon, color, severity)
- Category hooks: `frontend/src/hooks/use-categories.ts` (useCategoryTree, useCategories)
- Product hooks: `frontend/src/hooks/use-products.ts`
- Warehouse hooks: `frontend/src/hooks/use-warehouse.ts`
- AGENTS.md note: Next.js version has breaking changes — read `node_modules/next/dist/docs/` before writing code

## Overview

Decompose the 487-line monolith `page.tsx` into a 5-tab modal system. Extract tab content into separate component files. Keep the list/table view in `page.tsx` and move the modal into its own component.

## Key Insights

- Current modal (lines 402-483) is a flat `<form>` with basic fields — no tabs
- Current `formData` state (lines 42-52) has: name, description, category, supplier, unit, purchasePrice, wastePercentage, profitMargin, allergens — missing all new fields
- `formParentCategory` + `formSubcategories` (lines 62-67) already implement dependent dropdown pattern for categories
- Tabs component at `ui/tabs.tsx` uses `@base-ui/react/tabs` with `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` exports — ready to use
- ALLERGENS_INFO in backend has icon+color per allergen — frontend needs a copy or API endpoint
- No dedicated supplier list hook exists — current page extracts supplier IDs from products (line 245: `[...new Set(products.map(p => p.supplierId))]`) — needs proper hook
- Product interface in `use-products.ts:3-18` lacks all new fields — Phase 04 updates this

## Requirements

### Functional

- 5 tabs: Peso/Precio, Formato de Compra, Alergenos, Proveedor y Stock, Info Nutricional
- "Nombre" field always visible above tabs (not inside any tab)
- Shared Cerrar + Guardar buttons below all tabs
- Tab 1: 3 unit dropdowns (UC/UA/UR), % Merma, Precio, IVA, Formato/kg, Precio formato, QR, Marca, Codigo de barras
- Tab 2: Dynamic table for purchase formats (add/delete rows)
- Tab 3: 14 allergen clickable chips in grid, hideAllergens checkbox, image upload
- Tab 4: Supplier dropdown, Familia/Subfamilia dependent dropdowns, Stock min/max with red visual
- Tab 5: 12+ nutritional fields with "Valores para 100 gr." header

### Non-Functional

- No external tab library — use existing `@/components/ui/tabs.tsx`
- Tab state = `useState<string>('peso-precio')` — KISS
- Form state in parent modal component; each tab receives props + onChange handlers
- Max 200 lines per component file (per project rules)

## Architecture

### Component Tree

```
ArticulosPage (page.tsx — keeps list/table, ~250 lines)
  └── CreateArticleModal (new component, ~80 lines)
        ├── Nombre field (inline, not in tabs)
        ├── Tabs
        │   ├── TabsList (5 triggers)
        │   ├── TabsContent "peso-precio" → TabPesoPrecio
        │   ├── TabsContent "formato-compra" → TabFormatoCompra
        │   ├── TabsContent "alergenos" → TabAlergenos
        │   ├── TabsContent "proveedor-stock" → TabProveedorStock
        │   └── TabsContent "info-nutricional" → TabInfoNutricional
        └── Cerrar + Guardar buttons
```

### File Structure

```
frontend/src/app/dashboard/articulos/
  page.tsx                              (trimmed — list + filters + table + QR logic)
  components/
    create-article-modal.tsx            (modal shell + form state + tabs layout)
    tab-peso-precio.tsx                 (Tab 1)
    tab-formato-compra.tsx              (Tab 2)
    tab-alergenos.tsx                   (Tab 3)
    tab-proveedor-stock.tsx             (Tab 4)
    tab-info-nutricional.tsx            (Tab 5)
    allergen-chip.tsx                   (single allergen chip component)
    purchase-format-row.tsx             (single row in format table)
```

### Form State Shape (in create-article-modal.tsx)

```ts
interface ArticleFormData {
  // Top-level (always visible)
  name: string;
  // Tab 1: Peso/Precio
  purchaseUnit: string; // UC
  storageUnit: string; // UA
  recipeUnit: string; // UR
  wastePercentage: number;
  purchasePrice: number;
  iva: number;
  formatPerKg: string; // Formato/kg (free text)
  formatPrice: number; // Precio formato
  qr: string;
  brand: string;
  barcode: string;
  // Tab 2: Formato de Compra
  purchaseFormats: Array<{ name: string; format: string; price: number }>;
  // Tab 3: Alergenos
  allergens: number[];
  hideAllergens: boolean;
  imageUrl: string;
  imageFile: File | null; // for upload before save
  // Tab 4: Proveedor y Stock
  supplierId: string;
  parentCategoryId: string;
  categoryId: string; // subcategoria
  minimumStock: number;
  maximumStock: number;
  // Tab 5: Info Nutricional
  nutritionalInfo: {
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
  };
}
```

### Data Flow

```
User fills tabs → formData state in create-article-modal
  → Guardar button:
    1. If imageFile: POST /api/v1/products/:id/image (after product create)
    2. POST /api/v1/products with formData (mapped to CreateProductDto)
    OR
    1. PATCH /api/v1/products/:id with formData (mapped to UpdateProductDto)
    2. If imageFile changed: POST /api/v1/products/:id/image
```

### Tab Implementation Details

**Tab 1: Peso/Precio**

- 3 `<select>` for purchaseUnit, storageUnit, recipeUnit (reuse existing unit options from current form lines 447-454)
- Number inputs for wastePercentage, purchasePrice, iva (default 10)
- Free text input for formatPerKg
- Number input for formatPrice
- Text inputs for qr, brand, barcode
- Layout: 2-column grid for paired fields, full-width for standalone

**Tab 2: Formato de Compra**

- Table header: Nombre del formato | Formato | Precio del formato | (delete)
- Map over `purchaseFormats` array, render `PurchaseFormatRow` per item
- Each row: 3 inputs + delete button (X)
- "Anadir formato" button at bottom: appends empty `{ name: '', format: '', price: 0 }` to array
- Delete button: filters out row by index

**Tab 3: Alergenos**

- Grid of 14 `AllergenChip` components (3-4 columns on desktop, 2 on mobile)
- Each chip: icon + name, toggled state (selected = filled bg, unselected = outlined)
- Click toggles allergen ID in/out of `allergens: number[]`
- Checkbox: "Ocultar en etiquetado" → `hideAllergens`
- File input: accept="image/\*", onChange validates < 2MB before setting imageFile
- Image preview if imageUrl exists

**Tab 4: Proveedor y Stock**

- Supplier dropdown: fetched from dedicated hook (Phase 04) or API endpoint
- Familia dropdown: from `useCategoryTree()` — parent categories
- Subfamilia dropdown: dependent on selected Familia (existing pattern at page.tsx:55-67)
- Stock min/max: number inputs
- Visual: if stock quantity <= minimumStock → red border/text; if >= maximumStock → red border/text
  - Note: stock data fetched from warehouse API or included in product response

**Tab 5: Info Nutricional**

- Header: "Valores para 100 gr."
- 13 number inputs in 2-column grid
- All optional (nullable in state)
- Labels in Spanish: Energia (kJ), Energia (kcal), Grasas, Grasas saturadas, Grasas trans, Grasas monoinsaturadas, Grasas poliinsaturadas, Omega-3, Colesterol, Hidratos de carbono, Azucares, Proteinas, Sal

## Related Code Files

### Modify

- `frontend/src/app/dashboard/articulos/page.tsx` — remove modal JSX, import CreateArticleModal

### Create

- `frontend/src/app/dashboard/articulos/components/create-article-modal.tsx`
- `frontend/src/app/dashboard/articulos/components/tab-peso-precio.tsx`
- `frontend/src/app/dashboard/articulos/components/tab-formato-compra.tsx`
- `frontend/src/app/dashboard/articulos/components/tab-alergenos.tsx`
- `frontend/src/app/dashboard/articulos/components/tab-proveedor-stock.tsx`
- `frontend/src/app/dashboard/articulos/components/tab-info-nutricional.tsx`
- `frontend/src/app/dashboard/articulos/components/allergen-chip.tsx`
- `frontend/src/app/dashboard/articulos/components/purchase-format-row.tsx`

### No Deletions

## Implementation Steps

1. **Create `components/` directory** under `articulos/`

2. **Create `allergen-chip.tsx`** (~40 lines)
   - Props: `allergen: { id, name, icon, color }`, `selected: boolean`, `onToggle: (id: number) => void`
   - Render: button with icon + name, conditional bg color based on selected state
   - Allergen data: import from shared constants file (create `allergens-constants.ts` — copy of ALLERGENS_INFO from backend)

3. **Create `purchase-format-row.tsx`** (~50 lines)
   - Props: `format: { name, format, price }`, `index: number`, `onChange: (index, field, value) => void`, `onDelete: (index) => void`
   - Render: table row with 3 inputs + delete button

4. **Create `tab-peso-precio.tsx`** (~80 lines)
   - Props: formData slice + onChange handlers for each field
   - Render: grid of labeled inputs/selects per spec
   - Unit options: define UNIT_OPTIONS constant (kg, g, l, ml, units, dozen + common Spanish units)

5. **Create `tab-formato-compra.tsx`** (~70 lines)
   - Props: `purchaseFormats` array + `onAddFormat` + `onUpdateFormat` + `onDeleteFormat`
   - Render: table with header, mapped rows, add button

6. **Create `tab-alergenos.tsx`** (~80 lines)
   - Props: `allergens` number[] + `onToggleAllergen` + `hideAllergens` + `onToggleHide` + `imageUrl` + `onImageChange`
   - Render: grid of AllergenChip, checkbox, file input with preview
   - File validation: check file.size < 2MB, check file.type starts with 'image/'

7. **Create `tab-proveedor-stock.tsx`** (~90 lines)
   - Props: supplier list, category tree, stock info, onChange handlers
   - Render: supplier select, familia/subfamilia dependent selects, stock inputs with red styling logic
   - Stock warning logic: `quantity <= minimumStock` or `quantity >= maximumStock` → red border

8. **Create `tab-info-nutricional.tsx`** (~80 lines)
   - Props: nutritionalInfo object + onChange handler
   - Render: header text + 2-column grid of number inputs
   - Define NUTRITIONAL_FIELDS array for DRY rendering: `[{ key: 'energyKj', label: 'Energia (kJ)' }, ...]`

9. **Create `create-article-modal.tsx`** (~100 lines)
   - State: `activeTab`, `formData` (ArticleFormData)
   - Props: `open`, `onClose`, `product?: Product` (for edit mode), `onSave`
   - If product provided → populate formData from product (edit mode)
   - Render: overlay, modal container, Nombre input, Tabs with 5 TabsContent, footer buttons
   - Guardar handler: map formData to CreateProductDto shape, call onSave
   - If imageFile present: call image upload after product save

10. **Update `page.tsx`**
    - Remove modal JSX (lines 402-483)
    - Remove formData state and handlers (move to modal)
    - Import and render `CreateArticleModal`
    - Pass `open={showCreateForm}`, `onClose={resetForm}`, `product={selectedProduct}`, `onSave={handleSave}`
    - Keep list, filters, table, QR logic in page.tsx
    - `handleSave` in page.tsx: calls createProductMutation or updateProductMutation

11. **Create `allergens-constants.ts`** under `components/`
    - Copy ALLERGENS_INFO array from backend `allergens.dto.ts:26-59`
    - This avoids an extra API call; allergen list is static (EU regulation)

## Todo List

- [ ] Create components/ directory
- [ ] Create allergens-constants.ts
- [ ] Create allergen-chip.tsx
- [ ] Create purchase-format-row.tsx
- [ ] Create tab-peso-precio.tsx
- [ ] Create tab-formato-compra.tsx
- [ ] Create tab-alergenos.tsx
- [ ] Create tab-proveedor-stock.tsx
- [ ] Create tab-info-nutricional.tsx
- [ ] Create create-article-modal.tsx
- [ ] Update page.tsx to use modal component
- [ ] Verify all files under 200 lines

## Success Criteria

- 5-tab modal renders correctly in browser
- Tab switching works with local state (no library beyond base-ui)
- Allergen chips toggle on click, show icon + name
- Purchase format table adds/removes rows dynamically
- Dependent familia/subfamilia dropdowns work
- Stock fields show red visual when at limits
- Image file input validates size < 2MB before upload
- Nombre field always visible above tabs
- Cerrar/Guardar buttons work across all tabs
- page.tsx reduced to ~250 lines (list + table + filters)

## Risk Assessment

| Risk                                         | Likelihood | Impact | Mitigation                                                                          |
| -------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------- |
| base-ui Tabs API differs from shadcn/ui      | Medium     | Medium | Already verified tabs.tsx uses base-ui; use Tabs/Tab/Panel API directly             |
| Next.js 16 breaking changes                  | Medium     | High   | Read `node_modules/next/dist/docs/` per AGENTS.md before writing                    |
| Form state synchronization across tabs       | Low        | Medium | Single state object in parent; tabs receive props only — no dual state              |
| Image upload timing (product needs ID first) | Medium     | Medium | Create product first, then upload image; for edit mode, upload then update imageUrl |

## Security Considerations

- File upload: client-side validation (size + MIME type) as UX guard; server validates again (Phase 02)
- No XSS from allergen names (static constants, not user input)
- No SQL injection (Prisma parameterized queries)

## Next Steps

- Phase 04 wires hooks + API calls into these components
