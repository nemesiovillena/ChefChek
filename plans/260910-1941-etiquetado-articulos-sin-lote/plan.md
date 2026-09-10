# Etiquetas de artículos sin lote + proveedor siempre visible

## Estado: implementado y verificado en local

## Problema
Muchos artículos de Makro llegan sin nº de lote en el albarán → no se crea `Lot`
→ el formulario de etiqueta no ofrecía nada y la creación HANDLED exigía lote.
Además la etiqueta solo mostraba el proveedor si venía de un `Lot`.

## Decisión del usuario
- Sin lote: la etiqueta se ancla en la **fecha de compra** → imprime «LOTE compra DD/MM/AA».
- Origen: **desplegable de compras del artículo** (albaranes confirmados: fecha · proveedor).
- El **nombre del proveedor** se imprime siempre en las etiquetas de artículo manipulado.

## Cambios
- **schema** `FoodLabel`: `supplierName` (snapshot, se imprime siempre) + `purchaseDate`
  (HANDLED sin lote: ancla de trazabilidad). Migración `20260910194500_food_label_supplier_and_purchase_date`.
- **context** `forProduct`: nuevo `purchases[]` = líneas de albarán CONFIRMADO/ARCHIVADO
  del artículo sin `Lot` asociado (fecha, proveedor, cantidad).
- **DTO** `sourcePurchaseLineId`.
- **create()** HANDLED:
  - lote de proveedor (Lot o texto a mano) → como antes, `lotNumber` = ese.
  - sin lote + compra elegida → `purchaseDate` + `supplierName` snapshot;
    `lotNumber` = identificador interno `PREFIJO-C<DDMMAA>[-N]` (no se imprime, satisface
    `@@unique`), con reintento ante colisión.
  - sin lote y sin compra → 400.
  - `supplierName` = proveedor del Lot / de la compra / del artículo.
- **PDF**: `LOTE compra <fecha>` cuando HANDLED sin `sourceLotId` con `purchaseDate`;
  `Prov.: <supplierName>` siempre que se conozca.
- **frontend**: picker unificado «Lote o compra del proveedor» (optgroups Lotes / Compras),
  detalle y ficha pública `/e/[token]` muestran «compra <fecha>» + proveedor + fecha de compra.

## Verificación
- `jest src/modules/etiquetado` 60/60 (5 tests nuevos).
- `tsc` back y front, eslint limpios.
- Navegador: etiqueta HANDLED del rodaballo de Makro → picker lista «compra 02/09/26 · Makro»,
  se crea con `lotNumber` interno `METR-C020926`, PDF imprime «LOTE compra 02/09/26» y
  «Prov.: Makro». Etiqueta de prueba borrada.

## Fuera de alcance
- Registrar un `Lot` de proveedor a posteriori sobre un albarán ya confirmado.
- Editar el proveedor/fecha de compra desde el formulario de «Corregir».
