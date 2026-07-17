---
title: "Histórico de precios normalizado €/kg (fix badge de variación falsa)"
description: "Comparar precio normalizado €/kg en el histórico en vez de purchasePrice crudo, para no generar variaciones falsas al cambiar el tamaño de caja"
status: done
priority: P2
effort: 4h
branch: develop
tags: [backend, frontend, prisma, products, price-history, bugfix]
created: 2026-07-18
completed: 2026-07-18
---

## Problema

El badge de "Histórico de Precios" muestra variaciones falsas (ej. jarrete de cordero
-77,8%) porque compara `purchasePrice` crudo (precio de la caja/formato) entre compras.
Cuando cambia el tamaño de caja (`unitSize`) pero el €/kg real es igual o similar, el
sistema reporta un cambio inexistente. El precio normalizado €/kg ya existe
(`getReferencePrice = purchasePrice / unitSize`) pero nunca se aplica al histórico.

## Solución (decisiones ya cerradas por el usuario)

1. Trigger del histórico pasa de "¿cambió `purchasePrice` crudo?" a "¿cambió €/kg
   normalizado?" en los 4 write-sites.
2. Snapshot de `unitSize` (antes/después) en cada fila nueva de `ProductPriceHistory`
   vía 2 columnas nullable nuevas.
3. Frontend calcula `pct` sobre precio normalizado cuando ambos `unitSize` existen;
   fallback al cálculo crudo actual para filas legacy (sin marca, sin ocultar).
4. Reutilizar `getReferencePrice` (backend `unit-conversions.ts`, frontend
   `use-products.ts`) — DRY, no reimplementar la división inline.

## Fases

| # | Fase | Estado | Depende de | Owner (archivos) |
|---|------|--------|-----------|------------------|
| 01 | [Backend: migración + snapshot unitSize en 4 write-sites + endpoint/listado](phase-01-backend-migration-snapshot-normalized-trigger.md) | done | — | `backend/prisma/*`, `backend/src/modules/products/*`, `backend/src/modules/albaranes/services/albaran-stock.service.ts` |
| 02 | [Frontend: cálculo normalizado en badge/tabla/gráfico + tipos](phase-02-frontend-normalized-price-variation.md) | done | 01 (contrato del endpoint) | `frontend/src/hooks/use-product-price-history.ts`, `frontend/src/hooks/use-products.ts`, `frontend/src/components/products/product-price-*.tsx`, `frontend/src/app/dashboard/articulos/page.tsx` |

Fases secuenciales por dependencia de contrato: el frontend (02) consume los campos
nuevos que expone el backend (01). No hay solapamiento de archivos entre fases → sin
riesgo de edición paralela, pero 02 no debe empezar antes de fijar el shape de 01.

## Grafo de datos

```
Write-site (4)  →  ProductPriceHistory.create({ previousPrice, newPrice,
                     previousUnitSize, newUnitSize })   [snapshot unitSize vigente]
                        │
                        ▼
     getProductPriceHistory()  →  endpoint /v1/products/price-history
     findAll() listado         →  product.latestPriceChange (embebido)
                        │
                        ▼
     badge / tabla / gráfico  →  pct = normalizado si ambos unitSize; si no, crudo
```

## Criterios de aceptación

1. Migración Prisma añade `previousUnitSize Float?` y `newUnitSize Float?` a
   `ProductPriceHistory`, NULLABLE, sin tocar filas existentes ni requerir reset.
2. Los 4 write-sites snapshotean `unitSize` antes/después y disparan la fila usando
   €/kg normalizado (con guardia contra división por 0/null/undefined).
3. Badge, tabla y gráfico calculan la variación % sobre precio normalizado cuando
   ambos `unitSize` existen; fallback idéntico al de hoy para filas legacy.
4. Prueba manual: mismo €/kg con distinto tamaño de caja → sin badge (≈0%); €/kg
   realmente distinto → badge coherente.
5. Sin regresión en `products.service.spec.ts`,
   `product-supplier-offers.service.spec.ts`, `albaran-stock.service.spec.ts`.
6. Sin ruptura de contrato público: campos nuevos son aditivos/opcionales.

## Fuera de alcance (NO tocar)

- `priceAgreementService.evaluateAndRecord` / `albaran-stock.service.ts:171-194`
  (precios pactados con proveedor — comparan precio crudo de línea a propósito).
- `Product.previousPurchasePrice` / `ProductSupplierOffer.previousPurchasePrice`
  (campos planos usados en otros flujos).
- Backfill retroactivo de filas legacy (no hay dato de `unitSize` histórico).

## Verificación (recordatorio de entorno)

Backend corre desde `dist`, no watch (memoria `backend-dist-mode-not-watch`): tras
tocar backend hay que `npm run build` + relanzar el proceso `start:prod` antes de
probar. Migración: `npx prisma migrate dev` en la BD que usa el `:3001` activo (hay
dos Postgres en dev, memoria `two-postgres-databases-dev`).

## Resultado (2026-07-18)

Implementado tal cual el plan, con un ajuste surgido del code review obligatorio:
`referencePriceChanged()` (`unit-conversions.ts` backend, `use-products.ts` frontend)
usa tolerancia epsilon (0.5% relativo) en vez de comparación exacta `!==` — sin esto,
el ruido de redondeo al introducir precio/cantidad con precisión limitada podía
reintroducir el mismo bug a menor escala (confirmado con un test que reproduce el
caso real: 80,91€/6,5kg vs 49,79€/4kg, mismo €/kg real, diferencia de solo 0,0002€
por redondeo). Tests: 77/80 specs backend tocados en verde (3 nuevos), suite completa
backend 1503/1504 (1 fallo preexistente y no relacionado en
`albaranes.controller.spec.ts`, módulo de alias de proveedor en desarrollo aparte —
confirmado sin cambios míos en esos archivos). `tsc --noEmit` limpio en backend y
frontend. Sin cambios en `docs/` (fix interno, no cambia contratos públicos ni
workflows documentados).
