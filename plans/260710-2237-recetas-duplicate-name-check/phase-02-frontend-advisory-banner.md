---
phase: 2
title: "Frontend: hook useRecipeNameCheck + banner advisory en el modal de receta"
status: pending
priority: P2
dependencies: [1]
---

# Phase 2: Frontend — hook useRecipeNameCheck + banner advisory

## Overview
Clonar `useProductNameCheck` en `useRecipeNameCheck` (endpoint `/v1/recipes/check-name`) y añadir un banner advisory no-bloqueante bajo el input de nombre del formulario de receta (inline en `recipes/page.tsx`).

## Requirements
- Functional: al escribir el nombre, aviso accent-insensitive (exacto+contiene) de recetas existentes; no bloquea Guardar; excluye la propia receta al editar.
- Non-functional: debounce 350ms, cancelación en unmount, sin setState síncrono en el effect (regla lint `react-hooks/set-state-in-effect`).

## Architecture
Réplica de `use-product-name-check.ts` (commit `4f7cc87`): patrón `useCallback(checkName) + setTimeout`, estado `matches`/`loading`. El interceptor global de apiClient desenvuelve `{success,data}` → `res.data` es el array de coincidencias. El banner es JSX inline (mismo estilo ámbar + `role="status"` + marca `(inactivo)`) bajo el input nombre.

## Related Code Files
- Create: `frontend/src/hooks/use-recipe-name-check.ts` (clon de `use-product-name-check.ts`, URL `/v1/recipes/check-name`)
- Modify: `frontend/src/app/dashboard/recipes/page.tsx` (import del hook, llamada, banner tras l.~770)
- Reference (patrón): `frontend/src/hooks/use-product-name-check.ts` y `articulo-modal.tsx` (banner)

## Implementation Steps
1. Crear `frontend/src/hooks/use-recipe-name-check.ts` = copia de `use-product-name-check.ts` cambiando: URL `/v1/products/check-name` → `/v1/recipes/check-name`, tipo exportado `RecipeNameMatch`. **Mantener el patrón `useCallback`+`setTimeout`** (es lo que hace pasar la regla de lint).
2. En `recipes/page.tsx`: importar `useRecipeNameCheck`. Llamarlo con `useRecipeNameCheck(formData.name, selectedRecipe?.id)` (excluye la propia al editar; `selectedRecipe` existe — ver l.703).
3. Insertar el banner advisory **justo después del `<input ... value={formData.name}>` (l.~770)**, antes de su `</div>` contenedor. Reusar el JSX del banner de `articulo-modal.tsx` (`role="status"`, lista de hasta 3, sufijo `(inactivo)` si `!m.isActive`, texto "Puedes continuar si es una receta distinta").
   - ⚠️ **NO** insertar en el input de la l.489 — ese es el **filtro de búsqueda** del listado, no el formulario.
4. Typecheck: `cd frontend && npx tsc --noEmit` (0 errores).
5. ESLint: `npx eslint src/hooks/use-recipe-name-check.ts src/app/dashboard/recipes/page.tsx` (debe pasar — el pre-commit hook lo exigirá).
6. Verificar en navegador: crear/editar receta con nombre existente o contenido → aparece el banner; Guardar sigue habilitado.

## Success Criteria
- [ ] Al escribir un nombre de receta existente/parecido → banner ámbar con el nombre.
- [ ] No bloquea Guardar (botón no se deshabilita por matches).
- [ ] Al editar una receta, no se avisa de sí misma.
- [ ] `tsc --noEmit` = 0; eslint = 0.
- [ ] El banner NO aparece en el filtro de búsqueda (l.489), solo en el formulario.

## Risk Assessment
- **Regla lint `react-hooks/set-state-in-effect`** → el commit de artículos ya falló por esto; mitigación: patrón `useCallback`+`setTimeout` (no setState síncrono en el effect).
- **Inserción en el input equivocado** (filtro vs formulario) → mitigación: anclar en `value={formData.name}` de l.767, no en el `placeholder="Nombre o descripción"` de l.489.
- **`page.tsx` grande e inline** → inserción cuidadosa; confirmar el cierre `</div>` correcto del campo nombre.
