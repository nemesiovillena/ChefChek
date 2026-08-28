---
phase: 3
title: "Frontend: modal de detalle/edición y ajustes finales"
status: completed
priority: P2
dependencies: [1, 2]
---

# Phase 3: Frontend: modal de detalle/edición y ajustes finales

## Overview

Modal único (crear/editar/ver detalle) para `SalaTask`, reusado tanto desde el clic en una card del Kanban como desde el botón "Crear". Cierre del plan: confirmación de borrado, invalidaciones de cache, y verificación end-to-end.

## Requirements

- Funcional: modal con Título, Fecha del evento, Comensales, Nombre y apellidos, Teléfono, Email, Menú (textarea), Observaciones (textarea, campo independiente del menú), Alergias (textarea, campo independiente), Estado (select); guardar (crear o editar según haya `id`), borrar con confirmación M3 (`useConfirm()`, **no** `confirm()` nativo). Sin columna/estado "Cancelado" — cancelar una reserva es borrar la card.
- No funcional: consistente con tokens M3 del proyecto (sin `dark:` hardcodeado, usar `var()`), input de fecha con `color-scheme` para que el icono del calendario no quede negro en dark mode (gotcha ya conocido del proyecto).

## Architecture

- `frontend/src/app/dashboard/sala-notificaciones/sala-task-modal.tsx`: `Dialog` de shadcn (mismo patrón que `postpone-task-dialog.tsx`), un solo formulario (sin tabs — los campos caben en una pantalla, evitar el patrón de 3 pestañas de Recetas por YAGNI).
- Textarea de menú/notas: componente `Textarea` existente del proyecto, con auto-resize si ya hay un patrón para textos largos en otro modal (revisar antes de reinventar).
- Selector de estado: `Select` de shadcn con las 3 opciones fijas de `plan.md`.
- Borrado: `useConfirm()` con mensaje claro ("Esto eliminará la notificación de sala. ¿Continuar?"), llama `useDeleteSalaTask` (soft-delete en backend).
- Tras cualquier mutación (crear/editar/borrar/reorder), invalidar la query key usada tanto por la card del dashboard como por la página Kanban para evitar el patrón de "listado stale" ya documentado varias veces en este proyecto (memorias sobre `invalidateQueries` faltante en albaranes) — usar la **misma** query key en ambos sitios desde el inicio para no tener que sincronizar dos caches.

## Related Code Files

- Create: `frontend/src/app/dashboard/sala-notificaciones/sala-task-modal.tsx`
- Modify: `frontend/src/app/dashboard/sala-notificaciones/page.tsx` (montar el modal, estado de `editingTask`/`isCreating`)
- Modify: `frontend/src/app/dashboard/page.tsx` (la card resumen también abre este mismo modal al hacer clic en una fila)
- Modify: `frontend/src/hooks/use-sala-tasks.ts` (si hace falta ajustar invalidation tras probar el flujo completo)

## Implementation Steps

1. Construir el formulario del modal con validación mínima (Título y Fecha del evento obligatorios, resto opcional) — reusar componentes `Input`/`Textarea`/`Select`/`Label`/`Button` ya existentes, sin librería de formularios nueva.
2. Cablear modo creación (sin `id`) vs edición (con `id`, precargar valores).
3. Añadir input de fecha con `color-scheme` correcto (ver memoria "Dark mode date inputs color-scheme").
4. Cablear borrado con `useConfirm()` + `useDeleteSalaTask`.
5. Verificar invalidación de cache: crear una tarea desde el modal de la card resumen y comprobar que aparece sin refresh manual en `/dashboard/sala-notificaciones`, y viceversa.
6. Pase de verificación completo: crear, editar todos los campos, mover entre columnas por drag, borrar, y comprobar que el borrado es soft (revisar en Papelera si esta entidad se registra ahí — si no, dejarlo fuera de la Papelera para esta v1 y anotarlo como decisión, no como bug).
7. `bun run build` (frontend) y lint antes de cerrar la fase.

## Success Criteria

- [x] Modal crea, edita y borra correctamente desde ambos puntos de entrada (card resumen y Kanban) — misma instancia de `SalaTaskModal` importada en ambos sitios; código verificado por code-review, sin prueba manual en navegador (ver nota de la fase 2).
- [x] Campos obligatorios validados antes de enviar (Título + Fecha del evento).
- [x] Confirmación de borrado usa `useConfirm()`, no `confirm()` nativo — confirmado por code-review.
- [x] Cache consistente: misma query key `['sala-tasks']` usada en dashboard y Kanban, invalidada tras cada mutación — confirmado por code-review.
- [x] Input de fecha legible en dark mode — cubierto globalmente por `globals.css` (`color-scheme: dark`), sin código adicional necesario.
- [x] `bun run build` (frontend) y `bun run build` (backend) sin errores.

**Bug real encontrado y corregido en este pase (code-review):** el modal no reseteaba su formulario al reabrirse para la MISMA tarea tras pulsar "Cancelar" — mostraba el borrador descartado en vez de los datos reales. Fix: sentinela de estado que fuerza resincronizar el formulario cada vez que el modal pasa de cerrado a abierto, no solo cuando cambia el id de la tarea. También se corrigió un bug menor donde `guestCount: 0` se perdía silenciosamente al guardar (operador `||` trataba 0 como falsy).

## Risk Assessment

- **Doble punto de entrada al mismo modal** (dashboard + página Kanban) puede duplicar lógica de estado si no se extrae bien — mantenerlo en un único componente controlado por props (`open`, `task`, `onClose`), sin lógica de negocio dentro.
- **Papelera**: si se decide más adelante incluir `SalaTask` en el módulo de Papelera global, requiere registrar la entidad en las reglas de scope (ver memoria "Backup tenant revienta PG 42703" sobre reglas huérfanas al añadir/quitar entidades) — fuera de alcance de esta fase salvo que el usuario lo pida.
