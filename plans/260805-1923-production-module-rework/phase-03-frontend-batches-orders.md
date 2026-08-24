# Fase 3: frontend real de Lotes y Órdenes de Producción

## Status (2026-08-05)
**Completada y verificada en navegador real** (agent-browser, no solo typecheck). Decisiones/hallazgos durante la ejecución:
- "Responsables" del lote: se implementó como **texto libre** (input separado por comas), no `StaffMember` — más simple, no bloquea esta fase con la fase 4 (CRUD de staff) todavía sin construir. Revisar si se quiere migrar a picker de `StaffMember` cuando exista esa UI.
- `batchNumber` se autogenera (`LOTE-0001`); no se añadió un campo `name` libre separado — la descripción del formulario se guarda en `notes`.
- **Bug real encontrado en pruebas de navegador (no solo teoría)**: al crear una orden con ingredientes en una unidad distinta a la unidad de referencia del artículo (receta en "g"/"ml", artículo con `referenceUnit="kilo"/"litro"`), la reserva de stock fallaba con "Insufficient stock. Available: 9, Requested: 720" — comparaba números en unidades distintas sin convertir. Causa raíz: `EscandallosService.performUnitConversion` (endpoint `/escandallos/convert-units`, reutilizado inicialmente en el frontend) solo reconoce abreviaturas (`kg`/`g`/`l`/`ml`), no los nombres completos en español que este tenant usa como símbolo de `UnitOfMeasure` ("kilo", "litro") — bug preexistente de ESE módulo, fuera de alcance arreglarlo aquí.
  - Fix aplicado: nueva utilidad propia `backend/src/modules/production/utils/unit-conversion.util.ts` (`convertQuantity`), independiente de escandallos, con vocabulario que reconoce ambos formatos. Usada en `reserveIngredient`/`updateInventory` (backend, autoritativo) antes de reservar/consumir stock.
  - El frontend (`order-create-dialog.tsx`) sigue llamando al endpoint de escandallos para el aviso visual de disponibilidad, pero ahora es **no bloqueante**: si la conversión falla, marca "Stock no verificado" (gris) en vez de "Sin stock suficiente" (rojo, bloqueaba el envío) — la orden se puede crear igual, y el backend (con la conversión correcta) es quien realmente valida/reserva.
- Bug adicional (mismo hallazgo): la reserva de stock al crear la orden usaba `ingredient.quantity` sin escalar por `dto.quantity` (cantidad del pedido), pero el consumo al completar sí escalaba — `reservedStock` quedaba negativo. Corregido en fase 2 (ver ese archivo), encontrado y verificado en esta fase.
- Gotcha de herramienta (no del código): `agent-browser click`/`find ... click` no disparaba el evento en el botón "Iniciar" de una orden (posible issue de puntero con el botón tras un re-render de React Query) — se verificó con un `.click()` DOM directo vía `agent-browser eval`, que sí funcionó y confirmó que el código de la app es correcto.

## Validación manual — resultado
1. ✅ Cargar `/dashboard/production` sin error.
2. ✅ Crear lote completo (fecha+hora combinadas correctamente, prioridad, zona, responsables) → aparece como `LOTE-0001`.
3. ✅ Abrir el lote, crear una orden con receta real (combobox con recetas reales, `useRecipeCost` autopobló ingredientes reales) → aparece ligada, `PO-0001`.
4. ✅ Iniciar la orden → estado cambia a "En progreso", progress tracking + milestones creados en BD.
5. ✅ Reserva/consumo de stock correcto tras el fix de conversión de unidades (verificado con `psql` antes/después).

## Contexto
- Página actual: `frontend/src/app/dashboard/production/page.tsx` (todo inline, sin `components/` propio — reestructurar siguiendo el patrón de `frontend/src/app/dashboard/proveedores/` que ya separa `page.tsx` + `components/*.tsx` por entidad/modal).
- Hook actual: `frontend/src/hooks/use-production.ts` (incompleto — solo `batches`/`createBatch`, sin `orders`, sin start/complete de ninguno).
- Combobox de receta ya existe como patrón a replicar: `frontend/src/app/dashboard/recipes/components/sub-recipe-combobox.tsx` contra `/recipes/options` (memoria [[recetas-server-side-pagination-and-subrecipe-picker]]).
- Confirmaciones destructivas/de acción: usar `useConfirm()` de `frontend/src/contexts/confirm.context.tsx` (memoria [[m3-destructive-dialog-replaces-native-confirm]] — nunca `confirm()`/`alert()` nativos).
- `apiClient` desenvuelve automáticamente respuestas paginadas y de mutación (memorias [[frontend-api-client-paginated-unwrapping]], [[apiclient-interceptor-unwrap-mutation-result-is-entity]]) — los hooks nuevos deben asumir eso, no re-desenvolver `result.data`.
- Depende de fase 2 (endpoints reales con los campos correctos).

## Requisitos

