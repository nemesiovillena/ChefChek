# Research: Cuiner — plato «Caña» enlazado a «Barril El Águila Dorada 30L»

Fecha: 2026-10-19 14:23

## Pregunta
Si enlazo el plato Caña (venta directa) al artículo Barril 30L, ¿qué se descuenta?

## Hallazgo (código)
- `CuinerDishMap` (schema.prisma) = `recipeId` **o** `productId`. Sin campo cantidad.
- Venta directa → `directProductFormats()` (`backend/src/modules/cuiner/cuiner-recipe-consumption.ts:128`):
  `unidades × factor("ud" → referenceUnit) / unitSize`.
- Barril en BD local: `referenceUnit=litro`, `unitSize=30`.
- `getUnitToReferenceFactor("ud","litro")` → categorías distintas → devuelve **1**.
- Resultado: **1 caña = 1 L = 1/30 barril**. Real ≈ 0,2 L → descuenta **×5 de más**.
  100 cañas → 3,33 barriles descontados vs 0,67 reales.
- No se descuenta el barril entero (salvo artículo con unitSize=1), pero el dato es igual de falso.

## Recomendación (sin código)
Crear receta «Caña»: 1 ración, ingrediente Barril 30L = 0,2 L (o 20 cl; ajustar por espuma/merma, p. ej. 0,22 L).
Enlazar plato Caña → receta, no → artículo.
`explodeRecipe`: 0,2 L × 1/1 ración / 30 = 0,00667 barril por caña. Correcto.
Extra: la receta da escandallo/coste por caña.
Mismo patrón: tubo/jarra/copa de vino de botella, cualquier "porción de un formato grande".

## Alternativa (código) — no recomendada ahora
Añadir `quantity`+`unit` a `CuinerDishMap` para venta directa. YAGNI: la receta ya lo resuelve y añade coste.

## Gotcha
- Venta directa sólo vale cuando 1 venta = 1 ud del artículo (botellín, refresco lata).
- Cualquier artículo con referenceUnit kg/L enlazado como venta directa descuenta 1 kg/1 L por venta. Candidato a aviso en el panel de enlaces.
- No enlazar «Envase BARRIL 30L» (es el casco/fianza).

## Preguntas abiertas
- ¿Mostrar aviso en Almacén › Cuiner cuando se enlaza venta directa a artículo en kg/L?
- Medida real de la caña en la casa (20 cl servida vs tirada con espuma).
