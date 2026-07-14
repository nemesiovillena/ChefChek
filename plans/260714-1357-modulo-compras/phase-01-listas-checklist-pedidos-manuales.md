---
phase: 1
title: "Listas de compra (checklist por proveedor) y pedidos manuales con sugerencias mín/máx"
status: done
---

> Completado 2026-07-14. Informe: [reports/sprint-1-checking-report.md](reports/sprint-1-checking-report.md)
> Decisiones: PATCH de lista reemplaza items completos; PENDIENTE_ENVIO→BORRADOR permitido; ENVIADO manual fija sentAt; expectedPrice null válido (se rellena al conciliar).

## Context

- Modelos base creados en fase 0 (`PurchaseOrder/Line/Event`, `Location`)
- Stock mín/máx existente: `Stock.minimumStock/maximumStock/reorderLevel` ([schema.prisma](../../backend/prisma/schema.prisma) ~L1107), UI [tab-proveedor-stock.tsx](../../frontend/src/app/dashboard/articulos/components/tab-proveedor-stock.tsx)
- Máquina de estados de referencia: [albaran-status.service.ts](../../backend/src/modules/albaranes/services/albaran-status.service.ts) (`VALID_TRANSITIONS`)
- Numeración de referencia: [albaran-number.service.ts](../../backend/src/modules/albaranes/services/albaran-number.service.ts) (`$queryRaw MAX` sobre TODAS las filas, patrón anclado — gotcha soft-delete)
- Lógica de reorder de referencia (solo dominio, código roto): `backend/src/modules/orders/orders.service.ts` `calculateProductRequirement`
- PDR §F1, F2

## Requirements

1. `PurchaseList` + `PurchaseListItem`: listas nombradas por proveedor (y local opcional) con artículos y cantidad por defecto.
2. CRUD completo de pedidos con máquina de estados `BORRADOR→PENDIENTE_ENVIO→ENVIADO→RECIBIDO_PARCIAL→RECIBIDO→CANCELADO` (transiciones inválidas → 400).
3. Generar pedido desde lista: checklist con cantidades sugeridas (si `quantity < minimumStock` → sugerir `maximumStock - quantity`; si hay `reorderLevel`, priorizarlo) y última cantidad pedida como fallback.
4. Numeración `PED-N` por tenant (patrón `^PED-(\d+)$`, `$queryRaw MAX` incluyendo soft-deleted).
5. Listado de pedidos con paginación server-side + filtros (estado/proveedor/local/fechas), patrón artículos.

## Files to modify

- `backend/prisma/schema.prisma` + migración aditiva — `PurchaseList`, `PurchaseListItem`
- `backend/src/modules/compras/services/`: `purchase-list.service.ts`, `purchase-order.service.ts`, `purchase-order-status.service.ts`, `purchase-order-number.service.ts` (+ specs)
- `backend/src/modules/compras/dto/` — create/update/query DTOs (class-validator; ojo `forbidNonWhitelisted` → 400 por campos extra)
- `backend/src/modules/compras/compras.controller.ts` — rutas `/v1/compras/listas*`, `/v1/compras/pedidos*` (rutas literales ANTES de `:id`)
- `frontend/src/hooks/use-purchase-lists.ts`, `use-purchase-orders.ts` (sobre `useCrud`/`usePaginatedQuery`)
- `frontend/src/app/dashboard/compras/` — tab Pedidos (tabla paginada) + tab Listas (checklist) + `pedidos/[id]/page.tsx` (detalle con líneas editables en BORRADOR)

## Steps

1. Schema + migración (`PurchaseList`: tenantId, supplierId, locationId?, name, deletedAt; `PurchaseListItem`: listId, productId, defaultQuantity, sortOrder).
2. Servicios backend con specs: status machine, numeración, CRUD tenant-scoped, `generar-pedido` desde lista (calcula sugerencias leyendo `Stock` agregado por producto; guarda `expectedPrice` desde la oferta preferida del proveedor vía `ProductSupplierOffer`).
3. Controller + DTOs + Swagger.
4. Frontend: checklist (selección múltiple + cantidades), tabla de pedidos con filtros/paginación, detalle de pedido con edición de líneas solo en BORRADOR; picker de artículos con `useProductSearch` (NUNCA `useProducts`, pagina a 20).
5. Build + relanzar dist; probar por UI y curl.

## Checking (criterios de aceptación)

- [x] Crear lista, marcar artículos y "Generar pedido" produce BORRADOR con cantidades sugeridas correctas contra un caso de stock conocido (qty 2 < mín 5 → sugirió 18 = máx 20 − 2)
- [x] Transición inválida (BORRADOR→RECIBIDO) devuelve 400 con mensaje claro
- [x] Dos pedidos creados tras borrar (soft) uno → numeración no colisiona (PED-0003 tras PED-0002 borrado)
- [x] Listado pagina/filtra en servidor (meta `{total,page,limit,totalPages}` + filtro status verificados por curl)
- [x] `expectedPrice` de líneas = oferta del proveedor (o purchasePrice si es proveedor principal; null si no hay dato)
- [x] Pedido y líneas tenant-scoped (findFirst {id,tenantId} en todos los servicios; specs cubren 404; curl inverso pendiente de credenciales de 2º tenant)
- [x] Specs Jest de los 4 servicios pasan (35 tests módulo compras); sin errores TS front/back
- [x] Informe en `reports/sprint-1-checking-report.md`
