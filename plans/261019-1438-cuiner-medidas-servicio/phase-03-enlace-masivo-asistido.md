# Fase 3 — Enlace masivo asistido

## Archivos
- `backend/src/modules/cuiner/cuiner-mapping.service.ts` + controller: `PUT /cuiner/maps/dishes/bulk` (array SetDishMapDto, transacción, mismas validaciones)
- `backend/src/modules/cuiner/cuiner-catalog-search-ranking.ts` (reusar para sugerir artículo)
- nuevo endpoint `GET /cuiner/maps/dishes/suggestions`: platos P sin enlazar cuyo nombre contiene palabra clave de medida → { marca (nombre − palabra), medida sugerida, artículo sugerido + confianza }
- nuevo `frontend/src/app/dashboard/cuiner/components/cuiner-bulk-link-dialog.tsx`

## Pasos
1. Agrupar por marca normalizada (sin acentos, sin «CHUP/CHUPITO/PIEDRA…», sin puntos): BARCELO → [CHUPITO, PIEDRA, TUBO, COMBINADO].
2. Sugerir artículo por ranking existente; solo artículos con ref en volumen/peso.
3. Diálogo: un grupo por fila, artículo editable (picker), medidas por plato editables, casilla por grupo. «Enlazar seleccionados» → bulk.
4. Grupos sin artículo sugerido quedan desmarcados.

## Validación
- Tenant clonado de prod: ~300 platos, revisar 10 grupos al azar.
- Bulk con un plato inválido → no aplica nada (transacción) y dice cuál.

## Preguntas abiertas
- ¿Incluir modificadores tipo I (refrescos) en el asistente con medida «1 unidad»? Propuesta: sí, segunda sección.
