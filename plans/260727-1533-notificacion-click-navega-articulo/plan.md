# Plan: click en notificación de precio navega al artículo

**Status:** ON HOLD (2026-07-27) — pospuesto a propósito, ver nota abajo
**Origen:** `plans/reports/scout-260726-2111-notificacion-click-navega-articulo-report.md` (ver sesión previa; scout no se guardó a fichero, resumen en este plan)

## Nota de pausa (2026-07-27)

El usuario decide posponer esta implementación hasta tener más módulos en marcha, para
poder ver en conjunto qué notificaciones se van generando (hoy solo hay precio; otros
módulos futuros añadirán tipos nuevos) antes de fijar el diseño de navegación. Plan
queda completo y revisado, listo para retomar sin rehacer el scouting.

## Objetivo

Al hacer click en una notificación de cambio de precio en la campana de "Notificaciones"
(`dashboard/layout.tsx`), navegar a Artículos con el modal del producto abierto en la
pestaña "Hist. Precios".

## Alcance

- Dentro: notificaciones de `notifyPriceChange` (6 call sites: `products.service.ts` x2,
  `albaran-stock.service.ts` x2, `manual-albaran.service.ts` x2).
- Fuera: notificaciones de pedidos/producción/menús. Ya tienen `actionUrl` seteado
  (`/orders/:id`, `/production`, `/menus/:id`) pero `/orders/:id` no es una ruta real hoy
  (el módulo compras usa `/dashboard/compras/pedidos/:id`, ver
  [[compras-module-pdr-sprints-decisions]]) — arreglar eso es un bug preexistente
  separado, no se toca en este plan.

## Fases

1. [Backend: persistir y exponer productId](phase-01-backend-persist-productid.md) —
   migración Prisma + `notifyPriceChange` + 6 call sites + `AlertsController`.
2. [Frontend: propagar productId por el hook chain](phase-02-frontend-hook-propagation.md)
   — `use-alerts.ts`, `use-websocket.ts`, tipos.
3. [Frontend: navegación + deep-link en Artículos](phase-03-frontend-navigation-deeplink.md)
   — click handler en `layout.tsx`, `useSearchParams` + auto-open modal en
   `articulos/page.tsx`, `initialTab` prop en `ArticuloModal`.

## Dependencias

Fase 2 depende de fase 1 (tipos backend). Fase 3 depende de fase 2 (dato disponible en
`notifications[]`). Secuencial, sin paralelismo real (cambios encadenados en el mismo
flujo de datos).

## Criterios de aceptación

- Provocar una subida de precio (>10% vía albarán o edición manual en Artículos) genera
  una alerta con `productId` persistido.
- La campana muestra la notificación; click navega a
  `/dashboard/articulos?productId=X&tab=historial-precios` y abre el modal en esa pestaña
  con los datos del producto (venga o no de la página actual/paginación).
- Notificaciones sin `productId` (pedidos, producción, menús, alertas legacy sin dato)
  siguen marcando como leído sin navegar — no deben romper con `undefined`.
- Tests backend existentes de `notifications.service.spec.ts`,
  `price-agreement.service.spec.ts`, `purchase-schedule.service.spec.ts` siguen en verde
  (no cambian su contrato, solo se añade un argumento opcional).

## Riesgos / rollback

- Migración aditiva (`productId String?`, `onDelete: SetNull`) — reversible, no
  destructiva. Si falla, revertir migración y los 3 commits de código son independientes.
- Ningún dato existente se pierde: alertas ya creadas sin `productId` seguirán
  funcionando (columna nullable, fallback a "sin navegación").
