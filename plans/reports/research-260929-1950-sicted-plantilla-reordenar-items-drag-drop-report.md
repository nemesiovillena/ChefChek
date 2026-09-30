# Research: reordenar ítems de plantilla SICTED (drag & drop)

Fecha: 2026-09-29 19:50 · Rama: feat/sicted-exportar-importar-plan

## Resumen ejecutivo

Cambio **solo frontend**. El backend ya guarda `position = índice del array` en crear y editar (`checklist-template.service.ts:157`, `:292`), lee ordenado por `position` (`ACTIVE_CHECKLIST_ITEMS`) y no hay `@@unique` sobre `position` → reordenar el array antes de guardar basta. Los ids de ítem se conservan al editar (`keepItemIds`), así que reordenar no rompe marcas ni el histórico.

`@dnd-kit/core` 6.3 + `sortable` 10 ya están instalados y usados en 5 sitios (dashboard, tareas producción, sala). Reusar el mismo patrón. Sin dependencias nuevas.

Fuentes: solo código del repo (0 búsquedas web; el patrón dnd-kit ya está probado en el proyecto).

## Hallazgos

| Punto | Estado | Fichero |
|---|---|---|
| Orden persistido | `position: index` en create y update | `backend/.../checklist-template.service.ts` |
| Lectura ordenada | `orderBy: { position: 'asc' }` | `constants/checklist-active-items.ts` |
| Restricción unique position | No existe | `schema.prisma` ~1092 |
| Hojas ya abiertas | Solo se re-snapshotean runs OPEN sin marcas → histórico intacto | service `update()` |
| Editor | `form.items.map(... key={idx})` | `sicted-template-editor.tsx:131` |
| ValidationPipe | `whitelist + forbidNonWhitelisted` | `backend/src/main.ts:77` |
| Patrón dnd-kit existente | Mouse(distance 8) + Touch(delay 200) + `arrayMove` | `production/tasks/page.tsx` |

## Trampas (importantes)

1. **`key={idx}` rompe al reordenar**: React reutilizaría inputs por índice → textos cruzados / foco perdido. Hace falta key estable. Ítems nuevos no tienen `id`.
2. **No meter una key cliente dentro del item**: `forbidNonWhitelisted` → 400 al guardar. Usar array paralelo `itemKeys: string[]` (`crypto.randomUUID()`), movido con el mismo `arrayMove` en add/remove/drag.
3. **Arrastre por asa, no por tarjeta entera**: la tarjeta tiene inputs/textarea; con `listeners` en todo el div no se puede seleccionar texto ni escribir en móvil. Usar `setActivatorNodeRef` + `listeners` solo en un icono `GripVertical` (≥40px táctil).
4. **Tarjetas altas**: con procedimiento largo el arrastre es incómodo. Opción: durante drag, colapsar a solo la etiqueta — YAGNI salvo que moleste. dnd-kit autoscroll funciona dentro del contenedor scrollable del modal.
5. **Móvil / accesibilidad**: añadir `KeyboardSensor` + `sortableKeyboardCoordinates` (barato). Opcional botones ↑/↓ como alternativa sin arrastre.

## Recomendación

dnd-kit con asa + keys paralelas. ~40-60 líneas, 2 ficheros:

- `sicted-template-editor.tsx`: `DndContext` + `SortableContext(itemKeys, verticalListSortingStrategy)`, sensores Mouse/Touch/Keyboard como en tareas, `onDragEnd` → `arrayMove` sobre `form.items` y `itemKeys` a la vez; `addItem`/`removeItem` mantienen `itemKeys` en sincronía.
- `sicted-template-item-editor.tsx`: prop `sortableId`, `useSortable`, asa `GripVertical` a la izquierda de la etiqueta.

```tsx
// editor
const [itemKeys, setItemKeys] = useState(() => form.items.map(() => crypto.randomUUID()));
function handleDragEnd({ active, over }: DragEndEvent) {
  if (!over || active.id === over.id) return;
  const from = itemKeys.indexOf(String(active.id));
  const to = itemKeys.indexOf(String(over.id));
  setItemKeys((k) => arrayMove(k, from, to));
  setForm((p) => ({ ...p, items: arrayMove(p.items, from, to) }));
}

// item
const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
  useSortable({ id: sortableId });
<div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
  <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners}
    className="touch-none cursor-grab h-10 w-10" aria-label="Mover ítem"><GripVertical/></button>
```

Alternativa considerada: solo botones ↑/↓ (más simple, accesible) — peor UX para mover un ítem nuevo desde el final a posición 2 de 20. Descartado como solución única; válido como complemento.

## Validación sugerida

- Crear plantilla, añadir 3 ítems, mover el 3º al 1º, guardar → reabrir: orden persistido.
- Editar plantilla con marcas previas, reordenar → hoja de hoy sin marcas refleja orden nuevo; hojas con marcas mantienen su snapshot.
- Escribir en un ítem tras reordenar → el texto va al ítem correcto (verifica keys).
- Móvil: arrastrar por asa; scroll normal tocando la tarjeta.

## Preguntas abiertas

- ¿Añadir también ↑/↓ para móvil, o basta el asa?
- ¿El orden de la hoja del día que ya tiene marcas debe actualizarse? (Hoy no: snapshot congelado — coherente con inalterabilidad SICTED.)
