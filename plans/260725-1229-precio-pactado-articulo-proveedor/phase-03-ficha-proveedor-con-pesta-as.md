---
phase: 3
title: Ficha proveedor con pestañas
status: completed
priority: P2
dependencies:
  - 1
  - 2
effort: M
---

# Phase 3: Ficha proveedor con pestañas

⚠️ Requiere Fase 1 (endpoint) y los pasos 1-2 de Fase 2 (`AgreedPriceCell` ya extraído) completados antes de empezar.

## Overview

Sustituir el patrón actual de "fila expandible tras chevron casi invisible" (`supplier-table.tsx` + `supplier-detail-panel.tsx`) por un diálogo modal `SupplierOffersFichaDialog` con pestañas REALES y visibles (`role="tablist"`, patrón de `articulo-modal.tsx`): pestaña "Precios pactados" (nueva, tabla de ofertas del proveedor con `AgreedPriceCell`) y pestaña "Productos e histórico" (contenido ya existente de `SupplierDetailPanel`, sin cambios funcionales). Este mismo diálogo es el destino del link creado en la Fase 2 desde Artículos.

## Key Insights

- El usuario confirmó que el "Productos asociados" actual es tan poco visible (expandible tras chevron) que ni sabía que existía — la solución no es solo añadir una pestaña más de precios, es hacer la ficha entera visible y navegable con pestañas reales.
- Patrón de pestañas a copiar: `frontend/src/app/dashboard/articulos/components/articulo-modal.tsx` líneas 148 (`useState` de tab activo) y 349-371 (`role="tablist"`, `role="tab"`, `aria-selected`).
- `SupplierDetailPanel` (`frontend/src/app/dashboard/proveedores/components/supplier-detail-panel.tsx`) ya tiene el contenido de "histórico + productos asociados" — reusarlo tal cual como una de las pestañas, no reescribirlo.
- Nuevo endpoint de la Fase 1: `GET /v1/products/suppliers/:id/offers` → hook nuevo `useSupplierOffers(supplierId)` (React Query, ver convención de otros hooks en `use-products.ts`/`use-suppliers.ts`).
- `AgreedPriceCell` (Fase 2) se reutiliza aquí tal cual — la única diferencia es que en esta vista la etiqueta de cada fila es el NOMBRE DEL PRODUCTO (no del proveedor, ya que aquí el proveedor es fijo y lo que varía por fila es el producto).
- `supplier-table.tsx` hoy maneja `expandedId` con `useState` y renderiza `SupplierDetailPanel` inline en una fila `colSpan={7}` — este estado y ese renderizado se eliminan, sustituidos por abrir el diálogo modal.

## Requirements

- Funcional:
  - Diálogo con al menos 2 pestañas: "Precios pactados" (por defecto) y "Productos e histórico".
  - Pestaña "Precios pactados": tabla con producto, precio actual, `AgreedPriceCell` (editar/limpiar/usar-precio-actual) por fila — mismos permisos de edición que en Artículos (roles ADMIN/USER).
  - <!-- Updated: Validation Session 1 - visibilidad VIEWER confirmada --> Rol `VIEWER`: ve la pestaña "Precios pactados" en modo solo-lectura (tabla completa con `agreedPrice`/`purchasePrice` visibles) pero SIN los controles de `AgreedPriceCell` (editar/1-clic/limpiar) — pasar un prop `readOnly` a `AgreedPriceCell` cuando el rol activo sea `VIEWER`.
  - Pestaña "Productos e histórico": el contenido actual de `SupplierDetailPanel` sin cambios.
  - Abrible desde: (a) botón/chevron en `supplier-table.tsx` (reemplaza el expandible), (b) botón de proveedor en `tab-proveedor-stock.tsx` (Fase 2).
- No funcional: mismo componente para ambos puntos de entrada (DRY) — no crear dos diálogos distintos.

## Architecture

