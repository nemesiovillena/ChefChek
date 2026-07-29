# Fase 3: Frontend — navegación desde la campana + deep-link en Artículos

## Contexto

El click en una notificación (`frontend/src/app/dashboard/layout.tsx:224-235`) solo
llama `markAsRead`. La página Artículos (`frontend/src/app/dashboard/articulos/page.tsx`)
no lee query params y abre el modal vía `handleEdit(product)` (línea 371-374) con un
`Product` ya cargado en memoria — pero por paginación server-side el producto de la
notificación puede no estar en la página actual. `useProduct(id)`
(`frontend/src/hooks/use-products.ts:212`) ya existe para traer un producto suelto.
`ArticuloModal` (`frontend/src/app/dashboard/articulos/components/articulo-modal.tsx`)
no acepta pestaña inicial (`activeTab` nace siempre en `'formato-precio'`, línea 148).

## Archivos a modificar

- `frontend/src/app/dashboard/layout.tsx` (click handler, líneas 224-235)
- `frontend/src/app/dashboard/articulos/page.tsx` (imports, estado, efecto de
  hidratación desde query params, render de `ArticuloModal` línea 827-833)
- `frontend/src/app/dashboard/articulos/components/articulo-modal.tsx` (nueva prop
  `initialTab?: string`, interface `ArticuloModalProps` línea 33, componente línea 117,
  `useState('formato-precio')` línea 148)

## Pasos

1. **`ArticuloModal`** — añadir `initialTab?: string` a `ArticuloModalProps` y usarlo
   como valor inicial de `useState(initialTab ?? 'formato-precio')`. Sin más cambios:
   las pestañas ya se seleccionan por `id` (`TABS`, línea 18-26) y `historial-precios`
   ya es un id válido.

2. **`articulos/page.tsx`** — importar `useSearchParams` de `next/navigation` y
   `useProduct` de `@/hooks/use-products`. Leer `productId` y `tab` de
   `searchParams`. Si `productId` está presente:
   - Buscar primero en los productos ya cargados de la página actual (evita un fetch
     extra en el caso común de que la notificación apunte a un producto visible).
   - Si no está, usar `useProduct(productId)` para traerlo suelto (cubre el caso de
     paginación/filtro).
   - Cuando el producto resuelva (de cualquiera de las dos fuentes), abrir el modal:
     `setSelectedProduct(product); setShowModal(true)`.
   - Esto debe ser estado derivado del render (memo/effect de sincronización con la URL,
     NO un `useEffect` que dispare side-effects imperativos sueltos — seguir el patrón
     ya usado en el propio hook de notificaciones, `use-websocket.ts:103-122`, que
     deriva `notifications` con `useMemo` en vez de un efecto).
   - Tras abrir, limpiar el query param (`router.replace('/dashboard/articulos')`) para
     que un F5 posterior no reabra el modal indefinidamente.

3. **`ArticuloModal` render (línea 827-833)** — pasar
   `initialTab={searchParams.get('tab') ?? undefined}`.

4. **`layout.tsx` click handler (líneas 224-235)** — en el `onClick` del `<div>` de cada
   notificación, además de `markAsRead(notif.id)`, si `notif.actionUrl` existe hacer
   `router.push(notif.actionUrl)` y cerrar el dropdown (`setShowNotifications(false)`).
   Requiere importar/usar `useRouter` de `next/navigation` en `layout.tsx` (verificar si
   ya existe una instancia en el componente antes de crear una segunda).

## Validación

- Manual con `agent-browser` (ver [[agent-browser-meta-press-flood-bug]] — evitar teclas
  con modificador durante el flujo):
  1. Provocar una subida de precio >10% de un artículo (edición manual o vía albarán).
  2. Abrir la campana, confirmar que aparece la notificación de cambio de precio.
  3. Click en la notificación → debe navegar a
     `/dashboard/articulos?productId=X&tab=historial-precios`, abrir el modal del
     producto correcto en la pestaña "Hist. Precios", y marcar la notificación como
     leída.
  4. Repetir con un producto que NO esté en la página/filtro actual de Artículos (forzar
     fetch vía `useProduct`).
  5. Click en una notificación sin `actionUrl` (p.ej. una alerta legacy de appcc) — debe
     solo marcar como leída, sin navegar ni lanzar error.

## Riesgos

- Si `useProduct(productId)` tarda en resolver, el modal puede abrirse "vacío" un
  instante — aceptable (mismo comportamiento que cualquier fetch de detalle), no
  requiere skeleton dedicado salvo que la revisión visual lo pida.
- Limpiar el query param con `router.replace` no debe interferir con otros params que la
  página ya use (hoy no hay ninguno) — si en el futuro se añaden filtros a la URL,
  revisar que el replace no los borre.
