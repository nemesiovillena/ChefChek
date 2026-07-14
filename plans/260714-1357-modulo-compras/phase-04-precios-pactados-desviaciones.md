---
phase: 4
title: "Precios pactados por oferta y panel de desviaciones con notificación instantánea"
status: pending
---

## Context

- `ProductSupplierOffer` (schema ~L221): oferta por producto-proveedor con `isPreferred`; se upserta al confirmar albarán
- Notificación existente: `notifyPriceChange` en [albaran-stock.service.ts](../../backend/src/modules/albaranes/services/albaran-stock.service.ts) (dispara con cambio >10% → `NotificationsService` → tabla `Alert`)
- Config global por tenant: `Configuration` (patrón `costing-config`)
- PDR §F5

## Requirements

1. Campos `agreedPrice?/agreedAt?/agreedUntil?` en `ProductSupplierOffer` (aditivo). Edición desde la ficha de oferta (UI proveedor/artículo existente) y desde el módulo compras.
2. Detección: al confirmar albarán (y al aplicar catálogo en fase 5), si `precioRecibido > agreedPrice × (1 + tolerancia)` → notificación instantánea (reutilizar `NotificationsService`/`Alert`, tipo propio `PRICE_AGREEMENT_DEVIATION`) y registro de desviación.
3. Tolerancia % global por tenant en `Configuration` (default 0%).
4. Panel "Desviaciones" en compras: artículo, proveedor, pactado vs recibido, %, fecha, albarán/pedido origen; estado gestionable (pendiente/reclamada/resuelta) con nota.
5. `GET /v1/compras/desviaciones` con filtros (proveedor, estado, fechas).

## Files to modify

- `backend/prisma/schema.prisma` + migración aditiva — campos en `ProductSupplierOffer`; modelo `PriceDeviation` (tenantId, offerId, albaranId?, purchaseOrderId?, agreedPrice, receivedPrice, status enum, note, deletedAt) — tabla propia para histórico gestionable
- `backend/src/modules/compras/services/price-agreement.service.ts` (+ spec): detección + CRUD de desviaciones + tolerancia
- `backend/src/modules/albaranes/services/albaran-stock.service.ts` — invocar detección en el mismo punto que `notifyPriceChange`
- `backend/src/modules/products/` — DTO de oferta acepta `agreedPrice/agreedAt/agreedUntil`
- `frontend/src/app/dashboard/compras/components/price-deviation-panel.tsx` + hook `use-price-deviations.ts`
- UI de oferta (artículos, pestaña proveedor / gestión de ofertas) — input de precio pactado + vigencia
- Settings — tolerancia % global

## Steps

1. Migración aditiva; decidir y anotar: campos sobre oferta (KISS, elegido) vs tabla de acuerdos con histórico (descartado salvo necesidad de vigencias múltiples).
2. Servicio de detección puro y testeable (`detectDeviation(offer, receivedPrice, tolerance)`), llamado desde confirmación de albarán y expuesto para fase 5.
3. Notificación con mensaje accionable ("Salmón: pactado 10,40€ / recibido 12,00€ (+15,4%) — Albarán ALB-23").
4. Panel frontend con filtros y cambio de estado (`useConfirm()` no necesario: no destructivo).
5. Build + relanzar dist; caso de prueba end-to-end con albarán manual.

## Checking (criterios de aceptación)

- [ ] Fijar pactado 10€, confirmar albarán a 12€ → notificación instantánea + fila en panel con +20%
- [ ] Precio dentro de tolerancia (p. ej. tolerancia 5%, recibido 10,40€) → NO genera desviación
- [ ] `agreedUntil` pasado → no evalúa (pacto caducado)
- [ ] Cambio de estado de desviación persiste (pendiente→reclamada→resuelta) con nota
- [ ] Oferta sin `agreedPrice` → comportamiento actual intacto (solo aviso >10% existente)
- [ ] Filtros del panel correctos; tenant-scoped
- [ ] Specs pasan; sin errores TS; regresión de confirmación de albarán OK
- [ ] Informe en `reports/sprint-4-checking-report.md`
