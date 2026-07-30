---
title: Badge de variación de precio en Líneas de albarán
description: >-
  Badge ↑/↓ entre las columnas Total y Match de la pestaña Líneas: compara el
  precio efectivo de la línea contra el precio vigente del artículo
  (matchedProduct.purchasePrice), antes de confirmar
status: completed
priority: P3
branch: main
tags:
  - frontend
  - albaranes
  - price-history
  - ui
blockedBy: []
blocks: []
created: '2026-07-30T15:45:53.215Z'
createdBy: 'ck:plan'
source: skill
---

# Badge de variación de precio en Líneas de albarán

## Overview

En la pestaña **Líneas** de un albarán (`frontend/src/app/dashboard/albaranes/[id]/lineas/page.tsx`),
añadir un badge ↑/↓ que compare el precio efectivo de cada línea (ya emparejada a un
artículo) contra el `purchasePrice` **vigente** de ese artículo — el precio que hay en
ficha antes de confirmar este albarán. Rojo = sube, verde = baja (misma convención que
`ProductPriceTrendBadge` en Artículos). Colocado entre las columnas **Total** y **Match**.

**Semántica decidida con el usuario:** comparación contra el precio vigente del artículo
(`matchedProduct.purchasePrice`), NO contra el último `ProductPriceHistory`. Motivo: el
histórico solo se escribe al **confirmar** una compra, así que en un albarán PENDIENTE
mostraría el cambio de la última compra ya confirmada — no si ESTA línea (sin confirmar
todavía) sube o baja respecto a lo que hay ahora. La comparación contra el precio vigente
es un preview exacto (WYSIWYG) de lo que pasará si el usuario pulsa "Confirmar": mismo
dato (`product.purchasePrice`) y misma fórmula de precio efectivo de línea
(`applyDiscountToCost`) que usa `AlbaranStockService` al escribir el precio real.

**Sin cambios de backend.** `GET /albaranes/:id` (`albaranes.service.ts:136-156`) ya
incluye `matchedProduct: true` (include de Prisma sin `select`), lo que devuelve **todas**
las columnas del `Product`, incluido `purchasePrice` — el dato ya viaja en la respuesta
HTTP hoy. El único gap es que el tipo `AlbaranLine.matchedProduct` en el frontend
(`api-albaran.ts:29`) lo declara con solo `{id, name, netPrice, discountPercentage}`, así
que TypeScript no deja usar `purchasePrice` aunque esté en el JSON. Ampliar el tipo basta.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Tipar matchedProduct.purchasePrice](./phase-01-tipar-matchedproduct-purchaseprice.md) | Completed |
| 2 | [Badge de variación entre Total y Match](./phase-02-badge-de-variaci-n-entre-total-y-match.md) | Completed |

## Dependencies

Ninguna. No bloquea ni depende de otros planes activos. Contexto relacionado (ya
completados, sin overlap de archivos):
- `plans/260722-1747-albaran-line-net-discount` — introdujo `line.totalPrice` /
  `albaran.applyDiscountToCost` y la celda "Total" con badge de descuento, justo a la
  izquierda de donde se inserta este badge nuevo. Este plan reutiliza esos mismos campos.
- `plans/260718-0056-historico-precio-normalizado-kg` — creó `ProductPriceTrendBadge` /
  `normalizePrice` (Artículos). Se usa como referencia visual (colores, iconos), NO se
  reutiliza el componente en sí porque la semántica de comparación es distinta (ver
  Overview).

## Acceptance Criteria

- [ ] En la tabla de Líneas, entre "Total" y "Match", aparece un badge ↑X,X% (rojo) o
      ↓X,X% (verde) cuando la línea tiene `matchedProduct` con `purchasePrice > 0` y el
      precio efectivo de la línea difiere en más de un 0,5% relativo.
- [ ] Sin badge (celda vacía) cuando: no hay `matchedProduct`, `purchasePrice` es
      `null`/`0`, o la diferencia es ≤ 0,5%.
- [ ] El precio efectivo de línea usado para comparar reproduce exactamente la fórmula de
      `AlbaranStockService` (`totalPrice/quantity` si `applyDiscountToCost` está activo y
      hay `totalPrice`; si no, `unitPrice` bruto).
- [ ] `npx tsc --noEmit` (frontend) sin errores nuevos.
- [ ] Verificado visualmente en el navegador con un albarán real que tenga líneas con
      precio más alto y más bajo que el vigente.

## Open Questions

Ninguna — semántica de comparación confirmada por el usuario antes de escribir este plan
(precio vigente del artículo, no histórico).
