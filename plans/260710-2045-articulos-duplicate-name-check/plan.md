# Detección de artículos duplicados por nombre (advisory)

## Estado
✅ Hecho y verificado (E2E + code-review DONE_WITH_CONCERNS, M1+L1 resueltos, L2 no-action).

## Objetivo
Al crear/editar un artículo, avisar en el modal si ya existe un artículo con el mismo nombre (ignorando mayúsculas, espacios y acentos). **Advisory-only**: no bloquea guardar; el usuario decide.

## Decisiones (fijadas con el usuario)
- **Backend**: NO bloquea. No 409, no índice único. `create`/`update`/`bulk` intactos.
- **Matching**: `trim + lower + accent-folding` (Spanish: `Tomate` = `Tomáte` = `JAMÓN`).
- **Alcance**: crear y editar (editar excluye el propio id). Solo productos activos (no papelera).

## Fases
- `phase-01-backend-check-name-endpoint.md` — endpoint `GET /products/check-name`
- `phase-02-frontend-advisory-banner.md` — hook + aviso no-bloqueante en el modal

## Criterios de aceptación
1. Al escribir un nombre que ya existe (activo, mismo tenant) → aparece aviso con el nombre existente.
2. Funciona sin distinguir mayúsculas/espacios/acentos (`Tomate` avisa si existe `Tomáte `).
3. Al editar un artículo, no avisa de sí mismo.
4. El botón Guardar **siempre** está habilitado (no bloquea).
5. Vías API/bulk siguen permitiendo duplicados (decisión explícita del usuario).
6. Build backend OK + typecheck frontend OK; sin regresiones.

## Touchpoints
- `backend/src/modules/products/products.service.ts` (nuevo método, sin tocar create/update)
- `backend/src/modules/products/products.controller.ts` (nueva ruta ANTES de `:id`)
- `frontend/src/hooks/use-product-name-check.ts` (nuevo)
- `frontend/src/app/dashboard/articulos/components/articulo-modal.tsx` (banner)

## Riesgos / rollback
- Cambio additive, sin migración, sin datos. Rollback = revertir los 4 archivos.
- Gotcha routing NestJS: `check-name` debe declararse antes de `@Get(":id")`.
- Gotcha interceptor apiClient: respuesta `{success,data}` no-paginada se desenvuelve → `res.data` es el array de matches.
