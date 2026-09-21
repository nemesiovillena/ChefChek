# Scout: "Formato de compra" se borra + ¿editarlo desde Pedidos?

Fecha: 2026-09-21. Solo lectura, sin cambios de código. Causa demostrada por lectura de código; NO contrastada con datos de BD.

## Veredicto
Bug real, no sensación. `Product.purchaseFormat` se sobrescribe con `""` desde la oferta preferente.

## Causa raíz
Dos copias del formato:
- `Product.purchaseFormat` (schema.prisma:155) — lo lee el modal Artículo (tab "Formato y precio") y `purchase-order.service.ts:334` / `pedidos/[id]/page.tsx:519`.
- `ProductSupplierOffer.purchaseFormat` (schema.prisma:292) — lo muestra tab "Proveedor y Stock".

Flujo que lo borra:
1. Usuario rellena Formato en el modal y guarda **sin tocar precio**. `articulo-modal.tsx:245` solo envía `purchasePrice` si el usuario lo editó.
2. `products.service.ts:~778` (`update()`): solo enruta `purchaseFormat` a la oferta si `updateData.purchasePrice !== undefined`. Si no, cae al camino directo → escribe **solo Product**. Oferta sigue con `""`.
3. Cualquier `upsertOffer` que deje la oferta preferente dispara `syncProductFromOffer` (`product-supplier-offers.service.ts:318-320`, `:471-490`), que hace `product.purchaseFormat = offer.purchaseFormat` (= `""`). Formato borrado.
4. Disparadores: confirmar albarán (`albaran-stock.service.ts:142,388` pasan solo `{purchasePrice, netPrice}` con `promoteToPreferred=true`), corregir precio albarán (`albaranes.service.ts:401`), albarán manual, `setPreferred`, editar oferta desde tab Proveedor, importar catálogo.
5. Sin formato → `buildLines` (`purchase-order.service.ts:334`) y `page.tsx:519` caen a `referenceUnit` (kg/L/und).

Agravante: `data.purchaseFormat ?? existingOffer.purchaseFormat` conserva `""` de la oferta; nada la rellena desde Product.

## Pedidos: ¿editar formato desde la línea?
Hoy NO. `pedidos/[id]/page.tsx:441-443` renderiza `line.unit` como texto plano; solo cantidad y precio son inputs. Backend sí lo acepta: `PurchaseOrderLineInputDto.unit?` (`dto/purchase-order.dto.ts:38`), y el front ya lo envía (`page.tsx:212`). Editar solo cambia el texto de la línea (snapshot), no el artículo → el problema volvería en el siguiente pedido.

Además `line.unit` es snapshot al añadir la línea: corregir el artículo después no actualiza líneas de borradores ya creados.

## Opciones (no aplicadas)
A. Fix raíz (recomendado, backend): en `update()` enrutar `purchaseFormat` (y unitsPerFormat/referenceUnitSize) a la oferta preferente también sin precio; y/o `syncProductFromOffer` no pisar con `""` (`offer.purchaseFormat || product.purchaseFormat`) + al crear/actualizar oferta heredar `product.purchaseFormat` si viene vacío. + test regresión en `product-supplier-offers.service.spec.ts` (hoy no cubre el caso oferta `""` + producto con formato).
B. UX Pedidos: input editable en columna Unidad (borrador) y, opcional, "guardar como formato del artículo" → PATCH producto/oferta. Solo tras A.
C. Backfill datos: productos con Product.purchaseFormat = `""` cuya oferta/otros datos permitan recuperarlo — imposible si el valor se perdió; el usuario debe reintroducirlos. Auditar drift primero (SELECT), nada destructivo.

## Preguntas abiertas
- ¿Qué BD tiene los datos afectados (dev :5433 docker vs brew :5432 vs prod)? Sin contrastar aún.
- ¿El formato debe ser por artículo o por proveedor? Hoy hay dos copias; el fix de A asume que el preferente manda (como el resto de campos planos).
- ¿Quiere también B (editar en pedido) o basta con A?
