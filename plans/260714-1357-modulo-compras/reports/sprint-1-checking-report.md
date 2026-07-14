# Sprint 1 — Listas y pedidos manuales: informe de checking

**Fecha**: 2026-07-14 · **Rama**: develop (sin commit) · **BD**: localhost:5432/chefchek

## Resultado: ✅ COMPLETADO (verificación visual UI pendiente, igual que sprint 0)

## Checking ejecutado (curl contra :3001 real + Jest)

| Criterio | Resultado | Evidencia |
|---|---|---|
| Lista → pedido con sugerencias mín/máx | ✅ | Stock Medallón qty 2 < mín 5 → sugerido **18** (máx 20 − 2); Arroz sin stock → default 6. `POST /listas/:id/generar-pedido` sin body |
| `expectedPrice` desde oferta/proveedor principal | ✅ | Medallón (proveedor principal) → 11,82 €; Arroz (otro proveedor, sin oferta) → null; total 212,76 € = 18×11,82 |
| Transición inválida → 400 | ✅ | BORRADOR→RECIBIDO = 400 con mensaje de transiciones permitidas |
| Máquina de estados completa | ✅ | BORRADOR→PENDIENTE_ENVIO→ENVIADO→RECIBIDO; ENVIADO fija `sentAt` (una sola vez) |
| Solo BORRADOR editable | ✅ | PATCH sobre RECIBIDO = 400 |
| Borrado solo BORRADOR/CANCELADO | ✅ | DELETE sobre RECIBIDO = 400; DELETE sobre BORRADOR = 200 (soft) |
| Numeración PED-N sin colisiones con soft-delete | ✅ | PED-0002 creado y borrado (soft) → siguiente = **PED-0003** ($queryRaw MAX sobre todas las filas) |
| Paginación server-side + filtros | ✅ | `?page=1&limit=2&status=RECIBIDO` → meta `{total,page,limit,totalPages}` + filtro aplicado |
| Auditoría (PurchaseOrderEvent) | ✅ | Detalle incluye CREATED + STATUS_CHANGED con payload from/to; visible en timeline del frontend |
| Tenant-scoped | ✅ (parcial runtime) | Todos los servicios usan `findFirst {id, tenantId}`; specs cubren 404 cross-tenant. Sin credenciales de otro tenant para curl inverso (mismo patrón ya verificado en sprint 0 con locales) |
| Specs Jest | ✅ | 5 suites / 35 tests del módulo compras pasan (number, status, order, list, locations) |
| Builds | ✅ | `nest build` limpio; `tsc --noEmit` frontend limpio; `next build` OK (`/dashboard/compras` static + `pedidos/[id]` dynamic) |

## Cambios realizados

- **Schema/migración** `add_purchase_lists` (aditiva): `PurchaseList` + `PurchaseListItem` (+relaciones en Tenant/Supplier/Location/Product); `purchaselist` añadido al allowlist de soft-delete.
- **Backend** (`backend/src/modules/compras/`): `purchase-order-number.service` (PED-N, $queryRaw MAX), `purchase-order-status.service` (VALID_TRANSITIONS + evento STATUS_CHANGED + sentAt en envío manual), `purchase-order.service` (findAll paginado con filtros, findOne con líneas+eventos, create con resolución de precio oferta→proveedor-principal→null, update solo BORRADOR con reemplazo atómico de líneas, remove solo BORRADOR/CANCELADO), `purchase-list.service` (CRUD con items reemplazables, `generateOrder` con `suggestQuantity` estática: umbral = reorderLevel||minimumStock, objetivo = maximumStock||umbral, agregación multi-almacén). DTOs con class-validator. 12 rutas nuevas bajo `/api/v1/compras` (literales antes de `:id`; `pedidos/:id/estado` antes de `pedidos/:id`). 4 specs nuevos.
- **Frontend**: hooks `use-purchase-orders.ts` (+`ORDER_STATUS_META` con tokens M3) y `use-purchase-lists.ts`; componentes `pedidos-tab` (filtros+tabla paginada), `listas-tab` (crear lista, editor checklist con selección/cantidades, generar pedido con selección o con sugerencias), `product-search-input` (sobre `useProductSearch`, server-side); página `pedidos/[id]` (líneas editables en BORRADOR, añadir/quitar artículos, acciones de transición espejo del backend con `useConfirm` en cancelar/eliminar, timeline de eventos). Tabs Pedidos/Listas conectadas en `compras/page.tsx`.

## Decisiones anotadas

- Transiciones: `PENDIENTE_ENVIO→BORRADOR` permitida (rectificar antes de enviar); `ENVIADO` alcanzable a mano desde BORRADOR/PENDIENTE_ENVIO (pedidos por teléfono); RECIBIDO y CANCELADO terminales.
- Items de lista: PATCH reemplaza el checklist completo (sin endpoints por item — KISS).
- `expectedPrice` null es válido (artículo de otro proveedor sin oferta): suma 0 al total y se rellenará al conciliar (Sprint 3).
- Guardar antes de transicionar: la UI deshabilita las acciones de estado con cambios sin guardar.

## Datos de prueba dejados en la BD demo (chefchek-demo)

- Lista "Semanal carnes" (2 artículos), PED-0001 (RECIBIDO), PED-0003 (BORRADOR), PED-0002 soft-deleted, fila de stock del Medallón (2/5/20). Útiles para la verificación visual; borrar si estorban.

## Observaciones / pendiente

1. Verificación visual de las pestañas Pedidos/Listas y el detalle al arrancar el dev server (builds y API verificados).
2. Curl cross-tenant directo pendiente de credenciales de un segundo tenant (cubierto por specs y patrón findFirst tenantId).
3. `ListasTab` permite escribir a rol USER (coherente con backend @Roles ADMIN,USER); VIEWER solo lectura.
