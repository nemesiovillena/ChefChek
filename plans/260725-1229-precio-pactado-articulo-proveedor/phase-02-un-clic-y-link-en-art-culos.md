---
phase: 2
title: Un clic y link en Artículos
status: completed
priority: P2
dependencies:
  - 1
  - 3
effort: M
---

# Phase 2: Un clic y link en Artículos

⚠️ **Esta fase se ejecuta en dos tramos** (ver `plan.md` § Orden de ejecución):
- **Pasos 1-2** (extraer `AgreedPriceCell` + botón 1-clic): sin dependencias, se pueden hacer justo después de la Fase 1.
- **Paso 3** (link "ir a ficha"): requiere que la Fase 3 exista (usa el componente que construye).

## Overview

Hoy, en `tab-proveedor-stock.tsx`, fijar el precio pactado de una oferta exige teclear el número a mano aunque `offer.purchasePrice` ya está en pantalla (línea 420), y el nombre del proveedor (línea 419) es texto plano sin ningún link. Esta fase: (a) extrae la celda de edición de `agreedPrice` a un componente reutilizable con un botón 1-clic "usar precio actual", y (b) convierte el nombre del proveedor en un botón que abre la ficha del proveedor (diálogo construido en la Fase 3).

## Key Insights

- `startEditAgreed`/`handleSaveAgreed` (`tab-proveedor-stock.tsx:370-394`) ya implementan editar y limpiar (`agreedPrice: null` → "Sin pactar") — no reescribir esa lógica, solo extraerla y añadirle el atajo de 1-clic.
- El guardado ya pasa por `useUpdateSupplierOffer` (`use-products.ts`) → `PATCH /v1/products/:productId/supplier-offers/:offerId` con `{ purchasePrice: offer.purchasePrice, agreedPrice }`. El botón 1-clic reusa exactamente esa misma mutación, solo que con `agreedPrice: offer.purchasePrice` calculado en el propio click, sin pasar por el input.
- `agreedAt` se re-estampa solo si el valor cambia de verdad (`buildAgreedFields`, backend) — guardar el mismo valor dos veces es un no-op seguro, no hay que proteger contra doble-click.
- El componente de destino del link (Fase 3) se llama `SupplierOffersFichaDialog` — confirmar el nombre exportado real al implementar la Fase 3 antes de escribir el import aquí (evitar nombre inventado que no coincida).

## Requirements

- Funcional:
  - Botón "usar precio actual" junto a cada oferta: 1 clic → guarda `agreedPrice = offer.purchasePrice` de inmediato (sin paso de confirmación).
  - Se mantiene la edición manual y el "Sin pactar" (limpiar) tal cual funcionan hoy.
  - Nombre del proveedor en cada fila pasa a ser un botón/link que abre `SupplierOffersFichaDialog` con ese `supplierId`.
- No funcional: no duplicar la lógica de edición de `agreedPrice` — un solo componente para ella, reutilizado también en la Fase 3.

## Architecture

Extraer de `SupplierOffersSection` (dentro de `tab-proveedor-stock.tsx`) un componente `AgreedPriceCell`:

```
Props: {
  agreedPrice: number | null;
  currentPrice: number;       // offer.purchasePrice
  isSaving: boolean;
  onSave: (value: number | null) => void;  // llama a updateOffer.mutateAsync internamente en el caller
  readOnly?: boolean;         // default false. Fase 2 (Artículos) NO lo pasa — ver nota Fase 3 Risk Assessment:
                              // tab-proveedor-stock.tsx hoy no tiene gating de rol en frontend, y arreglar eso
                              // queda fuera de alcance de este plan. Solo la Fase 3 (ficha de Proveedores) lo usa.
}
```

Estados internos del componente: idle (muestra "Pactado: X" o "Sin pactar" + botón usar-precio-actual + pencil + clear-si-hay-pactado) / editing (input numérico + check/cancel, igual que hoy). El botón "usar precio actual" solo se muestra en idle y llama `onSave(currentPrice)` directo — no entra en modo editing.

## Related Code Files

