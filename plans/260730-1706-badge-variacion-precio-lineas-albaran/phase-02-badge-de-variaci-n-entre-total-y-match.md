---
phase: 2
title: Badge de variación entre Total y Match
status: completed
priority: P3
dependencies:
  - 1
---

# Phase 2: Badge de variación entre Total y Match

## Overview

Nuevo componente presentacional `LinePriceChangeBadge` + nueva columna en la tabla de
Líneas (`lineas/page.tsx`) que lo renderiza entre "Total" y "Match". Compara el precio
efectivo de la línea contra `line.matchedProduct.purchasePrice`.

## Requirements

- Funcional:
  - Badge ↑X,X% en rojo si el precio efectivo de línea es mayor que el vigente del
    artículo; ↓X,X% en verde si es menor. Sin badge si no aplica (ver Success Criteria).
  - El precio efectivo de línea reproduce EXACTAMENTE la fórmula usada en
    `AlbaranStockService` al confirmar (mismo dato, para que el badge sea un preview fiel):
    ```ts
    // backend/src/modules/albaranes/services/albaran-stock.service.ts:94-105
    let lineUnitPrice = Number(line.unitPrice);
    if (albaran.applyDiscountToCost && line.totalPrice !== null && lineQuantity > 0) {
      lineUnitPrice = Number(line.totalPrice) / lineQuantity;
    }
    ```
  - Tolerancia: usar el mismo umbral relativo que `referencePriceChanged` en
    `frontend/src/hooks/use-products.ts:352` (0,5%) para no pintar badges por ruido de
    redondeo — no reimplementar la constante, importarla o replicar el mismo valor con
    comentario que referencie el porqué (evitar drift silencioso si cambia allí).
- No funcional: no altera `lineAmount`/`totalPrice` ni ningún cálculo existente de la
  columna "Total" (línea 585-623 de `lineas/page.tsx`) — es una columna nueva, de solo
  lectura, sin mutación.

## Architecture

**Por qué componente nuevo y no reutilizar `ProductPriceTrendBadge`:** ese componente
recibe `latestPriceChange` (objeto sourceado de `ProductPriceHistory`, con snapshot de
`unitSize` para normalizar €/kg) y abre un Dialog con gráfico + tabla de historial. Aquí
no hay snapshot de `unitSize` por línea (el albarán no captura formato/unitSize por línea,
solo `quantity` + `unit` de texto libre del OCR) y la comparación es contra un único precio
vigente, no una serie histórica — forzar el mismo componente exigiría inventar un
`latestPriceChange` sintético y arrastrar el Dialog/gráfico sin datos reales que mostrar.
Un componente pequeño y sin estado es más simple y correcto para este caso (KISS).

**Qué SÍ se reutiliza:** la convención visual (rojo=sube/verde=baja, iconos
`TrendingUp`/`TrendingDown` de `lucide-react`, pill `text-xs font-medium rounded-full`) se
copia de `product-price-trend-badge.tsx:97-110` para consistencia visual en toda la app,
sin importar el componente en sí (semántica de datos distinta, ver arriba).

## Related Code Files

- Create: `frontend/src/components/albaranes/line-price-change-badge.tsx`
- Modify: `frontend/src/app/dashboard/albaranes/[id]/lineas/page.tsx`

## Implementation Steps

1. Crear `frontend/src/components/albaranes/line-price-change-badge.tsx`:
   ```tsx
   'use client';

   import { TrendingUp, TrendingDown } from 'lucide-react';
   import { cn } from '@/lib/utils';
   import { referencePriceChanged } from '@/hooks/use-products';

   interface LinePriceChangeBadgeProps {
     /** Precio efectivo de esta línea (bruto o neto según applyDiscountToCost). */
     effectivePrice: number;
     /** purchasePrice vigente del artículo emparejado, antes de confirmar. */
     previousPrice: number | null | undefined;
   }

   /**
    * Preview de variación de precio en Líneas de albarán: compara el precio
    * efectivo de la línea (aún sin confirmar) contra el purchasePrice vigente
    * del artículo. Convención de color del proyecto: rojo = sube, verde = baja
    * (misma que ProductPriceTrendBadge en Artículos). A diferencia de ese
    * componente, NO sourcea de ProductPriceHistory (que solo se escribe al
    * confirmar) — compara contra el precio EN FICHA ahora mismo, como preview
    * de lo que pasará si se confirma este albarán.
    */
   export function LinePriceChangeBadge({
     effectivePrice,
     previousPrice,
   }: LinePriceChangeBadgeProps) {
     if (!previousPrice || previousPrice <= 0) return null;
     if (!referencePriceChanged(previousPrice, effectivePrice)) return null;

     const pct = ((effectivePrice - previousPrice) / previousPrice) * 100;
     const isUp = effectivePrice > previousPrice;

     return (
       <span
         title={`Precio vigente: ${previousPrice.toFixed(2)} €`}
         className={cn(
           'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
           isUp ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700',
         )}
       >
         {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
         {isUp ? '+' : ''}
         {pct.toFixed(1)}%
       </span>
     );
   }
   ```
   Nota: `referencePriceChanged(previous, current)` ya existe en `use-products.ts:352` y
   usa el mismo umbral relativo (0,5%) que el resto de badges de precio de la app — se
   importa tal cual, no se reimplementa (DRY).

