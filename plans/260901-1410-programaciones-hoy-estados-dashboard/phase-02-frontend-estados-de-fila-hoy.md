---
phase: 2
title: 'Frontend: estados de fila HOY'
status: completed
priority: P2
dependencies:
  - 1
---

# Phase 2: Frontend: estados de fila HOY

## Overview

El listado de programaciones (`ProgramacionesTab`) sustituye "Próxima:" plano
por 3 estados con prioridad visual, y elimina el cálculo cliente `nextRun()`.

## Requirements

- Functional: prioridad de render por fila — `pendingDraft` > `runsToday` > futuro.
  1. **Pendiente de enviar**: `Pendiente de enviar · generado hoy HH:mm`
     (o `generado dd/mm HH:mm` si no es hoy) — `font-bold` + `var(--error)`.
     Es LA fila accionable.
  2. **Corre hoy**: `Hoy · HH:mm` — `font-bold` + `var(--primary)`.
     (No hay token warning/tertiary en globals.css; no inventar tokens nuevos.)
  3. **Futura**: `Próxima: <fecha formateada>` como ahora — color normal.
- Non-functional: cero cálculo de zona horaria en cliente; solo formatear lo
  que llega del backend.

## Architecture

- Tipo `PurchaseSchedule` del hook se extiende con los campos del contrato
  (fase 1). El flag server-side reemplaza cualquier comparación de fechas
  local; `dateKey` solo se formatea, nunca se compara.
- Formateador local pequeño `formatScheduleDate(dateKey)`: `yyyy-mm-dd` →
  `dd/mm` (mismo formato que `formatNextScheduledDate` del dashboard; extraer
  o duplicar 3 líneas — duplicar es aceptable, KISS sobre DRY aquí).
- "Última:" usa `ranToday` para mostrar `hoy HH:mm` en vez del timestamp
  completo cuando corresponde.

## Related Code Files

- Modify: `frontend/src/hooks/use-purchase-schedules.ts` (tipo)
- Modify: `frontend/src/app/dashboard/compras/components/programaciones-tab.tsx`
- Delete: función `nextRun()` en `programaciones-tab.tsx:21-43` (y su uso en
  línea 246).

## Implementation Steps

1. Extender `PurchaseSchedule` en `use-purchase-schedules.ts`:
   ```ts
   nextRunAt: { dateKey: string; timeOfDay: string } | null;
   runsToday: boolean;
   ranToday: boolean;
   pendingDraft: { orderId: string; generatedAt: string } | null;
   ```
2. En `programaciones-tab.tsx`, borrar `nextRun()` y añadir formateadores:
   ```ts
   const formatDateKey = (dateKey: string) => {
     const [, month, day] = dateKey.split('-');
     return `${day}/${month}`;
   };
   const formatGeneratedAt = (iso: string, ranToday: boolean) =>
     ranToday
       ? `hoy ${new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
       : new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
   ```
3. Sustituir el `<span>Próxima: …</span>` (línea ~245-247) por un render
   condicional con la prioridad de estados del enunciado. Ejemplo estado 1:
   ```tsx
   {schedule.pendingDraft ? (
     <span className="font-bold text-[var(--error)]">
       Pendiente de enviar · generado {formatGeneratedAt(schedule.pendingDraft.generatedAt, schedule.ranToday)}
     </span>
   ) : schedule.runsToday && schedule.nextRunAt ? (
     <span className="font-bold text-[var(--primary)]">
       Hoy · {schedule.nextRunAt.timeOfDay}
     </span>
   ) : schedule.enabled && schedule.nextRunAt ? (
     <span>Próxima: {formatDateKey(schedule.nextRunAt.dateKey)} · {schedule.nextRunAt.timeOfDay}</span>
   ) : (
     <span>Próxima: —</span>
   )}
   ```
4. "Última:" (línea ~248-252): si `ranToday`, mostrar `hoy HH:mm` (hora
   extraída de `lastRunAt`), si no el formato actual.
5. Nota `nextRun` de línea 21: el comentario "cliente, informativa" se elimina
   con la función — el server ahora manda la verdad.

## Success Criteria

- [ ] Con dos programaciones el mismo día, una con draft pendiente y otra sin
      correr aún, cada fila muestra su estado correcto y diferenciado.
- [ ] `nextRun()` cliente eliminado (grep sin resultados).
- [ ] Programación pausada muestra "Próxima: —" (igual que antes).

## Risk Assessment

- Riesgo bajo: cambio visual contenido en un componente. Los tags M3 con
  `var()` sin prefijo dark: siguen la convención del repo (memoria: tokens var()
  sin dark:).
- Mobile: los estados son texto en la línea de metadatos existente (flex-wrap);
  sin cambios de layout.
