# Fase 2 — Frontend: pestaña Medidas + selector en enlace

## Archivos
- `frontend/src/app/dashboard/cuiner/page.tsx` (nueva pestaña «Medidas»)
- nuevo `frontend/src/app/dashboard/cuiner/components/cuiner-serving-measures-tab.tsx`
- `frontend/src/app/dashboard/cuiner/components/cuiner-link-cell.tsx` / `cuiner-dishes-tab.tsx`
- `frontend/src/hooks/use-cuiner.ts`, `frontend/src/lib/cuiner-types.ts`
- nuevo helper puro `frontend/src/lib/cuiner-suggest-serving-measure.ts` (+ test si hay runner)

## Pasos
1. Pestaña Medidas: tabla nombre / cantidad+unidad / palabras clave; alta, edición, borrado (useConfirm, sin confirm nativo). Tokens M3, sin text-gray-800 (shim dark).
2. Al elegir un artículo para un plato: selector de medida (por defecto «1 unidad»). Sugerencia: palabra clave más larga que aparece en el nombre del plato («CAÑA DOBLE» gana a «CAÑA»). Empate COPA → «Copa vino» si categoría del artículo contiene vino/cava, si no «Copa licor».
3. Mostrar en la fila enlazada: «Ron Barceló 0,7 L · Chupito 4 cl».
4. Invalidar listas tras mutación (patrón list+detalle).
5. Móvil: tabla apilada max-md con data-label; inputs ≥16px.

## Validación
- Navegador :3000 (verificar cwd del dev server): enlazar BARCELO CHUPITO, CAÑA, ANIS SECO COPA HIELO; ver sugerencia correcta.
- Dark mode y móvil.
