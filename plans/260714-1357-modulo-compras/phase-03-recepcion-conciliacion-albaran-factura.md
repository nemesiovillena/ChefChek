---
phase: 3
title: "Recepción: conciliación pedido↔albarán, discrepancias y factura mínima"
status: pending
---

## Context

- Pipeline albaranes: [albaranes/](../../backend/src/modules/albaranes/) — al CONFIRMAR asienta stock/precios ([albaran-stock.service.ts](../../backend/src/modules/albaranes/services/albaran-stock.service.ts)); estados PENDIENTE→REVISADO→CONFIRMADO→ARCHIVADO
- `AlbaranLine.matchedProductId` ya enlaza líneas con productos
- `Invoice` stub plano en schema (~L613) — se reutiliza enriqueciéndolo mínimamente, sin módulo completo
- PDR §F4

## Requirements

1. `Albaran.purchaseOrderId?` (FK opcional, aditivo). Al subir/revisar un albarán, sugerir pedidos ENVIADOS del mismo proveedor (±7 días) y permitir vincular manualmente.
2. Conciliación al CONFIRMAR albarán vinculado: por producto, volcar `receivedQuantity/receivedPrice` a `PurchaseOrderLine`; pedido → RECIBIDO (todas las líneas cubiertas) o RECIBIDO_PARCIAL.
3. Vista de discrepancias en el detalle del pedido: pedido vs recibido (cantidad y precio), diferencias resaltadas.
4. Factura mínima: registro `Invoice` enlazado a albarán/pedido (número, proveedor, importe, fecha, archivo opcional). Sin líneas ni vencimientos (ampliación futura).

## Files to modify

- `backend/prisma/schema.prisma` + migración aditiva — `Albaran.purchaseOrderId?`, `Invoice.albaranId?/purchaseOrderId?/fileUrl?` (columnas nullable sobre el stub; NO tocar datos)
- `backend/src/modules/compras/services/order-reconciliation.service.ts` (+ spec)
- `backend/src/modules/albaranes/services/albaran-stock.service.ts` — hook post-confirm que invoca la conciliación si hay `purchaseOrderId` (import del servicio vía módulo, ojo dependencias circulares → usar evento o import directo del ComprasModule exportado)
- `backend/src/modules/albaranes/` controller/DTO — aceptar `purchaseOrderId` en creación/edición; endpoint sugerencias `GET /v1/compras/pedidos/pendientes-recepcion?supplierId=`
- `backend/src/modules/compras/compras.controller.ts` — facturas mínimas `/v1/compras/facturas*`
- `frontend/src/app/dashboard/albaranes/` — selector de pedido en flujo de subida/detalle
- `frontend/src/app/dashboard/compras/pedidos/[id]/` — tabla de conciliación/discrepancias + factura vinculada

## Steps

1. Migración aditiva (verificar cero pérdida sobre copia).
2. Servicio de conciliación: matching por `productId` (línea albarán `matchedProductId` ↔ línea pedido), acumulando cantidades si hay varios albaranes parciales; transición RECIBIDO/RECIBIDO_PARCIAL vía status service de fase 1.
3. Hook en confirmación de albarán (no romper flujo existente si no hay pedido vinculado — camino albarán-sin-pedido intacto).
4. CRUD factura mínima + upload opcional (patrón FormData — recordar gotcha Content-Type de apiClient ya arreglado).
5. Frontend: selector con sugerencias, tabla de discrepancias (badge rojo cantidad/precio distinto), sección factura.
6. Build + relanzar dist; regresión completa del flujo de albarán SIN pedido (no romper lo existente).

## Checking (criterios de aceptación)

- [ ] Albarán sin pedido vinculado: flujo actual intacto (subir→revisar→confirmar→stock/precios) — regresión completa OK
- [ ] Vincular albarán a pedido ENVIADO y confirmar → líneas del pedido con `receivedQuantity/receivedPrice`; pedido RECIBIDO si todo cubierto
- [ ] Recepción parcial (albarán con menos cantidad) → RECIBIDO_PARCIAL; segundo albarán completa → RECIBIDO
- [ ] Discrepancias de precio/cantidad resaltadas en el detalle del pedido
- [ ] Sugerencia de pedidos filtra por proveedor y ventana de fechas
- [ ] Factura mínima creada y visible desde pedido y albarán
- [ ] Borrado de albaranes sigue respetando la regla PENDIENTE/REVISADO
- [ ] Specs pasan; sin errores TS
- [ ] Informe en `reports/sprint-3-checking-report.md`
