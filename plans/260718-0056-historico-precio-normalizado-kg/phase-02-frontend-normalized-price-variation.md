# Phase 02 — Frontend: variación % normalizada en badge/tabla/gráfico

**Status:** done
**Depende de:** Phase 01 (los campos `previousUnitSize`/`newUnitSize` deben existir en
la respuesta del endpoint y en `latestPriceChange` del listado).

**Owner files (exclusivos de esta fase):**
- `frontend/src/hooks/use-product-price-history.ts` (tipo `PriceHistoryEntry`)
- `frontend/src/hooks/use-products.ts` (tipo `latestPriceChange`; reutilizar `getReferencePrice`)
- `frontend/src/components/products/product-price-trend-badge.tsx`
- `frontend/src/components/products/product-price-history-table.tsx`
- `frontend/src/components/products/product-price-history-chart.tsx`
- `frontend/src/app/dashboard/articulos/page.tsx` (caller del badge)

## Contexto verificado (file:line)

- `getReferencePrice` frontend (reutilizar):
  `frontend/src/hooks/use-products.ts:242-245`
  `getReferencePrice(product) => product.purchasePrice / (product.unitSize || 1)`.
  Nota: la firma actual toma el `product` entero. Para el histórico se necesita una
  división genérica `precio/unitSize` → extraer/añadir un helper puro
  `normalizePrice(price, unitSize)` (o inline con guardia `unitSize || 1`). Preferir un
  helper pequeño compartido (DRY) en `use-products.ts` y usarlo en los 3 componentes.
- Badge: `product-price-trend-badge.tsx:15-19` (tipo `LatestPriceChange`), `:22-29`
  (props), `:51-57` (cálculo `pct = (current - previous)/previous*100`). Usa `current`
  (precio live del producto), no `newPrice`.
- Caller del badge: `articulos/page.tsx:645-651` — pasa `current={product.purchasePrice}`
  y `latestPriceChange`. `product.unitSize` está disponible aquí (mismo objeto).
- Tipo `latestPriceChange`: `use-products.ts:65-69`.
- Tabla: `product-price-history-table.tsx:55-58`
  (`change = newPrice - previousPrice`, `pctChange`).
- Gráfico: `product-price-history-chart.tsx:59-61` (`price: newPrice`, `previous:
  previousPrice`) y `:99-104` (delta en el tooltip).
- Hook tipo `PriceHistoryEntry`: `use-product-price-history.ts:5-14`.

## Regla de cálculo (única, compartida)

```
normalize(price, unitSize) = unitSize ? price / unitSize : price   // guardia 0/null

pct normalizado cuando previousUnitSize Y (newUnitSize|currentUnitSize) existen:
  prevNorm = normalize(previousPrice, previousUnitSize)
  currNorm = normalize(<precio actual>, <unitSize actual>)
  pct = (currNorm - prevNorm) / prevNorm * 100

fallback (falta algún unitSize → fila legacy): comportamiento IDÉNTICO al de hoy
  pct = (<precio> - previousPrice) / previousPrice * 100
```

Fila legacy = `previousUnitSize == null || <unitSize del nuevo> == null`. No marcar ni
ocultar, solo caer al crudo (decisión del usuario).

## Pasos

1. **Tipos**:
   - `use-product-price-history.ts:5-14`: añadir `previousUnitSize: number | null;`
     `newUnitSize: number | null;` a `PriceHistoryEntry`.
   - `use-products.ts:65-69`: añadir `previousUnitSize?: number | null;`
     `newUnitSize?: number | null;` a `latestPriceChange`.
   - `product-price-trend-badge.tsx:15-19`: añadir los dos campos a `LatestPriceChange`.

2. **Helper compartido**: en `use-products.ts` exportar
   `normalizePrice(price: number, unitSize?: number | null): number` con guardia
   `unitSize ? price / unitSize : price`. Importarlo en los 3 componentes.
   (No reimplementar la división inline — DRY.)

3. **Badge** (`product-price-trend-badge.tsx`):
   - Añadir prop `currentUnitSize?: number | null` (el `unitSize` live del producto).
   - `:51-57`: si `latestPriceChange.previousUnitSize != null && currentUnitSize != null`
     → normalizar (`prevNorm = normalize(previousPrice, previousUnitSize)`,
     `currNorm = normalize(current, currentUnitSize)`); si no, fallback crudo actual.
   - Mantener las guardas existentes (`previous > 0`, `change === 0 → null`) sobre los
     valores ya normalizados.
   - Ajustar el `title`/tooltip (`:66`) para mostrar el precio de referencia normalizado
     cuando aplique (opcional pero coherente).

4. **Caller badge** (`articulos/page.tsx:645-651`): pasar
   `currentUnitSize={product.unitSize}`.

5. **Tabla** (`product-price-history-table.tsx:55-58`): por fila, si ambos unitSize del
   entry existen → `change = normalize(newPrice,newUnitSize) - normalize(previousPrice,
   previousUnitSize)` y `pct` sobre `prevNorm`; si no, fallback crudo. Considerar mostrar
   el €/kg en la celda (coherente con la columna "Precio Referencia"), opcional.

6. **Gráfico** (`product-price-history-chart.tsx:59-61, 99-104`): construir los puntos
   con `price`/`previous` normalizados cuando el entry tenga ambos unitSize (si no,
   crudos). El tooltip (`:99-104`) recalcula el delta desde `payload.previous` → hereda
   la normalización automáticamente al normalizar en el mapeo de puntos.

## Riesgos

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|------------|
| Mezcla de puntos normalizados y crudos en el gráfico (serie discontinua legacy+nuevo) | Media | Medio | Por punto: normalizar solo si ese entry tiene ambos unitSize; visualmente puede haber salto en el corte legacy→nuevo (aceptable, decisión del usuario de mostrar legacy tal cual) |
| Badge usa `current` (live) con `currentUnitSize` (live) pero `previous` con snapshot histórico → correcto solo si el unitSize live no cambió desde el registro | Baja | Bajo | Es el comportamiento deseado: compara el €/kg vigente contra el €/kg del último registro |
| `unitSize` undefined en el objeto product del listado | Baja | Bajo | Guardia `?? null` → fallback crudo |
| Ruptura de contrato si backend aún no despliega campos | Media | Alto | Campos opcionales (`?`); fallback crudo si ausentes → sin crash |

## Rollback

Revertir cambios de componentes/tipos (git). Sin estado persistido en frontend; los
campos backend quedan ignorados sin efecto.

## Done = observable

- `npm run build` (frontend) sin errores de tipo.
- En la ficha del jarrete de cordero: el badge muestra ≈0% (o desaparece) cuando el
  €/kg real no cambió pese a distinto tamaño de caja; muestra variación real cuando el
  €/kg sí cambió.
- Filas legacy (sin unitSize) siguen mostrando exactamente el % de antes.