- Create: `frontend/src/app/dashboard/articulos/components/agreed-price-cell.tsx` — componente extraído.
- Modify: `frontend/src/app/dashboard/articulos/components/tab-proveedor-stock.tsx` — sustituir el bloque inline (líneas ~370-394 estado + ~472-520 render) por `<AgreedPriceCell />`; convertir `offer.supplier?.name` (línea 419) en botón que abre el diálogo de la Fase 3, con estado local `fichaSupplierId` para controlar apertura.
- Read-only reference: `frontend/src/hooks/use-products.ts` (`useUpdateSupplierOffer`, tipo `ProductSupplierOffer`) — no modificar, solo consumir.

## Implementation Steps

1. Crear `agreed-price-cell.tsx` con la UI extraída de `tab-proveedor-stock.tsx` (icono `Tags`, texto "Pactado: {formatEuro}" / "Sin pactar", botón pencil→input+step 0.001+Check/X). Añadir un botón nuevo (ej. icono `Copy` o `ArrowDownToLine`, título "Usar precio actual ({formatEuro(currentPrice)})") visible solo cuando no se está editando, que llama `onSave(currentPrice)` directo.
2. En `tab-proveedor-stock.tsx`, sustituir el bloque de estado (`editingAgreedId`, `agreedPriceInput`, `startEditAgreed`, `handleSaveAgreed`) por el uso de `<AgreedPriceCell agreedPrice={offer.agreedPrice} currentPrice={offer.purchasePrice} isSaving={updateOffer.isPending} onSave={(value) => updateOffer.mutateAsync({ productId, offerId: offer.id, purchasePrice: offer.purchasePrice, agreedPrice: value })} />` (ajustar nombres de props reales del hook `useUpdateSupplierOffer` — verificar firma exacta en `use-products.ts` antes de escribir la llamada).
3. Verificar comportamiento sin cambios: limpiar a "Sin pactar" sigue enviando `agreedPrice: null`; editar manual sigue abriendo el input.
4. Añadir estado `const [fichaSupplierId, setFichaSupplierId] = useState<string | null>(null)` en `SupplierOffersSection` (o en `TabProveedorStock` si el diálogo debe montarse fuera de la sección). Cambiar `<span>{offer.supplier?.name}</span>` por `<button onClick={() => setFichaSupplierId(offer.supplierId)} className="...hover:underline...">{offer.supplier?.name}</button>`.
5. **(Requiere Fase 3 completada)** Importar `SupplierOffersFichaDialog` de su ubicación real (Fase 3) y montarlo condicionalmente: `{fichaSupplierId && <SupplierOffersFichaDialog supplierId={fichaSupplierId} onClose={() => setFichaSupplierId(null)} />}`.
6. Probar en el modal de Artículo (ej. Aceite de girasol / Bodegas Ruiz): click en "usar precio actual" fija el pactado sin teclear nada; click en el nombre del proveedor abre la ficha.

## Success Criteria

- [x] Click único en "usar precio actual" guarda `agreedPrice` = precio actual sin pasos intermedios. <!-- confirmado por code-reviewer: onClick={() => onSave(currentPrice)} directo -->
- [x] Edición manual y "Sin pactar" siguen funcionando igual que antes de la extracción (regresión cero). <!-- confirmado por code-reviewer vía diff línea a línea contra el código pre-extracción -->
- [x] Click en nombre del proveedor abre `SupplierOffersFichaDialog` con el proveedor correcto.
- [x] `AgreedPriceCell` no duplica lógica — es el único lugar donde se renderiza/edita `agreedPrice` en el frontend (junto con su reuso en la Fase 3).

## Risk Assessment

- Riesgo bajo: refactor de UI ya probada, sin cambios de contrato backend.
- Cuidado: al extraer, no perder el `isSaving`/estado de carga por-fila (si dos ofertas se editan casi a la vez, cada `AgreedPriceCell` debe tener su propio estado, no uno global compartido — ya lo tenía así el código original vía `editingAgreedId` por oferta, mantener esa granularidad en el componente extraído).
