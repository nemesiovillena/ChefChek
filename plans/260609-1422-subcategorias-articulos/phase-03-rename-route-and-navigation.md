## Phase 3: Rename Route and Navigation "Productos" → "Articulos"

**Priority:** P2 | **Status:** [ ] | **Effort:** 1h | **Depends on:** None

### Context Links
- Products page: `frontend/src/app/dashboard/products/page.tsx`
- Dashboard layout (desktop nav): `frontend/src/app/dashboard/layout.tsx:70` ("PRODUCTOS")
- Dashboard layout (mobile nav): `frontend/src/app/dashboard/layout.tsx:135-139` ("Productos")
- Recipes page nav link: `frontend/src/app/dashboard/recipes/page.tsx:225-227`
- Products page internal nav: `frontend/src/app/dashboard/products/page.tsx:187-189`

### Overview
Rename the route folder from `products/` to `articulos/`, update all navigation links and labels, and add a redirect from the old route.

### Key Insights
- Next.js 16 uses App Router — route is defined by folder name under `app/`. Renaming `products/` → `articulos/` changes the URL.
- 4 files contain `/dashboard/products` href links that must update to `/dashboard/articulos`.
- Labels to change: "PRODUCTOS" → "ARTICULOS" (desktop nav), "Productos" → "Articulos" (mobile nav, page titles, breadcrumbs).
- Backend API paths (`/v1/products`) remain unchanged — this is frontend-only.

### Requirements
- Rename `frontend/src/app/dashboard/products/` → `frontend/src/app/dashboard/articulos/`
- Update all `href="/dashboard/products"` → `href="/dashboard/articulos"`
- Rename all "Productos" labels → "Articulos" in navigation and page titles
- Add redirect from `/dashboard/products` to `/dashboard/articulos`

### Architecture — Files Affected

| File | Line(s) | Change |
|------|---------|--------|
| `app/dashboard/products/` | dir | Rename folder to `articulos/` |
| `app/dashboard/layout.tsx` | 70 | "PRODUCTOS" → "ARTICULOS", href |
| `app/dashboard/layout.tsx` | 135 | href="/dashboard/articulos" |
| `app/dashboard/layout.tsx` | 139 | "Productos" → "Articulos" |
| `app/dashboard/articulos/page.tsx` | 187 | Nav link href + label |
| `app/dashboard/articulos/page.tsx` | 204 | "Productos" → "Articulos" |
| `app/dashboard/articulos/page.tsx` | 206 | "Gestión de productos" → "Gestión de artículos" |
| `app/dashboard/recipes/page.tsx` | 225-227 | Nav link href + label |

### Related Code Files
- **Rename:** `frontend/src/app/dashboard/products/` → `frontend/src/app/dashboard/articulos/`
- **Modify:** `frontend/src/app/dashboard/layout.tsx`
- **Modify:** `frontend/src/app/dashboard/recipes/page.tsx`
- **Create:** `frontend/src/app/dashboard/products/page.tsx` (redirect)

### Implementation Steps

1. **Rename the route folder:**
   ```bash
   mv frontend/src/app/dashboard/products frontend/src/app/dashboard/articulos
   ```

2. **Add redirect** at old route — create `frontend/src/app/dashboard/products/page.tsx`:
   ```tsx
   import { redirect } from 'next/navigation';
   export default function ProductsRedirect() {
     redirect('/dashboard/articulos');
   }
   ```

3. **Update dashboard layout** (`layout.tsx`):
   - Line 70: `href="/dashboard/articulos"` + label `"ARTICULOS"`
   - Line 135: `href="/dashboard/articulos"`
   - Line 139: `"Articulos"`

4. **Update articulos page** (`articulos/page.tsx`):
   - Line 187: href + label "Articulos"
   - Line 204: `<h2>Articulos</h2>`
   - Line 206: `"Gestion de articulos"`

5. **Update recipes page** (`recipes/page.tsx`):
   - Line 225-227: href="/dashboard/articulos" + label "Articulos"

### Todo List
- [ ] Rename `products/` folder to `articulos/`
- [ ] Create redirect at `products/page.tsx`
- [ ] Update layout.tsx navigation labels and hrefs
- [ ] Update articulos/page.tsx internal labels
- [ ] Update recipes/page.tsx nav link
- [ ] Verify navigation works on both desktop and mobile

### Success Criteria
- `/dashboard/articulos` loads the articles page
- `/dashboard/products` redirects to `/dashboard/articulos`
- Desktop nav shows "ARTICULOS"
- Mobile nav shows "Articulos"
- No broken links or 404s

### Risk Assessment
| Risk | Mitigation |
|------|-----------|
| Bookmarks to old route break | Redirect handles this |
| Other pages link to products route | Full grep found 4 files — all listed above |

### Rollback
- Rename folder back to `products/`
- Delete redirect file
- Revert label changes

### Next Steps
- Phase 4 (rewrite page with chained filters) modifies the renamed articulos/page.tsx
