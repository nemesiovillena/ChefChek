# Scout Report — Precio pactado (Artículo ↔ Proveedor)

Petición: en el modal de Artículo (ej. Aceite de girasol / Bodegas Ruiz), simplificar fijar el "precio pactado": click para usar el precio actual, "Sin pactar" si no hay, edición manual, link directo a ficha proveedor. Y ver/editar/quitar precios pactados desde Proveedores.

## Found Files

### Frontend — Artículo (tab proveedor/stock)
- `frontend/src/app/dashboard/articulos/components/tab-proveedor-stock.tsx` — `TabProveedorStock` + `SupplierOffersSection`. Ya implementa set/clear manual de `agreedPrice` por oferta:
  - L370-373 `startEditAgreed`: inicializa el input SIEMPRE vacío (nunca precarga `offer.purchasePrice`) — origen exacto de "tengo que teclear el precio a mano".
  - L375-394 `handleSaveAgreed`: input vacío → `agreedPrice: null` ("Sin pactar"); guarda vía `updateOffer.mutateAsync({ agreedPrice, purchasePrice: offer.purchasePrice })`.
  - L404-438: cada fila ya tiene Star (preferida), Pencil (editar formato/precio), Trash.
  - L419: `offer.supplier?.name` se muestra como texto plano — **sin link a ficha proveedor**.
  - L420: `offer.purchasePrice` ya está en pantalla, a pocos px del input de pactado, pero el código nunca lo reutiliza.
  - L472-520: botón "Fijar precio pactado" / `Pactado: {precio}` + input numérico manual (sin atajo de "usar precio actual").
- `frontend/src/app/dashboard/articulos/components/articulo-modal.tsx` (L400-413) — monta `TabProveedorStock` con `productId`, `suppliers`, `basePurchasePrice`, `baseReferenceUnit`.
- `frontend/src/app/dashboard/articulos/components/peso-precio-fields.tsx` — precio propio del artículo (`purchasePrice`, `referenceUnit`, etc.), distinto del `agreedPrice` por oferta.
- `frontend/src/app/dashboard/articulos/components/supplier-combobox.tsx` — picker de proveedor al añadir oferta nueva (no navega a ficha).
- `frontend/src/hooks/use-products.ts` (L385-504) — `ProductSupplierOffer` (incl. `agreedPrice`, `agreedAt`, `agreedUntil`, `isPreferred`, `purchasePrice`), `useProductSupplierOffers`, `useUpdateSupplierOffer` (PATCH), `useSetPreferredSupplierOffer`, `useDeleteSupplierOffer`. `getReferencePrice` (L326-329) usa la oferta `isPreferred`, no `agreedPrice`.

### Backend — Offer/Product/Supplier
- `backend/prisma/schema.prisma:257-294` — `ProductSupplierOffer`: **`agreedPrice` (Float?), `agreedAt`, `agreedUntil` YA EXISTEN**, per-offer (por proveedor+producto), `null` = "sin pactar". No es concepto nuevo.
- `backend/prisma/schema.prisma:139-213` — `Product`: sin `agreedPrice` propio; solo campos planos sincronizados desde la oferta `isPreferred`.
- `backend/prisma/schema.prisma:2122-2147` — `PriceDeviation`: compara `agreedPrice` vs `receivedPrice` recibido en albarán (módulo Compras).
- `backend/src/modules/products/product-supplier-offers.service.ts`:
  - `listOffers(productId, tenantId)` L37 — ordena `isPreferred desc, createdAt asc`. **Solo por producto, no existe `listOffersBySupplier`.**
  - `upsertOffer(...)` L53 → `buildAgreedFields` L392 (única vía de escritura de `agreedPrice`/`agreedAt`/`agreedUntil`; `undefined`=no tocar, `null`=limpiar; `agreedAt` solo se re-estampa si el valor cambia realmente).
  - `setPreferred` L275, `removeOffer` L343 (soft-delete, exige `promoteOfferId` si se borra la preferida).
- `backend/src/modules/products/dto/product-supplier-offer.dto.ts` (L52, L97) — `agreedPrice?: number | null`, `agreedUntil?: string | null` ya en los DTOs create/update.
- `backend/src/modules/products/products.controller.ts:269-371` — endpoints ya existentes: `GET/POST/PATCH/DELETE .../supplier-offers[/:offerId]`, `POST .../set-preferred`. **No hay endpoint dedicado solo para agreedPrice** (viaja en el PATCH genérico) ni `GET /suppliers/:id/offers`.
- `backend/src/modules/products/products.service.ts:1414,1432-1441` + `products.controller.ts:520` (`GET /v1/products/suppliers/:id/products`) — consulta productos por **FK legacy `product.supplierId`**, NO por `ProductSupplierOffer`. Estructuralmente no puede traer `agreedPrice` ni cubre ofertas no-preferidas de ese proveedor. **Habrá que crear endpoint nuevo tipo `GET /v1/products/suppliers/:id/offers`** que consulte `ProductSupplierOffer` por `supplierId`.
- `backend/src/modules/compras/services/price-agreement.service.ts` — tolerancia/detección de desviación ya usa `agreedPrice` (no tocar).
- `backend/src/modules/compras/services/offer-resolution.service.ts` — expone `agreedPrice` de solo lectura (Compras).

