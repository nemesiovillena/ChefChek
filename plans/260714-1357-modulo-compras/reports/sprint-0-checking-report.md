# Sprint 0 — Fundaciones: informe de checking

**Fecha**: 2026-07-14 · **Rama**: develop (sin commit) · **BD**: localhost:5432/chefchek (la que usa :3001)

## Resultado: ✅ COMPLETADO (1 observación menor)

## Checking ejecutado

| Criterio | Resultado | Evidencia |
|---|---|---|
| Backend arranca sin OrdersModule | ✅ | `npm run build` limpio; `start:prod` arriba; `/health` → `{"status":"ok"}`; login OK |
| Migración aplicada y probada sobre copia | ✅ | Dump previo (`pg_dump` 232K, scratchpad); restaurada en `chefchek_mig_test`; migración aplicada; **inversa probada** (drop de lo nuevo → 101 products/1 warehouse intactos); test DB eliminada |
| Backfill: 1 Location default por tenant, idempotente | ✅ | 3 tenants → 3 "Principal" `isDefault=true`; re-ejecución del INSERT → `INSERT 0 0` |
| "Compras" en gestor de módulos; toggle off → 403/nav | ✅ | `GET /v1/modules` incluye `compras` y NO `orders`; fila `modules.compras.enabled=false` en Configuration → `GET /v1/compras/locales` **403**; `true` → **200**. UI superadmin es genérica (lee el mismo endpoint) |
| `orders` fuera de registry/nav; tablas intactas | ✅ | Registry/nav sin `orders`; `orders`=1 fila, `goods_receptions`=1 fila (idénticas pre/post); `OrdersModule` marcado `@deprecated` (carpeta conservada) |
| CRUD locales por curl | ✅ | Crear (Barra) → renombrar (Terraza) → promover default (desmarca Principal) → restaurar → delete soft (`deletedAt` set). Borrar default → **400**. Cross-tenant PATCH → **404** |
| CRUD locales por UI | ⚠️ | `next build` OK (página compila y prerenderiza); dev server no estaba corriendo → verificación visual pendiente al arrancarlo (observación menor, sin bloqueo) |
| Sin errores TS front/back | ✅ | `nest build` + `tsc --noEmit` frontend limpios (tras purgar tipos stale de `.next` que referenciaban la página orders borrada) |
| Specs | ✅ | Nueva suite `locations.service.spec.ts` 9/9. Suite completa: 263 fallos **preexistentes** en develop (verificado con stash: mismas 3 suites muestran 49 fallos idénticos con y sin los cambios del sprint; causa típica: mocks sin `$queryRaw`). Cero fallos nuevos |

## Cambios realizados

- **Schema/migración** `20260714152303_add_compras_foundations` (aditiva + backfill): `Location`, `PurchaseOrder`, `PurchaseOrderLine`, `PurchaseOrderEvent`, enum `PurchaseOrderStatus`, `Warehouse.locationId?` (+relación `locationRef` — el campo texto `location` preexistente se conserva).
- **Backend**: `backend/src/modules/compras/` (module con AuthModule/UsersModule, controller `api/v1/compras` con guards+`@RequireModule("compras")`, `LocationsService` + DTOs + spec). Registry: +`compras`, −`orders`. `app.module.ts`: `ComprasModule` reemplaza `OrdersModule`. `prisma.service.ts`: +`location`,`purchaseorder` en allowlist soft-delete.
- **Frontend**: `dashboard/compras/page.tsx` (tabs `role="tablist"`: Pedidos/Listas/Programaciones/Catálogos/Precios/Analítica/Locales; Locales funcional con `useConfirm`+`useNotification`), `hooks/use-locations.ts`; nav "Compras" reemplaza "Pedidos" + `ROUTE_MODULE_MAP`. **Borrados** `dashboard/orders/page.tsx` y `use-orders.ts` (prototipo desconectado; si no, la ruta quedaba sin gate al salir del ROUTE_MODULE_MAP).

## Decisiones anotadas

- Ruta de locales: **`/v1/compras/locales`** (dentro del controller compras; se moverá a ruta transversal solo si otro módulo la necesita — YAGNI).
- Regla de negocio: el local default no puede eliminarse, desactivarse ni des-marcarse directamente (se promueve otro).
- Backfill incluye tenants dados de baja (por si se restauran).

## Observaciones / pendiente

1. Verificación visual de la pestaña Locales al arrancar el dev server (build y API verificados).
2. Filas `modules.orders.enabled` viejas en `configurations` quedan huérfanas e inocuas (el registry manda); no se borran (cero pérdida).
3. Working tree contenía trabajo previo sin commitear ajeno al sprint (badge tendencia precios: products.service.ts, product-response.dto.ts, articulos/page.tsx, use-products.ts, product-price-trend-badge.tsx) — intacto, no mezclar en el commit del sprint.
4. 263 tests preexistentes fallando en develop (mocks sin `$queryRaw` etc.) — deuda a limpiar fuera de este plan.
