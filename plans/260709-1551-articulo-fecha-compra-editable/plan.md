---
title: "Fecha de Última Compra editable inline en Artículos"
description: "Click sobre la celda 'Última Compra' del listado de artículos para editar una fecha manual persistida, con precedencia por fecha más reciente vs. albarán."
status: done
priority: P2
effort: 3h
branch: develop
tags: [backend, frontend, products, prisma, ux]
created: 2026-07-09
---

# Fecha de Última Compra editable inline en Artículos

## Objetivo

Hacer la celda "Última Compra" del listado `/dashboard/articulos` clickeable para editar
una fecha manual (`manualPurchaseDate`). La fecha mostrada = **la más reciente** entre la
fecha del último albarán y la fecha manual (no prioridad fija). Indicador visual del origen
que ganó (`albarán` vs `manual`). Sin tocar el modal de artículo, sin endpoint nuevo.

## Diseño (decidido, no renegociar)

1. Campo persistido `Product.manualPurchaseDate DateTime?` (nullable) + migración Prisma additiva.
2. `manualPurchaseDate` opcional en `UpdateProductDto`; persistir vía `PATCH /products/:id` existente.
3. Precedencia en `products.service.ts` (`findAll` + `findOne`): `lastPurchaseDate = max(albaranDate, manualPurchaseDate)`; si solo una, esa; si ninguna, `null`.
4. Exponer `purchaseDateSource: 'albaran' | 'manual' | null` en la respuesta.
5. Frontend: celda SIEMPRE editable (tenga o no albarán); `<input type="date">` nativo; onBlur/Enter dispara mutation; invalida cache; indicador de origen.
6. Verificar export CSV y orden/filtro por fecha siguen funcionando (mismo campo `lastPurchaseDate`).

## Fases

| # | Fase | Módulo | Depende de | Estado |
|---|------|--------|-----------|--------|
| 01 | [Backend: campo, migración, DTO, precedencia](phase-01-backend-manual-purchase-date.md) | `backend/` | — | done |
| 02 | [Frontend: celda editable inline + indicador](phase-02-frontend-inline-edit-cell.md) | `frontend/` | Fase 01 | done |

Ejecución **secuencial**: la Fase 02 consume `manualPurchaseDate` + `purchaseDateSource`
que expone la Fase 01. Sin solapamiento de ficheros entre fases (módulos distintos).

## Flujo de datos

```
[input type=date "YYYY-MM-DD"]
  → useUpdateProduct().mutate({ id, manualPurchaseDate })
  → PATCH /api/v1/products/:id  (UpdateProductDto)
  → products.service.update(): data.manualPurchaseDate = value ? new Date(value) : null
  → Prisma UPDATE products.manualPurchaseDate
  → invalidateQueries(['products'])  (useCrud.useUpdate ya lo hace)
  → GET /api/v1/products (findAll)
      lastPurchaseDate = max(albaranDate, manualPurchaseDate)
      purchaseDateSource = 'albaran' | 'manual' | null
  → celda re-renderiza con fecha + indicador
```

## Criterios de aceptación

- [x] Producto sin albarán: fecha editable, guarda `manualPurchaseDate`, se muestra con indicador "manual".
- [x] Producto con albarán: fecha manual **más reciente** que el albarán gana e indica "manual".
- [x] Llega albarán más reciente que la manual → vuelve a mostrarse la del albarán automáticamente, indicador "albarán".
- [x] Poder limpiar la fecha manual (input vacío → `null`) sin romper la precedencia.
- [x] Export CSV y orden por "Última Compra" siguen funcionando sin cambios de comportamiento.
- [x] Modal de artículo intacto (no se toca `articulo-modal.tsx`).
- [x] Sin errores nuevos de lint/typecheck/build en backend ni frontend.

## Resultado

Implementado y verificado (curl + navegador real vía agent-browser). Code review (`code-reviewer`)
encontró un hallazgo crítico: `commitDate` comparaba contra `manualPurchaseDate` crudo en vez del
valor sembrado al abrir el editor, causando una escritura fantasma de `manualPurchaseDate` al
abrir/cerrar la celda sin cambios reales en productos con fecha derivada de albarán (bug latente:
se activaría al llegar un albarán más antiguo/corregido después). Corregido capturando el valor
sembrado en `dateDraftOriginal` y comparando contra ese. Verificado de nuevo tras el fix (sin
escritura fantasma, flujo normal intacto). También se eliminó un `@ValidateIf` muerto en el DTO
(`@IsOptional()` ya cubre `null`/`undefined`). Informe completo:
`reports/code-reviewer-260709-1627-inline-edit-fecha-compra-report.md`.

Dos hallazgos "Medium" del review (guard `ModuleGuard`/`@RequireModule` en `products.controller.ts`
y un fix preexistente de `unitSize` en `products.service.ts`) son diff ya presente en el working
tree **antes** de esta tarea, de una iniciativa de module-gating en curso — no introducidos por
este cambio, no tocados.

## Riesgos

| Riesgo | Prob×Imp | Mitigación |
|--------|----------|-----------|
| Prisma rechaza string date-only en campo `DateTime` | Alta×Media | Convertir en el service: `new Date(dto.manualPurchaseDate)`, NO pasar el string crudo. |
| Migración aplicada en BD equivocada (dos Postgres dev :5432/:5433) | Media×Alta | Aplicar migración en la BD que usa el :3001 activo; verificar con `\d products`. Ver memoria `two-postgres-databases-dev`. |
| Desfase de zona horaria: "YYYY-MM-DD" → UTC medianoche muestra día anterior | Media×Baja | Consistente con cómo albaranes guardan fecha (mismo `IsDateString`). Documentar; si molesta, anclar a mediodía local. |
| Backend corre desde `dist` (no watch) | Alta×Baja | `npm run build` + relanzar `start:prod` tras cambios. Ver memoria `backend-dist-mode-not-watch`. |

## Rollback

- Fase 02: revertir cambios en `page.tsx` + `use-products.ts` (aditivos, sin migración de datos).
- Fase 01: la columna `manualPurchaseDate` es nullable y additiva; revertir requiere migración inversa (`DROP COLUMN`). Ningún dato existente se pierde al revertir (solo se pierden fechas manuales introducidas). Cumple regla cero-pérdida: acción destructiva solo con confirmación.

## Fuera de alcance

- Editar la fecha desde el modal de artículo.
- Historial de fechas manuales.
- IVA/PVP, refactors no relacionados, nuevas abstracciones (YAGNI/KISS/DRY).
