---
phase: 0
title: "Fundaciones: módulo compras, retirada de orders, Location y modelos de pedido"
status: done
---

> Completado 2026-07-14. Informe: [reports/sprint-0-checking-report.md](reports/sprint-0-checking-report.md)
> Decisión: ruta de locales = `/v1/compras/locales`. Extra: página orders del frontend borrada (quedaba sin gate); allowlist soft-delete +location/+purchaseorder.

## Context

- Registro de módulos: [registry.ts](../../backend/src/modules/modules/constants/registry.ts) (`MODULE_REGISTRY`)
- Guard: [module.guard.ts](../../backend/src/guards/module.guard.ts) (`@RequireModule`), patrón de uso [products.controller.ts](../../backend/src/modules/products/products.controller.ts) L54-55
- Nav: [nav-config.ts](../../frontend/src/features/modules/lib/nav-config.ts) (`PRIMARY_NAV`/`MORE_SECTIONS`, `ROUTE_MODULE_MAP`)
- Prototipo a retirar: [orders.service.ts](../../backend/src/modules/orders/orders.service.ts) (referencia `prisma.automatedOrder`/`orderItem` inexistentes), registrado en [app.module.ts](../../backend/src/app.module.ts)
- Schema: [schema.prisma](../../backend/prisma/schema.prisma)
- PDR: [docs/pdr-modulo-compras.md](../../docs/pdr-modulo-compras.md) §F10, F11

## Requirements

1. Módulo `compras` activable por tenant desde superadmin, con nav y ruta esqueleto.
2. Prototipo `orders` retirado de registry/nav/app.module. Tablas stub intactas (cero pérdida de datos).
3. Migración aditiva: `Location` (+ backfill local por defecto por tenant), `Warehouse.locationId?`, `PurchaseOrder`, `PurchaseOrderLine`, `PurchaseOrderEvent` (enums de estado incluidos).
4. Esqueleto backend `backend/src/modules/compras/` con controller vacío guardado + module (importando `AuthModule`).

## Files to modify

- `backend/src/modules/modules/constants/registry.ts` — añadir `compras`, quitar `orders`
- `backend/src/app.module.ts` — quitar `OrdersModule`, añadir `ComprasModule`
- `backend/prisma/schema.prisma` + nueva migración — modelos/enums nuevos, `Warehouse.locationId?`
- `backend/src/modules/compras/` (nuevo): `compras.module.ts`, `compras.controller.ts`, `services/locations.service.ts`, `dto/`
- `frontend/src/features/modules/lib/nav-config.ts` — NavItem `compras` + `ROUTE_MODULE_MAP`; quitar entrada de orders si la hay
- `frontend/src/app/dashboard/compras/page.tsx` (nuevo, esqueleto con tabs `role="tablist"`)
- Decidir ruta locales: `/v1/compras/locales` (default) — anotar decisión en el report

## Steps

1. Grep exhaustivo de referencias a `OrdersModule`/`orders` (backend imports, nav, hooks `use-orders`) antes de retirar; retirar del registry/nav/app.module; NO borrar carpeta ni tablas (marcar deprecated en comentario del module).
2. Schema: `Location` (tenantId, name, address?, isDefault, deletedAt), `PurchaseOrder` (tenantId, orderNumber, supplierId, locationId?, status enum `BORRADOR|PENDIENTE_ENVIO|ENVIADO|RECIBIDO_PARCIAL|RECIBIDO|CANCELADO`, sentAt/sentVia/sentBy, notes, totales, deletedAt), `PurchaseOrderLine` (orderId, productId, quantity, unit, expectedPrice, receivedQuantity?, receivedPrice?, lineNotes), `PurchaseOrderEvent` (orderId, type, channel?, userId, payload Json, createdAt), `Warehouse.locationId?`. Índices `@@index([tenantId, ...])`.
3. Migración + script/SQL de backfill idempotente: 1 `Location` `isDefault=true` por tenant existente. Probar sobre copia de la BD activa (ojo: dos Postgres en dev, 5432 brew vs 5433 docker — migrar la que usa :3001).
4. Registry: `{ id: "compras", name: "Compras", description: "Pedidos y compras a proveedores", dependencies: [], alwaysActive: false, defaultEnabled: true }`.
5. Esqueleto `ComprasModule` (importa `AuthModule`), controller `@Controller("api/v1/compras")` + guards + `@RequireModule("compras")`, endpoints `GET/POST/PATCH/DELETE /v1/compras/locales` (LocationsService).
6. Frontend: página esqueleto + nav + route map; gestión mínima de locales (listar/crear/editar/desactivar) con `useCrud` + `useConfirm()`.
7. Build backend (`npm run build`) + relanzar dist (`npm run start:prod`) — el backend NO corre en watch.

## Checking (criterios de aceptación)

- [x] Backend arranca sin `OrdersModule` (puerto 3001 arriba, login OK)
- [x] `npx prisma migrate diff` limpio tras migrar; migración inversa probada sobre copia (solo dropea lo nuevo)
- [x] Cada tenant existente tiene exactamente 1 `Location` default (SQL de verificación); re-ejecutar backfill no duplica
- [x] "Compras" aparece en el gestor de módulos del superadmin; toggle off → nav oculto + `/dashboard/compras` redirige + curl a `/api/v1/compras/locales` devuelve 403; toggle on → todo accesible
- [x] "Pedidos" (orders) ya no aparece en registry/nav; tablas `orders` intactas en BD (SELECT count antes/después idéntico)
- [x] CRUD de locales funciona por curl (`X-Tenant-Slug` + Bearer session); UI: build OK, verificación visual pendiente (observación menor en el informe)
- [x] Sin errores TypeScript front/back; cero fallos nuevos en Jest (263 fallos preexistentes en develop, verificado vía stash)
- [x] Informe en `reports/sprint-0-checking-report.md`
