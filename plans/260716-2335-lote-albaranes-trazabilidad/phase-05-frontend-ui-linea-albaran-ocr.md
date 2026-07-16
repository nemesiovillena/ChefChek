# Fase 05: Frontend — UI línea de albarán (flujo OCR/PENDIENTE)

**Estado: ✅ implementada.** Columna "Lote" propia (no sub-línea bajo Descripción, según lo decidido en el diseño). No probado manualmente en navegador — solo typecheck/lint; queda pendiente de verificación visual por el usuario.

## Contexto
`frontend/src/lib/api-albaran.ts` ya tipa `AlbaranLine.lot` (línea 15) y `updateLine()` ya acepta `lot?: string` (línea 164) — el backend ya lo soporta (confirmado, y reforzado en fase 02). El único gap es la UI: `lineas/page.tsx` no renderiza ninguna celda de lote, y `add-line-form.tsx`/`addAlbaranLine()` no lo incluyen al añadir una línea manual dentro de un albarán ya existente.

## Archivos a modificar
- `frontend/src/app/dashboard/albaranes/[id]/lineas/page.tsx`
- `frontend/src/components/albaranes/add-line-form.tsx`
- `frontend/src/lib/api-albaran.ts`

## Implementación

### 1. `api-albaran.ts` — `addAlbaranLine()` (línea ~237-251)
Añadir `lot?: string` al tipo de `data` del parámetro.

### 2. `lineas/page.tsx` — columna Lote
Tabla actual (líneas 359-370): `Descripción | Cantidad | Precio | IVA | Total | Match | Estado | Acciones`. Añadir `<TableHead>Lote</TableHead>` tras "Descripción" (columna propia, no como sub-línea bajo Descripción — el lote es un dato de trazabilidad primario, no metadato secundario como `articleNumber`).

Celda nueva (patrón calcado de la celda `articleNumber`, líneas 391-405), usando `EditableLineCell field="lot"` cuando `isEditable(line)`, texto plano si no:
```tsx
<TableCell>
  {isEditable(line) ? (
    <EditableLineCell
      albaranId={id}
      lineId={line.id}
      field="lot"
      value={line.lot}
      onSave={refetch}
    />
  ) : (
    line.lot || '—'
  )}
</TableCell>
```
Insertar como `<TableCell>` propia entre la de "Descripción" (línea 375-412) y la de "Cantidad" (línea 413-442).

### 3. `add-line-form.tsx` — campo Lote
- Añadir estado: `const [lot, setLot] = useState('');`
- Añadir input en el grid (tras el de "Precio unidad", junto a "Total línea" o en nueva fila — decisión de maquetación libre, mantener `grid-cols-2`):
```tsx
<div>
  <Label htmlFor="line-lot" className="text-xs">Lote</Label>
  <Input
    id="line-lot"
    value={lot}
    onChange={(e) => setLot(e.target.value)}
    placeholder="Nº de lote (opcional)"
    className="h-8 text-sm"
  />
</div>
```
- Incluir en el `addAlbaranLine()` del `handleSubmit` (línea 44-50): `lot: lot.trim() || undefined,`

## Tests / validación
- `npm run build` (o `next build`) en `frontend/` sin errores de tipos — atención al aviso en `frontend/AGENTS.md`: este proyecto usa una versión de Next.js con posibles cambios respecto al conocimiento previo; revisar `node_modules/next/dist/docs/` si algo no compila como se espera.
- Prueba manual en navegador: abrir un albarán en estado `PENDIENTE`, editar el lote de una línea existente vía la nueva celda, verificar que persiste tras recargar. Añadir una línea manual con lote y verificar que se guarda.
- Verificar que en líneas no editables (`CONFIRMADO`/`RECHAZADO`) el lote se muestra en solo lectura, igual que el resto de campos.

## Riesgos y rollback
- Ninguno — cambios de UI puramente aditivos sobre componentes ya preparados para el campo (`EditableLineCell` es genérico por `field`, no requiere cambios propios).
- Rollback: revertir el commit.
