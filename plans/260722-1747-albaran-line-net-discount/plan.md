# Albarán: importe neto de línea + descuento

## Contexto
Al importar el albarán A11118, el sistema muestra por línea 41,00 € / 27,50 € (calculados como `cantidad × precio bruto`) en vez de los 36,08 € / 24,20 € que dice el papel. Causa raíz probada en BD + código: el OCR (Gemini Flash, confianza 36,5%) extrae **bien** el `total_price` de cada línea (el neto del papel, con un descuento del 12% aplicado), pero `quantity`/`unit_price` no cuadran con ese total (`2×20,5=41≠36,08`). El backend (`albaranes.service.ts:486`) **descarta** `product.total_price` y recalcula `lineAmount = qty × unit_price` (41,00). Ese neto del papel no se persiste en ninguna columna (solo sobrevive en `ocrRawData.products[].total_price`). Adicionalmente, al confirmar, el coste/escandallos se alimentan del `unitPrice` bruto (`albaran-stock.service.ts:74`), así que un artículo con dto queda con el coste inflado.

NO es doble IVA: el IVA (4%) está aplicado coherentemente (`priceWithVat = unitPrice×1,04`).

Resultado esperado: ver el importe del papel (36,08/24,20) y el descuento (12%) en cada línea; y poder aplicar ese descuento al coste al confirmar, bajo control del usuario.

## Decisiones (aprobadas)
1. Línea → mostrar **ambos** importes (bruto + neto del papel) + % descuento. No cambiar el cálculo por defecto de `lineAmount`.
2. Total del albarán → **del OCR** (no recalcular).
3. Coste → mostrar neto/dto siempre; aplicar dto al precio de compra/escandallos **solo bajo confirmación del usuario** (flag opt-in, por defecto `false`).

## Modelo de datos (migración, columna nullable → sin pérdida de datos)
- `AlbaranLine.totalPrice  Float?` — importe neto de la línea leído del papel (`product.total_price`), sin IVA y con descuento. Fuente de verdad persistida (hoy se pierde).
- `Albaran.applyDiscountToCost  Boolean @default(false)` — opt-in: al confirmar, usar el precio unitario neto (`totalPrice/qty`) para coste en lugar del bruto.
- `discountPercent` se **deriva** en lectura (`1 - totalPrice/(qty×unitPrice)`) — no se persiste (DRY, sin drift).

## Fase 1 — Display (resuelve el bug reportado)
Backend:
- `prisma/schema.prisma`: añadir `totalPrice` (AlbaranLine) y `applyDiscountToCost` (Albaran). Migración SQL nullable/default.
- `albaranes.service.ts:486` (import OCR): persistir `totalPrice: product.total_price ?? null` (mantener `lineAmount` bruto).
- `albaranes.service.ts:64` (create DTO) + `CreateAlbaranLineDto`: aceptar `totalPrice?` opcional (round-trip).
- `albaranes.controller.ts:106`: dejar de recalcular `total_price` como `qty×unitPrice`; devolver el `line.totalPrice` almacenado.
Frontend:
- `lib/api-albaran.ts`: añadir `totalPrice?: number|null` a `AlbaranLine` y `applyDiscountToCost?: boolean` a `Albaran`.
- `app/dashboard/albaranes/[id]/lineas/page.tsx:480`: columna "Total" → si hay `totalPrice` que difiera del bruto, mostrar neto como principal + badge `−12% dto` + bruto tachado en pequeño; si no, `lineAmount` como hoy.

## Fase 2 — Coste bajo confirmación (opt-in)
- `albaran-stock.service.ts` (confirm path, ~línea 74): cargar `albaran.applyDiscountToCost`; si true y la línea tiene `totalPrice` y `quantity>0`, usar `netUnit = totalPrice/quantity` como precio unitario para `purchasePrice`/`netPrice`/histórico/ofertas/acuerdos. Si no, `unitPrice` bruto (comportamento actual).
- Endpoint + UI: toggle `applyDiscountToCost` en la página Resumen (card Totales), visible solo si alguna línea tiene dto. Persistir vía update del albarán. El botón Confirmar refleja el estado.

## Verificación
- Re-aplicar migración a la BD activa (brew :5432, docker caído; `bunx prisma migrate dev` o `db push` + `prisma generate`). Regenerar cliente, rebuild+restart backend.
- BD: tras re-procesar/abrir A11118, `SELECT "totalPrice" FROM albaran_lines` = 36.08/24.20.
- UI: la columna Total muestra 36,08 / 24,20 con `−12% dto` y el bruto 41,00 / 27,50 tachado.
- Confirmar sin flag → `purchasePrice` queda bruto (20,5). Activar flag + confirmar → `purchasePrice` = 18,04 y `ProductPriceHistory.newPrice` = 18,04. Escandallo baja 12%.
- Lint/typecheck backend + frontend; specs de albaranes no rotos.

## Riesgos / rollback
- Columna nullable + flag default false → sin cambio de comportamiento para albaranes sin dto ni para los existentes. Rollback = quitar columnas (seguro, son opcionales).
- Cuidado con BD divergentes (brew:5432 vs docker:5433): migrar SOLO la BD que usa :3001 (hoy brew:5432). Nunca full-reset.
