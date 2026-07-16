# Fase 06: Frontend — UI albarán manual (`dashboard/compras`)

**Estado: ✅ implementada, con desviación de maquetación.** El grid de 12 columnas ya estaba completo (4+2+1+2+2+1=12); en vez de forzar una columna más, el input de lote se añadió como segunda fila por línea, siempre visible (mismo patrón que el bloque condicional de Categoría). No probado manualmente en navegador.

## Contexto
`manual-albaran-form.tsx` (348 líneas) permite crear un albarán 100% manual desde cero (sin OCR), con su propio estado de línea local. `use-manual-albaran.ts` define `ManualAlbaranLineInput` (sin `lot`) y envía a `POST /v1/albaranes/manual` (cableado en fase 03).

## Archivos a modificar
- `frontend/src/hooks/use-manual-albaran.ts`
- `frontend/src/components/albaranes/manual-albaran-form.tsx`

## Implementación

### 1. `use-manual-albaran.ts` — tipo `ManualAlbaranLineInput` (líneas 4-12)
Añadir `lot?: string;`

### 2. `manual-albaran-form.tsx`
- Línea de estado inicial (`emptyLine()`, ~línea 45): añadir `lot: ''` al objeto devuelto.
- Bloque de inputs por línea (alrededor de líneas 252-292, junto a cantidad/unidad/precio): añadir un input de texto para "Lote" siguiendo el mismo patrón `value={line.lot ?? ''}` / `onChange={(e) => updateLine(line.id, { lot: e.target.value })}`.
- Payload de envío (líneas ~113-131, dentro del `.filter().map()` que arma `lines` para `useCreateManualAlbaran`): añadir `lot: l.lot?.trim() || undefined,`.

## Tests / validación
- Prueba manual en navegador: `dashboard/compras` → crear albarán manual → rellenar lote en una línea → guardar → verificar en el detalle del albarán resultante que la línea tiene el lote (usando la vista de fase 05, ya que el albarán manual también aterriza en `lineas/page.tsx` una vez creado).
- `npm run build` en `frontend/` sin errores de tipos.

## Riesgos y rollback
- Ninguno — cambios de UI aditivos.
- Rollback: revertir el commit.
