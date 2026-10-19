# Research: Cuiner — medidas de servicio (bebidas y porciones de formato grande)

Fecha: 2026-10-19 14:33. Sigue a `research-261019-1423-cuiner-cana-barril-venta-directa-descuento-report.md`.

## Problema
Venta directa hoy = 1 venta → 1 ud de referencia del artículo (`directProductFormats`). Artículo en L/kg → descuenta 1 L / 1 kg por venta. Afecta a destilados, licores, vino por copa, cerveza de barril, café, aceite.
Receta por plato funciona pero no escala: cientos de recetas de un solo ingrediente, y cambiar la medida del chupito = editar 85 recetas.

## Datos (BD local, catálogo Cuiner del tenant)
- 1085 platos tipo P. Formato en el nombre: CHUPITO/CHUP 85, PIEDRA 75, TUBO 52, COMBI/COMBINADO 49, COPA 36, CAFE 9, CAÑA 6, JARRA 3.
- ≈300 platos = «MARCA + MEDIDA» (BARCELO CHUPITO / PIEDRA / TUBO / COMBINADO).
- Modificadores tipo I existen (GINGER ALE, DESCAFEINADO SOBRE…) → refrescos pueden venir como línea aparte.
- Ningún plato enlazado aún (cuiner_dish_maps vacío local) → cambio de modelo sin migrar datos.
- Unidades soportadas: g/kg, ml/cl/l, ud (`UNIT_ALIASES`).

## Propuesta: «Medidas de servicio»
1. **Catálogo por tenant** (Ajustes › Cuiner o Almacén): nombre, cantidad, unidad, palabras clave del TPV.
   Ej.: Chupito 4 cl [CHUPITO, CHUP] · Piedra 5 cl · Tubo 5 cl · Combinado 6 cl [COMBI] · Copa licor 5 cl · Copa vino 15 cl · Caña 20 cl · Caña doble 40 cl · Jarra 50 cl · Café 7 g · Botella = 1 ud.
2. **Enlace venta directa = artículo + medida** (o cantidad libre). Sin medida = 1 ud (comportamiento actual: lata, botellín).
3. **Consumo**: `unidades × cantidad medida → unidad ref. artículo / unitSize`. Barceló 0,7 L, chupito 4 cl → 0,04/0,7 = 0,057 botellas.
4. **Enlace masivo asistido**: agrupa platos sin enlazar por marca (nombre − palabra de medida), sugiere artículo (ranking de búsqueda ya existente) y medida (palabra clave). Usuario revisa y confirma en bloque.
5. **Cambiar una medida** (chupito 4→3 cl) actualiza todos los platos enlazados a ella desde ese momento. Movimientos ya aplicados no se tocan.
6. **Varios artículos → receta** (café con leche, café irlandés, clara con gaseosa, combinado con refresco incluido no marcado como modificador).
7. Merma (espuma, goteo): meterla en la cantidad de la medida (caña 22 cl). Sin campo aparte (YAGNI).

```
Plato TPV «BARCELO CHUPITO» ──► Artículo «Ron Barceló 0,7L» + Medida «Chupito 4 cl»
Plato TPV «BARCELO PIEDRA»  ──► Artículo «Ron Barceló 0,7L» + Medida «Piedra 5 cl»
Plato TPV «CAFE CON LECHE»  ──► Receta (café 7 g + leche 0,12 L)
Modificador «GINGER ALE»    ──► Artículo «Ginger Ale» (1 ud)
```

## Modelo (borrador)
- `ServingMeasure { id, tenantId, name, quantity, unit, keywords[] }`
- `CuinerDishMap` + `servingMeasureId?` + `quantity?` + `unit?` (cantidad libre sin medida).
- Validación: medida en volumen/peso enlazada a artículo cuya unidad de referencia no es convertible → error al enlazar, no aviso tardío.

## Alternativas descartadas
- Receta por plato: correcta pero 300 recetas de 1 ingrediente; cambiar medida = N ediciones.
- Cantidad libre por enlace sin catálogo: 300 cifras sueltas, sin cambio centralizado.

## Preguntas abiertas
- Medidas reales de la casa (chupito, piedra, tubo, combinado, copa vino, caña, café).
- COMBI/TUBO: ¿refresco incluido en el plato o se marca como modificador en el TPV?
- «COPA» ambigua (brandy 5 cl vs vino 15 cl): ¿dos medidas y elegir al enlazar? (propuesta: sí; sugerencia por categoría del artículo).
- ¿Mostrar coste por servicio / margen por copa? (fuera de alcance inicial).