### Frontend — Proveedores
- `frontend/src/app/dashboard/proveedores/page.tsx` — página standalone `/dashboard/proveedores`. **No existe ruta `[id]` de ficha** — el "detalle" es una fila expandible inline.
- `frontend/src/app/dashboard/proveedores/components/supplier-table.tsx` — tabla + chevron expandible → monta `SupplierDetailPanel` inline.
- `frontend/src/app/dashboard/proveedores/components/supplier-detail-panel.tsx` (52 líneas) — panel actual: gráfico `SupplierPriceHistory` (agregado) + lista plana "Productos asociados" (`useSupplierProducts`) **sin precios**.
- `frontend/src/app/dashboard/proveedores/components/supplier-modal.tsx` — dialog crear/editar, envuelve `SupplierForm` (de Artículos), sin pestañas, sin sección de precios.
- `frontend/src/hooks/use-suppliers.ts` — `useSuppliers()` (lista completa), `useSupplierProducts(supplierId)` → `{id, name, category}` **sin precio**, `useSupplierPriceHistory`, `useSupplierPriceTrend`.
- `frontend/src/hooks/use-supplier-comparison.ts` — `useOfferComparison(productId, locationId)`: comparativa **por producto** entre proveedores; `OfferComparisonRow` ya incluye `agreedPrice` (usado en Compras, no en Proveedores).

## Patterns

- El "precio pactado" **ya existe como feature completa a nivel de oferta** (`ProductSupplierOffer.agreedPrice/agreedAt/agreedUntil`), editable hoy solo desde Artículos → `TabProveedorStock`. No es un campo nuevo a diseñar.
- `isPreferred` (rige costeo/escandallo) y `agreedPrice` (rige detección de desviación en Compras) son **ortogonales**: un producto puede tener precio pactado en una oferta no-preferida.
- El "recordar" un precio pactado ya es trivial: `offer.purchasePrice` está en el mismo payload que ya llega al frontend — no falta backend para el caso "click para usar precio actual", solo precargar/ofrecer ese valor en el input existente (`tab-proveedor-stock.tsx` L370-373).
- Para "quick click" real (guardar en 1 clic sin pasar por el input), basta con reusar `useUpdateSupplierOffer` pasando `agreedPrice: offer.purchasePrice` directamente — sin necesidad de nuevo endpoint.
- Para el link a ficha de proveedor desde Artículos: **no existe destino** (no hay ruta `/dashboard/proveedores/[id]`); ficha proveedor es hoy fila-expandida en la tabla, no navegable por URL. Habrá que decidir: abrir `SupplierDetailPanel`/`SupplierModal` en modal/drawer reusado desde Artículos, o crear ruta `[id]` real.
- Para ver precios pactados en Proveedores: no existe vista por-proveedor de ofertas (`listOffers` es solo por producto); `getSupplierProducts` usa el FK legacy y no trae precios ni cubre ofertas secundarias. Se necesita **endpoint nuevo** `GET /v1/products/suppliers/:id/offers` (mismo patrón que `listOffers` pero filtrando por `supplierId`), y en frontend adaptar/extraer la UI ya existente de `SupplierOffersSection` para reusarla en `SupplierDetailPanel` (o ficha nueva) en modo "por proveedor" en vez de "por producto".
- Editar/quitar desde Proveedores puede reusar el PATCH genérico existente `PATCH /v1/products/:productId/supplier-offers/:offerId` (ya soporta `agreedPrice: null` para limpiar) — no requiere endpoint nuevo de escritura, solo de lectura por proveedor.

## Unresolved Questions

- ¿El link "ir a ficha proveedor" debe abrir un modal/drawer reusando `SupplierDetailPanel`/`SupplierModal` desde el propio modal de Artículo, o crear una ruta real `/dashboard/proveedores/[id]`? No hay precedente de ruta hoy.
- ¿La vista de precios pactados en Proveedores reemplaza la lista plana actual "Productos asociados" en `SupplierDetailPanel`, o se añade como pestaña nueva?
- ¿Se prefiere endpoint backend nuevo `GET /v1/products/suppliers/:id/offers`, o resolver en frontend combinando llamadas existentes? (recomendado: endpoint nuevo, más eficiente y evita N+1).
- Confirmar si el flujo "click para fijar precio actual" debe guardar en 1 clic directo, o solo precargar el input dejando que el usuario confirme (UX a decidir con el usuario).
