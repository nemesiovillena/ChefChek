# Fase 3: Frontend — navegación genérica desde la campana

## Contexto

El click en una notificación (`frontend/src/app/dashboard/layout.tsx:216-222`) solo
llama `markAsRead`. Tras la fase 2, `notifications[]` trae `entityType`/`entityId`
cuando la alerta tiene entidad de origen. Se necesita un resolver de rutas genérico
(no una URL guardada en BD, ver decisión de diseño en `plan.md`) y, para `PRODUCT`,
el mismo deep-link con apertura de modal que preveía el plan original.

`ArticuloModal` (`frontend/src/app/dashboard/articulos/components/articulo-modal.tsx`)
no acepta pestaña inicial (`activeTab` nace siempre en `'formato-precio'`, línea ~148).
La página de detalle de pedido de compra (`frontend/src/app/dashboard/compras/pedidos/[id]/page.tsx`)
ya recibe el id por ruta — no requiere query params ni cambios, solo el `router.push`
correcto.

## Archivos a modificar

- `frontend/src/lib/notification-routes.ts` **(nuevo)** — mapa `ENTITY_ROUTES` y función
  `resolveNotificationRoute(entityType, entityId): string | null`.
- `frontend/src/app/dashboard/layout.tsx` (click handler, líneas ~216-222)
- `frontend/src/app/dashboard/articulos/page.tsx` (imports, estado, efecto de
  hidratación desde query params, render de `ArticuloModal`)
- `frontend/src/app/dashboard/articulos/components/articulo-modal.tsx` (nueva prop
  `initialTab?: string`, interface `ArticuloModalProps`, `useState('formato-precio')`
  línea ~148)

## Pasos

1. **`notification-routes.ts`** (nuevo, kebab-case, colocado junto a otros helpers de
   `lib/`) — mapa mínimo:
   ```ts
   const ENTITY_ROUTES: Record<string, (id: string) => string> = {
     PRODUCT: (id) => `/dashboard/articulos?productId=${id}&tab=historial-precios`,
     PURCHASE_ORDER: (id) => `/dashboard/compras/pedidos/${id}`,
   };
   export function resolveNotificationRoute(entityType?: string, entityId?: string) {
     if (!entityType || !entityId) return null;
     return ENTITY_ROUTES[entityType]?.(entityId) ?? null;
   }
   ```
   `PRODUCTION_ORDER` queda deliberadamente fuera del mapa (sin página de detalle hoy,
   ver "Fuera" en `plan.md`) — `resolveNotificationRoute` devuelve `null` para él, mismo
   comportamiento que un tipo desconocido. No añadir un fallback a `/dashboard/production`
   sin deep-link real: no aporta nada sobre no navegar y añade una rama a mantener.

2. **`ArticuloModal`** — añadir `initialTab?: string` a `ArticuloModalProps` y usarlo
   como valor inicial de `useState(initialTab ?? 'formato-precio')`. Las pestañas ya se
   seleccionan por `id` y `historial-precios` ya es un id válido.

3. **`articulos/page.tsx`** — importar `useSearchParams` de `next/navigation` y
   `useProduct` de `@/hooks/use-products`. Leer `productId` y `tab` de `searchParams`.
   Si `productId` está presente:
   - Buscar primero en los productos ya cargados de la página actual (evita un fetch
     extra en el caso común de que la notificación apunte a un producto visible).
   - Si no está, usar `useProduct(productId)` para traerlo suelto (cubre el caso de
     paginación/filtro).
   - **Implementado sin `setSelectedProduct`/`setShowModal` ni efecto alguno**: el
     producto resuelto (`deepLinkProduct`) se pasa directo al modal como
     `article={selectedProduct ?? deepLinkProduct}` e `isOpen={showModal || !!deepLinkProduct}`
     — 100% derivado del render (URL + query de React Query), sin `useEffect` (regla del
     proyecto, ver skill `no-use-effect`).
   - El query param se limpia en `handleCloseModal` (evento, no efecto) vía
     `router.replace('/dashboard/articulos')` cuando había `productId` — así cerrar el
     modal no lo reabre al instante, y un F5 con el modal abierto simplemente lo vuelve a
     abrir (comportamiento correcto de un deep-link compartible).

4. **`ArticuloModal` render** — pasar `initialTab={searchParams.get('tab') ?? undefined}`.

5. **`layout.tsx` click handler (~216-222)** — en el `onClick` del `<div>` de cada
   notificación, además de `markAsRead(notif.id)`, calcular
   `const route = resolveNotificationRoute(notif.entityType, notif.entityId)`; si no es
   `null`, `router.push(route)` y cerrar el dropdown (`setShowNotifications(false)`).
   Requiere `useRouter` de `next/navigation` en `layout.tsx` (verificar si ya existe una
   instancia en el componente antes de crear una segunda).

## Validación

- Manual con `agent-browser` (ver [[agent-browser-meta-press-flood-bug]] — evitar teclas
  con modificador durante el flujo):
  1. Provocar una subida de precio >10% de un artículo → click en la notificación debe
     navegar a `/dashboard/articulos?productId=X&tab=historial-precios`, abrir el modal
     del producto correcto en "Hist. Precios", y marcar como leída.
  2. Repetir con un producto que NO esté en la página/filtro actual de Artículos (forzar
     fetch vía `useProduct`).
  3. Provocar una recepción parcial o un pedido programado generado → click navega a
     `/dashboard/compras/pedidos/{orderId}` con el pedido correcto.
  4. Click en una notificación de retraso de producción (o cualquier alerta legacy sin
     `entityType`) → solo marca como leída, sin navegar ni lanzar error.

## Riesgos

- Si `useProduct(productId)` tarda en resolver, el modal puede abrirse "vacío" un
  instante — aceptable (mismo comportamiento que cualquier fetch de detalle), no
  requiere skeleton dedicado salvo que la revisión visual lo pida.
- Limpiar el query param con `router.replace` no debe interferir con otros params que la
  página ya use (hoy no hay ninguno) — si en el futuro se añaden filtros a la URL,
  revisar que el replace no los borre.