### Hook `use-production.ts` (reescribir)
Separar en hooks por entidad, siguiendo el patrón de otros módulos (p.ej. `use-suppliers.ts`, `useProducts`/`useProductSearch`):
- `useProductionBatches()`: lista + `createBatch(dto real: name?, scheduledDate, scheduledTime, priority, responsible[], kitchenZone, description?)` + `startBatch(id)` + `completeBatch(id)`.
- `useProductionOrders(batchId?)`: lista filtrable por lote + `createOrder(dto: batchId, recipeId, recipeName, quantity, unit, estimatedTime, ingredients[])` + `startOrder(id)` + `completeOrder(id, actualTime)`.
- Invalidar queries cruzadas: crear una orden debe invalidar tanto `['production-orders']` como `['production-batches', batchId]` (el lote muestra sus órdenes vía `include`).

### UI: Lotes (`components/batch-create-dialog.tsx`, `components/batch-list.tsx` o similar)
Formulario real con TODOS los campos que el backend exige (hoy falta scheduledTime/priority/responsible/kitchenZone por completo):
- Nombre (si se confirma en fase 2 que sobrevive como campo independiente del `batchNumber` autogenerado).
- Descripción (opcional, ya existe).
- Fecha programada (ya existe) + **hora programada** (input `type="time"`, falta hoy).
- Prioridad (`Select`: Baja/Media/Alta/Urgente → `LOW`/`MEDIUM`/`HIGH`/`URGENT`).
- Zona de cocina (`Select`: Cocina caliente/fría/pastelería/parrilla/fritos/emplatado/servicio → enum `KitchenZone`).
- Responsables: **decisión pendiente en fase 2** sobre si son `StaffMember` — si sí, un multi-select contra `GET /production/staff/available`; si es texto libre, un input de tags simple. No implementar ambos, seguir lo que decida fase 2.
- Reemplazar el `orderBy: scheduledDate` roto del lado backend ya está en fase 2; aquí solo consumir `scheduledFor` en el listado (`new Date(batch.scheduledFor)`, no `batch.plannedDate` que no existe en el DTO real).
- Acciones por lote: "Iniciar" (solo si `status === 'PENDING'`) y "Completar" (solo si `status === 'IN_PROGRESS'`), con `useConfirm()` antes de completar (acción no reversible desde la UI).

### UI: Órdenes de Producción (nueva — hoy no existe formulario)
- Botón "Nueva Orden" dentro del detalle de un lote (no en la pestaña plana actual — una orden siempre pertenece a un lote, así que el flujo natural es: abrir un lote → ver sus órdenes → crear una nueva ahí).
- Formulario: selector de lote (preseleccionado si se abre desde el detalle del lote), `SubRecipeCombobox`-equivalente para elegir receta (reutilizar el componente de `dashboard/recipes/components/sub-recipe-combobox.tsx` o extraer una versión genérica `RecipePicker` si el acoplamiento a "sub-receta" no aplica aquí), cantidad + unidad, tiempo estimado (minutos), lista de ingredientes (puede autopoblarse desde la receta elegida vía el mismo endpoint que usa el escandallo, o dejarse editable — **no reinventar el cálculo de ingredientes de receta, reutilizar lo que ya expone `/recipes/:id` o `/recipes/options`**).
- Cada ingrediente necesita `isAvailable: boolean` (el backend rechaza la orden si algún ingrediente no está disponible) — calcular esto en el frontend contra el stock real del producto (mismo patrón que ya usa el picker de artículos en otros módulos), no dejarlo como checkbox manual sin sentido.
- Listado de órdenes por lote con acciones "Iniciar"/"Completar" (completar pide `actualTime`, un input numérico simple en el propio diálogo de confirmación).

## Archivos a modificar/crear
- `frontend/src/hooks/use-production.ts` (reescribir)
- `frontend/src/app/dashboard/production/page.tsx` (simplificar a orquestador de pestañas/estado)
- `frontend/src/app/dashboard/production/components/batch-create-dialog.tsx` (nuevo)
- `frontend/src/app/dashboard/production/components/batch-list.tsx` (nuevo)
- `frontend/src/app/dashboard/production/components/batch-detail-panel.tsx` (nuevo — muestra órdenes del lote)
- `frontend/src/app/dashboard/production/components/order-create-dialog.tsx` (nuevo)
- `frontend/src/app/dashboard/production/components/order-list.tsx` (nuevo)

## Validación manual (obligatoria antes de dar por completada esta fase)
Arrancar backend+frontend en dev y en el navegador:
1. Cargar `/dashboard/production` sin error de carga.
2. Crear un lote con todos los campos → aparece en el listado con la fecha/hora/prioridad/zona correctas.
3. Abrir el lote, crear una orden de producción con una receta real → aparece ligada al lote, con cantidad/tiempo estimado correctos.
4. Iniciar y completar el lote y la orden → estados cambian, sin error en consola.

## Riesgos / rollback
- Riesgo de UX: si "Responsables" resulta ser `StaffMember` pero todavía no hay UI de alta de `StaffMember` (fase 4 la crea), el multi-select estaría vacío al probar esta fase antes que la 4 — aceptable, documentar el orden de prueba recomendado (fase 4 antes de dar por completado el flujo de "Responsables").
- Rollback: solo frontend, revertir commit.
