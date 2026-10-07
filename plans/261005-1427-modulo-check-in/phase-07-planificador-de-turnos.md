---
phase: 7
title: Planificador de turnos
status: completed
priority: P2
effort: 28-34h
dependencies:
  - 6
---

# Phase 7: Planificador de turnos

## Overview

Panel de planificación visual inspirado en Skello: rejilla semanal empleados × días con arrastrar y soltar, plantillas, copia de semana y publicación con aviso al equipo. Es la fase de mayor peso de interfaz.

## Requirements

- Funcional: crear/mover/duplicar/borrar turnos; plantillas; turnos partidos; turnos sin asignar; copiar semana; borrador y publicación; vistas día/semana/mes; ausencias y festivos superpuestos; totales por empleado y por día.
- No funcional: fluido con 40 empleados × 7 días; usable en tablet; edición móvil limitada a consulta y cambios puntuales.

## Architecture

- `ShiftTemplate`: `name`, `startTime`, `endTime`, `breakMinutes`, `color`, `section?`.
- `Shift`: `locationId`, `employeeId?` (nulo = turno abierto), `date`, `startTime`, `endTime` (fin < inicio = cruza medianoche), `breakMinutes`, `section?`, `jobTitle?`, `note?`, `status` (`DRAFT|PUBLISHED`), `templateId?`. Soft-delete.
- `SchedulePublication`: `locationId`, `weekStart`, `publishedByUserId`, `publishedAt`, resumen de cambios. Cada republicación crea fila nueva.
- Los empleados solo ven turnos `PUBLISHED`.
- API por semana: `GET /turnos/schedule?locationId&weekStart` devuelve empleados, turnos, ausencias y festivos en una sola respuesta; mutaciones individuales con actualización optimista (React Query).
- Rejilla: filas agrupadas por sección, columnas por día; `@dnd-kit` (ya usado en el dashboard); celda = lista de turnos; arrastrar entre celdas mueve, con modificador duplica.
- Copiar semana: endpoint servidor que clona turnos omitiendo días con ausencia aprobada.

## Related Code Files

- Modify: `backend/prisma/schema.prisma`, `turnos.module.ts`, reglas de Backup y Papelera, `nav-config.ts`
- Create: migración `<ts>_shifts`
- Create: `backend/src/modules/turnos/schedule.controller.ts`, `services/shifts.service.ts`, `services/shift-templates.service.ts`, `services/schedule-publication.service.ts`, `dto/` + specs
- Create: `frontend/src/app/dashboard/turnos/page.tsx`, `frontend/src/features/turnos/components/` (`schedule-grid.tsx`, `schedule-row.tsx`, `shift-card.tsx`, `shift-editor-dialog.tsx`, `template-palette.tsx`, `week-navigator.tsx`, `publish-bar.tsx`), `hooks/use-schedule.ts`

## Implementation Steps

1. Boceto de la rejilla (wireframe) y validación con el usuario antes de programar la interfaz.
2. Modelos y migración.
3. `ShiftsService` con validaciones (solape del mismo empleado, ausencia aprobada, empleado de baja).
4. Endpoint agregado de semana y mutaciones.
5. Rejilla estática con datos reales; luego arrastrar y soltar; luego duplicar.
6. Plantillas y paleta lateral; diálogo de edición (ancho suficiente para todas las columnas).
7. Copiar semana y turnos abiertos.
8. Publicación: diferencias respecto a la última publicación, notificación a afectados (`Alert` + email opcional).
9. Vistas día y mes (solo lectura en mes).
10. Prueba de arrastre real en navegador (el comando de alto nivel de agent-browser no sirve con `@dnd-kit`).

## Success Criteria

- [x] Rejilla semanal por persona y día, agrupada por sección, con fila de turnos abiertos (navegador)
- [x] Crear un turno desde una celda, con plantilla o a mano; editar y borrar (e2e + navegador)
- [x] Arrastrar un turno a otro día o persona, con ratón real en el navegador; opción de duplicar al arrastrar
- [x] Turno partido y turno que cruza la medianoche (unit + e2e)
- [x] No se pisan turnos de una misma persona ni se planifica sobre una ausencia aprobada (e2e)
- [x] Copiar semana respeta ausencias y no duplica al repetir (e2e)
- [x] Borradores invisibles para el empleado hasta publicar; constancia de cada publicación (e2e)
- [x] Ausencias y festivos visibles en la rejilla; horas por persona (frente a las pactadas) y por día
- [ ] Notificar a los afectados al publicar (no hay notificaciones)
- [ ] Vistas de día y de mes (solo semana)
- [ ] Fluidez con 40 empleados y uso en tablet (sin probar)

## Risk Assessment

- Complejidad de interfaz subestimada → wireframe aprobado primero; entregar por capas (estática → arrastre → extras).
- Regresión con `sortOrder`/dnd del dashboard → componentes propios, sin tocar los existentes.
- Turnos que cruzan medianoche → mismo criterio que el calculador (día de inicio).

## Desviaciones (2026-10-07)

- **Sin boceto previo**: el usuario pidió construir directamente según el PDR.
- **Publicación simple**: `Shift.status` (borrador/publicado) y una fila de `schedule_publications` por publicación. Publicar pasa a publicado todos los borradores de la semana. Los cambios sobre un turno ya publicado son visibles al momento; no hay "cambios pendientes" ni aviso a los afectados.
- **Sin `templateId`, `section` ni `jobTitle` en `Shift`**: la plantilla solo rellena horas y color al crear; la sección es la de la ficha del empleado.
- **Borrado físico** de turnos (no hay soft-delete): un turno planificado no es evidencia legal, lo es el fichaje.
- **Duplicar al arrastrar** con una casilla, no con tecla modificadora, para que funcione en tablet.
- **Solo vista de semana.** Día y mes quedan fuera.
- **Empleados del centro**: la rejilla muestra a quien está asignado al centro elegido; solo se le puede planificar ahí.
- **Mis turnos**: lista de las próximas cuatro semanas, en la misma página.