2. En `frontend/src/app/dashboard/albaranes/[id]/lineas/page.tsx`:
   - Añadir el import:
     ```ts
     import { LinePriceChangeBadge } from '@/components/albaranes/line-price-change-badge';
     ```
   - Añadir cabecera de columna entre "Total" y "Match" (línea 432-433):
     ```tsx
     <TableHead>Total</TableHead>
     <TableHead>Variación</TableHead>
     <TableHead>Match</TableHead>
     ```
   - Añadir la celda correspondiente entre la celda de "Total" (termina línea 623) y la
     celda de "Match" (línea 624-626):
     ```tsx
     <TableCell>
       {(() => {
         if (!line.matchedProduct) return null;
         const lineQuantity = Number(line.quantity);
         const effectivePrice =
           albaran?.applyDiscountToCost && line.totalPrice !== null && lineQuantity > 0
             ? line.totalPrice / lineQuantity
             : line.unitPrice;
         return (
           <LinePriceChangeBadge
             effectivePrice={effectivePrice}
             previousPrice={line.matchedProduct.purchasePrice}
           />
         );
       })()}
     </TableCell>
     ```
   - Actualizar `colSpan={9}` → `colSpan={10}` en la fila de `CreateProductInline`
     (línea 634), para que siga ocupando el ancho completo con la columna nueva.

3. Verificación visual (dev server, `bun run dev` en `frontend/`): abrir un albarán
   PENDIENTE/REVISADO con líneas ya emparejadas a artículos, comprobar:
   - Línea con precio más alto que el vigente → badge rojo ↑.
   - Línea con precio más bajo → badge verde ↓.
   - Línea con precio igual (o diferencia ≤0,5%) → sin badge.
   - Línea sin `matchedProduct` (aún no vinculada) → sin badge, sin error en consola.
   - Con el toggle "aplicar descuento al coste" activado/desactivado (si el albarán tiene
     descuento de papel) → el badge cambia de valor según corresponda (usa `totalPrice`
     neto en vez de `unitPrice` bruto).

## Success Criteria

- [ ] Columna "Variación" visible entre "Total" y "Match" en la tabla de Líneas.
- [ ] Badge rojo ↑ / verde ↓ con el signo y color correctos, verificado en navegador con
      datos reales (subida y bajada).
- [ ] Sin badge cuando no hay `matchedProduct`, `purchasePrice` es 0/null, o la variación
      es ≤0,5%.
- [ ] El toggle "aplicar descuento al coste" (`applyDiscountToCost`) cambia el precio
      efectivo usado por el badge, igual que ya cambia la columna "Total".
- [ ] `colSpan` de la fila de creación inline de producto actualizado a 10.
- [ ] `npx tsc --noEmit` sin errores nuevos en `frontend/`.
- [ ] Sin cambios en `backend/` (fuera de alcance de esta fase — confirmado en Fase 1).

## Risk Assessment

- **Riesgo bajo, sin persistencia ni mutación.** Componente puramente derivado de datos ya
  presentes en la respuesta existente; ningún endpoint nuevo, ninguna migración.
- **Limitación conocida (no es bug):** tras confirmar el albarán, `matchedProduct.purchasePrice`
  ya se actualizó al precio de esta misma línea (escrito por `AlbaranStockService`), así que
  al revisar Líneas de un albarán ya CONFIRMADO el badge no mostrará variación (ambos lados
  son ahora el mismo número). Es el comportamiento esperado dado que la semántica elegida es
  "preview antes de confirmar", no "historial de lo que pasó" — no requiere mitigación en
  este plan.
- **Rollback:** revertir el commit de este plan; no toca datos persistidos.
