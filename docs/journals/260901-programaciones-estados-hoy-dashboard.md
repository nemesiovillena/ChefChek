# Programaciones de pedidos: estados HOY + card reforzada en dashboard

**Fecha**: 2026-09-01
**Severity**: Baja (confusión UX, 0 bugs de datos)
**Componente**: PurchaseScheduleService, DashboardService, ProgramacionesTab, dashboard page
**Estado**: Resuelto

## Qué pasó

Con dos programaciones activas, el listado mostraba "Próxima: dd/mm" en ambas y el usuario no sabía cuál tenía que enviar HOY. La causa raíz: el estado "HOY" lo calculaba el cliente (`nextRun()` en el componente) con la zona horaria del navegador y sin conocer `lastRunAt`, así que divergía del cron del backend (Europe/Madrid, cada 5 min). Además, tras la ejecución del día, "Próxima" saltaba a la semana siguiente aunque el BORRADOR siguiera pendiente de enviar — el dato más accionable desaparecía de la UI justo cuando más hacía falta.

**Hechos de entrega:**

- `describeSchedule()` estática pura (hermana de `shouldRun`/`getNextRunAt`, reloj inyectable): `nextRunAt`, `runsToday`, `ranToday`, `pendingDraft {orderId, generatedAt, generatedToday}`.
- `findAll()` enriquece el listado; el vínculo programación→BORRADOR se resuelve con el evento `SCHEDULED_GENERATION` existente (payload.scheduleId) — cero cambios de schema.
- Tres estados de fila: **Pendiente de enviar** (error + negrita, prioridad visual), **Hoy · HH:mm** (primary + negrita), **Próxima: dd/mm** (normal). "Última: hoy HH:mm" cuando `ranToday`.
- Card dashboard: `isToday` + `isPendingDraft` server-side; "Pendiente de enviar · proveedor · HOY HH:mm" en error, chip "HOY" primary para "corre hoy". Sin popup/modal/toast — decisión explícita del usuario.
- Backend 63/63 specs (3 suites), nest build, tsc, next build en verde.

## La verdad brutal

El problema no era el texto "Próxima" — era que el cliente adivinaba fechas que el backend ya sabía. Toda la semántica de "hoy" vive ahora server-side con el mismo reloj que el cron (`toMadridParts`), y el cliente solo formatea. El listado y el dashboard ya no pueden contradecirse entre sí ni al cron.

## Detalles técnicos

- `generatedToday` se decide por el día DEL DRAFT, no por `lastRunAt`: un BORRADOR acumulado de otro día sigue siendo pendiente pero no se viste de "hoy" (finding de review, con contra-caso en spec).
- Query de drafts con `orderBy createdAt asc`: si una programación acumula varios BORRADOR sin enviar, gana el más reciente en el Map de forma determinista.
- Tipos frontend separados: `PurchaseSchedule` (entidad cruda, la que devuelven las mutaciones) vs `PurchaseScheduleWithStatus` (fila del listado). Mezclarlos hacía creer al hook de mutaciones que devolvía estado HOY.
- **Invalidación encadenada**: enviar/revertir un pedido (`useTransitionPurchaseOrder`) solo invalidaba `purchase-orders`; el estado "Pendiente de enviar" de la programación y la card del dashboard se quedaban stale. `useInvalidateOrders` ahora invalida también `purchase-schedules` + `dashboard-kpis` (mismo patrón que ya usaba `use-purchase-schedules`).
- Spec de dashboard desactivado su bomba de reloj con `jest.useFakeTimers().setSystemTime()` (fallaría el 2026-09-02).

## Pendiente

- Validación visual manual del escenario de dos programaciones (móvil + desktop) — criterio 3 de la fase 4, requiere cron local activo.
- Nota informativa (no bloqueante): `shouldRun` vs `getNextRunAt` son asimétricos por diseño — un BORRADOR no enviado no bloquea la generación del día siguiente. Comportamiento heredado, decisión de producto vigente.