<!-- Updated: Validation Session 1 - corregido tras verificación: no existe un primitive Dialog/M3 compartido en el proyecto para modales centrados -->
```
SupplierOffersFichaDialog({ supplierId, supplierName?, onClose })
├── Overlay fijo hand-rolled (misma estructura de markup que articulo-modal.tsx / supplier-modal.tsx:
│     <div class="fixed inset-0 bg-black/55 backdrop-blur-sm ..."> + panel centrado <div class="relative ... rounded-lg ...">.
│     NO existe un componente `Dialog` compartido para este patrón en el proyecto — es convención copiada
│     entre modales grandes de entidad. El `Sheet` de @/components/ui/sheet es la OTRA convención (panel
│     lateral, usada para el flujo de reasignar proveedor) — descartada para esta ficha por decisión de
│     validación (modal centrado da más ancho para tabla+gráfico).
├── Header: nombre del proveedor (fetch propio si no se pasa supplierName, o requerirlo como prop obligatoria)
├── role="tablist": ["Precios pactados", "Productos e histórico"]
├── Tab "Precios pactados":
│   └── useSupplierOffers(supplierId) → tabla de filas { product.name, purchasePrice, <AgreedPriceCell readOnly={role==='VIEWER'}/> }
└── Tab "Productos e histórico":
    └── <SupplierDetailPanel supplierId supplierName /> (reuso directo, sin cambios)
```

## Related Code Files

- Create: `frontend/src/app/dashboard/proveedores/components/supplier-offers-ficha-dialog.tsx` — el nuevo componente con pestañas (ubicarlo junto a `supplier-detail-panel.tsx` ya que es su reemplazo directo en el punto de entrada de Proveedores, aunque también se importe desde Artículos).
- <!-- Updated: Validation Session 1 - ubicación de hook y fix apiClient confirmados --> Modify: `frontend/src/hooks/use-products.ts` (decidido: co-ubicado con el tipo `ProductSupplierOffer` que ya vive ahí, en vez de `use-suppliers.ts`) — añadir hook `useSupplierOffers(supplierId: string)`:
  ```ts
  export interface SupplierOfferWithProduct extends ProductSupplierOffer {
    product: { id: string; name: string; category?: { id: string; name: string } | null };
  }

  export function useSupplierOffers(supplierId: string | null) {
    return useQuery({
      queryKey: ['supplier-offers', supplierId],
      queryFn: async () => {
        const res = await apiClient.get(`/v1/products/suppliers/${supplierId}/offers`);
        // apiClient YA desenvuelve {success,data} para respuestas no paginadas (verificado en
        // frontend/src/lib/api-client.ts:111-116) — res.data es directamente el array, sin .data.data.
        return res.data as SupplierOfferWithProduct[];
      },
      enabled: !!supplierId,
    });
  }
  ```
- Modify: `frontend/src/app/dashboard/proveedores/components/supplier-table.tsx` — eliminar `expandedId`/fila expandible (líneas 20, 38, 44, 153-159); el botón de chevron pasa a llamar `onOpenFicha(supplier.id, supplier.name)` (callback prop, sin estado propio de apertura).
- <!-- Updated: Validation Session 1 - ubicación de estado confirmada --> Modify: `frontend/src/app/dashboard/proveedores/page.tsx` — añadir estado `fichaSupplier: { id: string; name: string } | null` (decidido: elevado a `page.tsx`, NO a `SupplierTable`, para garantizar una única instancia del diálogo en vez de una por fila) y montar `<SupplierOffersFichaDialog>` ahí, pasando `onOpenFicha` como prop a `<SupplierTable>`.
- No modify (reuso puro): `frontend/src/app/dashboard/proveedores/components/supplier-detail-panel.tsx`.
- Read-only reference: `frontend/src/app/dashboard/articulos/components/agreed-price-cell.tsx` (Fase 2), `frontend/src/app/dashboard/articulos/components/articulo-modal.tsx` (patrón de pestañas, líneas 148/349-371).

## Implementation Steps

