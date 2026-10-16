# Hojas SICTED en día de cierre declarado el mismo día

Fecha: 2026-10-14 (miércoles). Caso: Warynessy abre mié–dom; esta semana abrió lun 12 (festivo), cerró mar 13 y mié 14.

## Qué hay ya (en prod desde #286)
- `Tenant.closedWeekdays` + `TenantCalendarException` (CLOSED/OPEN). UI: Configuración → SICTED.
- `ensureRunsForToday` no genera nada en día cerrado (`checklist-run.service.ts:67`).
- Botón «justificar en bloque» para vencidas de periodos enteramente cerrados (`justifyClosedDayRuns`).

## Por qué hoy salen hojas
1. Cron 00:10 (`checklist-run-scheduler.service.ts:31`) generó las hojas del miércoles: no había excepción CLOSED para el 14.
2. Añadir la excepción después NO borra ni oculta las hojas ya creadas: `listCurrentRuns` (`:100`) enseña siempre las DAILY del día, sin mirar el calendario.
3. Mañana a las 00:10 pasan a INCOMPLETE y lanzan una alerta «Hoja sin completar» por hoja (campana), aunque el día fuese de cierre.

## Solución inmediata (sin código)
- Configuración → SICTED → excepción **Cerramos** 14/10/2026 (motivo: cierre por festivo).
- (Histórico) excepción **Abrimos** 12/10/2026 si se registró algo ese lunes; el 13 ya es descanso semanal.
- Mañana: botón justificar en bloque → sella las vencidas del 14. La campana sí tendrá avisos.

## Arreglo de código propuesto (pequeño)
- `listCurrentRuns`: si hoy es día cerrado → devolver `[]` (en cierre no se registra nada, decisión 2026-10-07).
- `closeElapsedAndAlert`: no crear alerta para hojas cuyo periodo entero fue de cierre (`isPeriodFullyClosed`).
- Justificar sigue manual con botón (decisión del usuario; no auto-sellar).
- No borrar hojas ya generadas: triggers de inalterabilidad y regla de cero pérdida de datos.
- Tests: jest en `checklist-run.service.spec` (día cerrado → lista vacía) y scheduler (sin alerta).

## Preguntas abiertas
- ¿Sellar automáticamente las vencidas de días de cierre declarados (sin botón)? Hoy decisión = manual.
