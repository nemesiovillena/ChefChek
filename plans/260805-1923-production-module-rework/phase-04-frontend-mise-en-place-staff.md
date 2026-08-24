# Fase 4: frontend de Mise en Place y Asignación de personal

## Status (2026-08-06)
**Completada y verificada en navegador real.** Endpoints backend nuevos añadidos (no estaban en fase 2, eran necesarios para que la UI funcionase): `GET production/staff` (listado completo, `staff/available` no sirve para gestión porque excluye inactivos), `GET production/orders/:orderId/tasks`, `GET production/orders/:orderId/mise-en-place-sheet` (busca por orden, devuelve `null` si no existe — el frontend no tenía forma de descubrir un `sheetId` sin esto), filtro `?orderId=` opcional en `GET production/assignments`.

**Bug real encontrado en pruebas de navegador**: los items de mise en place (`MiseEnPlaceItem`) se crean con `orderId` pero el DTO nunca acepta/asigna `sheetId` — la relación `MiseEnPlaceSheet.items` de Prisma (basada en `sheetId`) venía siempre vacía aunque el POST de creación devolviera 201. Fix: `getMiseEnPlaceSheet`/`getMiseEnPlaceSheetByOrder` ahora buscan los items por `orderId` directamente (que es como se crean en la práctica), no vía la relación Prisma.

Decisiones de alcance:
- "Responsables" del lote sigue siendo texto libre (fase 3); el picker de `StaffMember` para asignar personal a **tareas** sí usa `StaffMember` real (vía `GET staff/available`).
- Checklist de la hoja de mise en place se crea vacía (`checklists: []`) — no hay endpoint para marcar/desmarcar items del checklist después de crearlo (limitación real del diseño original, documentada, no se inventó una UI para algo no soportado por el backend). La parte funcional/interactiva es el listado de `MiseEnPlaceItem` con estado (PENDING→IN_PROGRESS→READY→VERIFIED), que sí está completo.
- CRUD de personal: alta + activar/desactivar (soft, vía `isActive`), sin edición de nombre/rol desde la UI todavía (se puede añadir luego si hace falta, no bloqueaba esta fase).

## Validación manual — resultado
1. ✅ Crear miembro de personal → aparece en pestaña "Personal", 0/10 tareas.
2. ✅ Crear hoja de mise en place para una orden, añadir item, avanzar su estado hasta "Verificado", verificar la hoja completa → badge "Verificada".
3. ✅ Crear tarea de producción, asignarla al personal creado → tarea pasa a ASSIGNED, contador de tareas del personal sube a 1/10.
4. ✅ Completar la asignación (con tiempo real) → tarea COMPLETED, contador de tareas del personal vuelve a 0/10.

## Gotcha de herramienta (no del código)
Confirmado el mismo patrón ya visto en fase 3: `agent-browser click`/`find ... click` no dispara el evento en varios botones de esta app (toggle de expandir orden, "Crear hoja de mise en place", botón "+" de crear tarea/item, tabs "Lotes y órdenes"/"Personal"). Workaround: `agent-browser eval` con `.click()` DOM directo, que sí funciona siempre. No bloqueó la verificación, solo la hizo más lenta.

## Contexto
- Endpoints backend ya existen (`production.controller.ts:156-291`): mise en place (crear hoja, listar, añadir item, actualizar estado, verificar hoja) y personal/tareas (crear asignación, listar, actualizar, staff disponible, tareas de un miembro).
- No existe ningún `StaffMember` gestionable desde la UI hoy — hace falta un CRUD mínimo (alta/baja/edición) antes de poder asignar tareas a alguien real.
- Depende de fase 2 (schema/servicio corregidos) y fase 3 (existencia de lotes/órdenes reales sobre los que colgar mise en place/tareas).

## Requisitos