1. Añadir `useSupplierOffers` en `use-products.ts` (snippet ya definitivo arriba, sin duda de shape pendiente).
2. Crear `supplier-offers-ficha-dialog.tsx`: overlay fijo hand-rolled (misma estructura que `articulo-modal.tsx`/`supplier-modal.tsx`, NO un `Dialog` compartido — ver Architecture), `useState` de tab activo (`'precios' | 'detalle'`, default `'precios'`), `role="tablist"` copiando el markup de `articulo-modal.tsx:349-371`.
3. Tab "Precios pactados": tabla con una fila por `SupplierOfferWithProduct`, columnas producto (nombre + categoría opcional), precio actual (`purchasePrice`), y `<AgreedPriceCell agreedPrice={offer.agreedPrice} currentPrice={offer.purchasePrice} onSave={...} readOnly={role === 'VIEWER'} />` reusando `useUpdateSupplierOffer` con `productId: offer.productId`. Cuando `readOnly`, renderizar solo el valor (`Pactado: X` / `Sin pactar`) sin botones.
4. Tab "Productos e histórico": montar `<SupplierDetailPanel supplierId={supplierId} supplierName={supplierName} />` tal cual, sin tocar su código interno.
5. En `supplier-table.tsx`: quitar el `useState<string|null>(expandedId)` y la fila `colSpan` condicional; añadir prop `onOpenFicha: (id: string, name: string) => void` a `SupplierTable`/`SupplierRow`, el botón chevron pasa a `onClick={() => onOpenFicha(supplier.id, supplier.name)}`.
6. En `page.tsx` de Proveedores: estado `fichaSupplier: { id: string; name: string } | null`, pasar `onOpenFicha={(id, name) => setFichaSupplier({ id, name })}` a `<SupplierTable>`, montar `<SupplierOffersFichaDialog supplierId={fichaSupplier.id} supplierName={fichaSupplier.name} onClose={() => setFichaSupplier(null)} />` una sola vez, condicionado a `fichaSupplier != null`, fuera de la tabla.
7. Volver a la Fase 2 paso 5-6 (ver `phase-02...md`) y completar el import/wiring pendiente desde `tab-proveedor-stock.tsx`.
8. Probar con los 3 roles relevantes (ADMIN/USER ven controles completos; VIEWER ve la tabla sin botones de edición): desde Proveedores, click en el chevron de una fila abre el diálogo en la pestaña "Precios pactados"; editar/limpiar/1-clic funciona igual que en Artículos; cambiar a pestaña "Productos e histórico" muestra el mismo contenido que antes (sin regresión); desde Artículos, click en nombre de proveedor abre el mismo diálogo para ese proveedor.

## Success Criteria

- [x] El expandible oculto en `supplier-table.tsx` desaparece; el chevron abre el diálogo con pestañas.
- [x] <!-- Updated: Code Review - bug de caché corregido --> Pestaña "Precios pactados" lista todas las ofertas del proveedor (incluidas las no-preferentes) con edición/limpieza/1-clic funcional. El `code-reviewer` detectó que `useSupplierOffers` (queryKey `['suppliers', supplierId, 'offers']`) no se invalidaba tras guardar — `useUpdateSupplierOffer` solo invalida queries `['products', productId, ...]`. Corregido invalidando explícitamente esa queryKey en el `onSave` de `supplier-offers-ficha-dialog.tsx` tras `mutateAsync`.
- [x] Pestaña "Productos e histórico" es idéntica en comportamiento a `SupplierDetailPanel` actual (cero regresión).
- [x] El mismo diálogo se abre correctamente tanto desde Proveedores como desde el link de Artículos (Fase 2), con los props correctos.
- [x] Solo hay una instancia montada del diálogo (state elevado al padre), no un diálogo oculto por fila de la tabla.
- [x] Rol `VIEWER` ve la pestaña "Precios pactados" con los datos completos pero sin botones de editar/1-clic/limpiar.

## Risk Assessment

- Riesgo medio: toca un flujo existente (`supplier-table.tsx`) que usuarios ya usan — probar que borrar/editar/toggle-activo (funcionalidad no tocada de esa tabla) sigue funcionando tras quitar el `expandedId`.
- <!-- Updated: Validation Session 1 - corregida premisa falsa de "consistencia con tab-proveedor-stock.tsx" --> Cuidado con roles: verificado que `tab-proveedor-stock.tsx` HOY NO tiene ningún ocultamiento de controles por rol (grep sin resultados) — la única protección actual es el backend rechazando el `PATCH` con 403. El ocultamiento `VIEWER` para la pestaña "Precios pactados" es una pieza NUEVA de UI en este plan, no un patrón ya existente ahí. Sí existe precedente de gating por rol en `proveedores/page.tsx` (`MANAGE_ROLES = ['ADMIN','OWNER','SUPERADMIN']`, `canManage`) — seguir ese nombre/patrón (`useAuth()` + comparación de `user?.role`) para el nuevo diálogo, en vez de inventar uno distinto. Este diálogo será el primer punto de esta feature con gating de rol en frontend; `AgreedPriceCell` recibe `readOnly` como prop **opcional que por defecto es `false`** — la Fase 2 (uso en Artículos) NO la pasa, preservando el comportamiento actual de esa pantalla (sin gating frontend, fuera de alcance de este plan arreglarlo ahí).
