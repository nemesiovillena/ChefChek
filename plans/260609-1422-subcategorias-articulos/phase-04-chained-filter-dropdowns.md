## Phase 4: Rewrite Articles Page with Chained Category Filters

**Priority:** P2 | **Status:** [ ] | **Effort:** 2h | **Depends on:** Phase 2, Phase 3

### Context Links
- Articles page: `frontend/src/app/dashboard/articulos/page.tsx` (renamed in Phase 3)
- Category tree hook: `frontend/src/hooks/use-categories.ts:66-68` (implemented in Phase 2)
- Products hook: `frontend/src/hooks/use-products.ts`
- API types: `frontend/src/types/api.types.ts`

### Overview
Replace the flat category dropdown with chained dropdowns: [Categoria] → [Subcategoria] → [Proveedor] → [Busqueda]. Subcategoria dropdown is disabled until a parent category is selected, then shows only children of the selected category.

### Key Insights
- Current filter at `products/page.tsx:156-164` extracts unique `categoryId` values from product data and displays raw IDs in the dropdown — not useful.
- Current filter logic at line 156-161: `matchesCategory = !selectedCategory || product.categoryId === selectedCategory` — only filters by one category ID. Needs to also filter by subcategory.
- `useCategoryTree()` from Phase 2 returns parent categories with `children` arrays. This provides both the parent list and child lookup.
- Product `categoryId` maps to a subcategory (after Phase 1 seed). Filtering by parent means: "product.categoryId is in parent.children[].id". Filtering by subcategory means: "product.categoryId === selectedSubcategory".
- Current page is a single 592-line file. Keep it as-is but refactor the filter section. Do NOT over-modularize — YAGNI.

### Requirements
- Add `useCategoryTree()` call to the page component
- Replace single "Categoria" dropdown with two chained dropdowns
- Subcategoria dropdown is disabled when no parent category selected
- When parent category selected, subcategoria shows its children
- Filtering: parent category matches products whose categoryId is in children; subcategory matches exactly
- "Todas" option clears the respective filter
- Selecting a new parent clears the subcategory selection

### Architecture — Data Flow

```
useCategoryTree() → treeData: CategoryTreeNode[]
  ├─ Parent dropdown: treeData.map(cat => { value: cat.id, label: cat.name })
  └─ Subcategory lookup: treeData.find(c => c.id === selectedParent)?.children ?? []
       └─ Subcategory dropdown: children.map(sub => { value: sub.id, label: sub.name })

useProducts() → productsData
  └─ filteredProducts filter logic:
       ├─ matchesSearch: product.name.includes(searchTerm)
       ├─ matchesCategory: !selectedParent || product.categoryId in parentChildrenIds
       └─ matchesSubcategory: !selectedSubcategory || product.categoryId === selectedSubcategory
```

### Related Code Files
- **Modify:** `frontend/src/app/dashboard/articulos/page.tsx`

### Implementation Steps

1. **Add imports** at top of file:
   ```ts
   import { useCategoryTree, CategoryTreeNode } from '@/hooks/use-categories';
   ```

2. **Add useCategoryTree call** in component body:
   ```ts
   const { data: categoryTree, isLoading: categoriesLoading } = useCategoryTree();
   const tree: CategoryTreeNode[] = Array.isArray(categoryTree) ? categoryTree : [];
   ```

3. **Add subcategory state**:
   ```ts
   const [selectedParentCategory, setSelectedParentCategory] = useState('');
   const [selectedSubcategory, setSelectedSubcategory] = useState('');
   ```

4. **Remove** old `selectedCategory` state (line 28).

5. **Derive subcategory options** from selected parent:
   ```ts
   const selectedParentData = tree.find(c => c.id === selectedParentCategory);
   const subcategories = selectedParentData?.children ?? [];
   ```

6. **Derive parent children IDs** for product filtering:
   ```ts
   const parentChildrenIds = selectedParentData?.children.map(c => c.id) ?? [];
   ```

7. **Update filter logic** (replace lines 156-161):
   ```ts
   const filteredProducts = products.filter((product: Product) => {
     const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
     const matchesParentCategory = !selectedParentCategory || parentChildrenIds.includes(product.categoryId || '');
     const matchesSubcategory = !selectedSubcategory || product.categoryId === selectedSubcategory;
     const matchesSupplier = !selectedSupplier || product.supplierId === selectedSupplier;
     return matchesSearch && matchesParentCategory && matchesSubcategory && matchesSupplier;
   });
   ```

8. **Replace category dropdown** in filters section (lines 232-248) with two dropdowns:
   ```tsx
   <div>
     <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
     <select
       value={selectedParentCategory}
       onChange={(e) => {
         setSelectedParentCategory(e.target.value);
         setSelectedSubcategory(''); // Clear subcategory when parent changes
       }}
       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
     >
       <option value="">Todas</option>
       {tree.map((cat) => (
         <option key={cat.id} value={cat.id}>{cat.name}</option>
       ))}
     </select>
   </div>
   <div>
     <label className="block text-sm font-medium text-gray-700 mb-1">Subcategoria</label>
     <select
       value={selectedSubcategory}
       onChange={(e) => setSelectedSubcategory(e.target.value)}
       disabled={!selectedParentCategory}
       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
     >
       <option value="">Todas</option>
       {subcategories.map((sub) => (
         <option key={sub.id} value={sub.id}>{sub.name}</option>
       ))}
     </select>
   </div>
   ```

9. **Update category display in table** (line 313): Currently shows raw `categoryId`. Replace with lookup:
   ```ts
   const getCategoryName = (id: string | undefined) => {
     if (!id) return '-';
     for (const parent of tree) {
       if (parent.id === id) return parent.name;
       const child = parent.children?.find(c => c.id === id);
       if (child) return child.name;
     }
     return id; // Fallback to raw ID
   };
   ```
   Then in table cell: `{getCategoryName(product.categoryId)}`

10. **Remove** old category/supplier derivation from product data (lines 163-164). Categories now come from `useCategoryTree`. Suppliers can still derive from products for now (or use a suppliers hook if available).

11. **Update grid layout** from `grid-cols-4` to `grid-cols-1 md:grid-cols-5` to accommodate the extra dropdown.

### Todo List
- [ ] Add useCategoryTree import and call
- [ ] Replace selectedCategory with selectedParentCategory + selectedSubcategory states
- [ ] Derive subcategory options from selected parent
- [ ] Update filter logic for parent/subcategory matching
- [ ] Replace category dropdown with two chained dropdowns
- [ ] Add getCategoryName helper for table display
- [ ] Update grid layout for 5 columns
- [ ] Handle loading state for categories

### Success Criteria
- Parent category dropdown shows all 7 parent categories from seed data
- Subcategory dropdown is disabled until parent selected
- Selecting a parent populates subcategory dropdown with its children
- Selecting a subcategory filters products to that exact subcategory
- Selecting only a parent shows all products in any of its subcategories
- Table shows category name, not raw ID
- Changing parent clears subcategory selection

### Risk Assessment
| Risk | Mitigation |
|------|-----------|
| Category tree loading is slow | Show loading spinner; tree is small (7+30 items), should be fast |
| Product has categoryId pointing to parent, not child | Phase 1 seed ensures products reference subcategories; if legacy data has parent IDs, filter still works (parentChildrenIds won't match, but `matchesSubcategory` won't exclude either if no subcategory selected) |
| getCategoryName scan is O(n) per row | With ~37 categories total, this is negligible. No optimization needed. |

### Next Steps
- Phase 5 adds subcategory field to the create/edit modal (same page file)
