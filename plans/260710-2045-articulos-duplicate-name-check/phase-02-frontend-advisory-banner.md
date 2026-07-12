# Fase 2 — Hook + aviso advisory en el modal

## Contexto
Interceptor apiClient desenvuelve `{success,data}` no-paginada → `res.data` es el array de matches. Patrón de hook existente: `use-product-search.ts` (debounce + useEffect + apiClient). Modal `articulo-modal.tsx` usa clases Tailwind con `dark:` y prop `article?: Product | null` (id disponible al editar).

## Archivos
- `frontend/src/hooks/use-product-name-check.ts` — nuevo hook (mirror de use-product-search)
- `frontend/src/app/dashboard/articulos/components/articulo-modal.tsx` — banner no-bloqueante bajo el input `name`

## Implementación
### Hook `useProductNameCheck(name, excludeId?, debounceMs=350)`
- Si `name.trim().length < 2` → `matches=[]`.
- Debounce → `GET /v1/products/check-name?name=&excludeId=` → `setMatches(res.data || [])`.
- Cancela en cleanup.

### Modal
- `const { matches } = useProductNameCheck(formData.name, article?.id);`
- Banner bajo el input (solo si `matches.length>0`): amber, estilo local con `dark:`.
  Texto: "Posible duplicado — ya existe: «{m.name}»" (lista hasta 3).
- **No** deshabilita Guardar. Solo informativo.

## Validación
- `npx tsc --noEmit` (o build) frontend OK.
- Manual: crear nombre existente → aviso; editar mismo artículo → no avisa de sí mismo; ignora acentos/mayúsculas.

## Rollback
Revertir hook + 1 sección del modal.