### CRUD mínimo de `StaffMember`
- No hay pedido explícito de gestión completa de personal (nombre, rol, horas disponibles, máx. tareas) en ningún otro módulo — **decisión: CRUD mínimo dentro de este mismo módulo** (`production/components/staff-list.tsx` + `staff-create-dialog.tsx`), no un módulo nuevo separado, para no ampliar el alcance más de lo pedido.
- Campos: nombre, rol (texto libre o select con roles de cocina comunes), email opcional, horas disponibles, máx. tareas simultáneas.
- Endpoint backend: no existe todavía (`GET staff/available` sí, pero no `POST staff`/`PUT staff/:id`) — **añadir a fase 2** (`CreateStaffMemberDto`, `UpdateStaffMemberDto`, endpoints `POST production/staff`, `PUT production/staff/:staffId`) si no se añadió ya; si fase 2 ya se cerró sin esto, es un ajuste retroactivo a esa fase, no una fase nueva.

### Mise en Place (por orden de producción)
- Desde el detalle de una orden (dentro de `batch-detail-panel.tsx` de fase 3, o un detalle de orden propio): botón "Crear hoja de mise en place" → diálogo con zona de cocina (heredada de la orden/lote) y checklist inicial (`CreateChecklistItemDto[]`: item, descripción, categoría `EQUIPMENT`/`INGREDIENTS`/`TOOLS`/`SANITATION`).
- Vista de checklist: cada item con estado (`PENDING`/`IN_PROGRESS`/`READY`/`VERIFIED`), checkbox o stepper para avanzar estado, botón "Verificar hoja completa" (solo habilitado si todos los items están `READY`).

### Asignación de personal a tareas
- Requiere primero crear `ProductionTask` (endpoint nuevo de fase 2, `POST production/tasks`) desde el detalle de la orden: título, tipo (`PREPARATION`/`COOKING`/`PLATING`/`QUALITY_CHECK`), tiempo estimado.
- Luego, por cada tarea: selector de personal disponible (`GET staff/available?zone=`, filtrado por la zona del lote) → `POST assignments`. Mostrar capacidad (`assignedTasks`/`maxTasks`) en el selector para que se vea por qué alguien no aparece disponible.
- Vista "Mis tareas" por miembro del staff (`GET staff/:staffId/tasks`) — opcional si no hay login por rol de cocina distinto del actual sistema de usuarios; **confirmar con el usuario si esto aplica** (el sistema de auth actual es por `User`/tenant, no por `StaffMember`, así que esta vista sería solo consultiva desde el panel de administración, no un login de cocinero).

## Archivos a modificar/crear
- Backend (ajuste retroactivo a fase 2 si hace falta): `production.dto.ts` (`CreateStaffMemberDto`, `UpdateStaffMemberDto`, `CreateProductionTaskDto`), `production.service.ts`, `production.controller.ts`.
- `frontend/src/hooks/use-production-staff.ts` (nuevo, separado del hook de lotes/órdenes por claridad)
- `frontend/src/app/dashboard/production/components/staff-list.tsx`
- `frontend/src/app/dashboard/production/components/staff-create-dialog.tsx`
- `frontend/src/app/dashboard/production/components/mise-en-place-checklist.tsx`
- `frontend/src/app/dashboard/production/components/task-assignment-panel.tsx`

## Validación manual
1. Crear un miembro de staff, verlo en "disponibles".
2. Crear una hoja de mise en place para una orden, marcar todos los items como listos, verificarla.
3. Crear una tarea de producción y asignarla al staff creado; verificar que `assignedTasks` sube y que al superar `maxTasks` el backend rechaza (400 ya implementado en servicio).

## Riesgos / rollback
- Riesgo de alcance: el CRUD de `StaffMember` podría "crecer" hacia gestión de RRHH completa si no se limita — mantener estrictamente los campos que el servicio de producción ya usa (`isActive`, `availableHours`, `maxTasks`, `assignedTasks`, `completedTasks`), sin añadir nómina/horarios/turnos (eso ya existe o no en `user-management-future-fields-address-payroll`, dominio distinto).
- Rollback: solo frontend + ajuste menor de backend (nuevo DTO/endpoint aislado), revertir commits basta.
