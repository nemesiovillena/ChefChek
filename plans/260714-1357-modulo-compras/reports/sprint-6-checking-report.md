# Sprint 6 — Programación de pedidos (scheduler): informe de checking

**Fecha**: 2026-07-15 · **Rama**: develop · **BD**: localhost:5432/chefchek

## Resultado: ✅ COMPLETADO

Todo el checking se hizo contra **ticks de cron reales** del proceso backend en marcha (`@nestjs/schedule`, `EVERY_5_MINUTES`), esperando a las marcas de reloj reales (19:00, 19:05, 19:10, 19:15, 19:20 CEST) en vez de simular el paso del tiempo — máxima fidelidad al comportamiento en producción.

## Checking ejecutado

| Criterio | Resultado | Evidencia |
|---|---|---|
| Programación en día/hora ya pasada crea BORRADOR + notificación en el siguiente tick real | ✅ | Programación `daysOfWeek:[3]` (miércoles), `timeOfDay:"00:00"` creada a las 18:57 CEST → tick de las 19:00:00 generó `PED-0005` BORRADOR; `Alert` `SCHEDULED_ORDER_GENERATED` creada en BD con el mensaje esperado |
| Reejecutar el tick NO duplica el pedido del día | ✅ | Tick de las 19:05:00 pasó sin generar `PED-0006`; `lastRunAt` sin cambios |
| `enabled=false` no ejecuta | ✅ | Programación desactivada, due, no generó nada en el tick de las 19:10; `lastRunAt` siguió `null` |
| Reactivar no genera retroactivos, solo evalúa el estado actual | ✅ | Reactivada a las 19:11, generó `PED-0006` en el tick de las 19:15 (el primero tras reactivar) — un solo pedido, no backfill de los ticks perdidos entre 18:57-19:15 |
| Backend reiniciado a mitad de día no duplica lo ya ejecutado | ✅ | Reiniciado el proceso (`kill` + relanzar `start:prod`) a las 19:15; tick de las 19:20 no generó nada nuevo (`lastRunAt` de ambas programaciones sin cambios, sin `PED-0007`) — el estado vive 100% en BD (`lastRunAt`), no en memoria |
| Nunca se envía nada al proveedor automáticamente | ✅ | Ambos pedidos generados quedaron en `BORRADOR`; ningún `sentAt/sentVia` poblado |
| Evento de auditoría | ✅ | `PurchaseOrderEvent` con `type:"SCHEDULED_GENERATION", payload:{scheduleId}` además del `CREATED` habitual |
| Validaciones | ✅ | Proveedor/lista/local ajenos al tenant → 404; `timeOfDay` mal formado o `daysOfWeek` fuera de 0-6 → 400 (class-validator) |
| Specs de `shouldRun` + claim de idempotencia | ✅ | 14/14 tests nuevos (`purchase-schedule.service.spec.ts`); 108/108 en todo `compras` |
| Build + typecheck | ✅ | `nest build` y `tsc --noEmit` limpios |
| Migración aditiva y reversible | ✅ | Tabla nueva `purchase_schedules`, sin tocar columnas existentes; probada sobre copia (`pg_dump`/`pg_restore`) con `BEGIN/DROP TABLE/ROLLBACK` antes de aplicar a la BD real |

## Cambios realizados

- **Dependencia**: `@nestjs/schedule@^6` (instalada con `--legacy-peer-deps`, igual que el resto del repo — mismatch preexistente `@nestjs/core@11` vs `@nestjs/common@10`, no introducido por este sprint). `ScheduleModule.forRoot()` añadido a `app.module.ts`.
- **Schema/migración** `add_purchase_schedules` (aditiva): modelo `PurchaseSchedule` (`daysOfWeek Int[]`, `timeOfDay` "HH:mm", `enabled`, `lastRunAt`); relaciones inversas en `Tenant`/`Supplier`/`PurchaseList`/`Location`; añadido a `modelsWithSoftDelete`.
- **`backend/src/modules/compras/services/purchase-schedule.service.ts`** (nuevo, 14 tests): `shouldRun` (pura, sin dependencias externas — usa `Intl.DateTimeFormat` con `timeZone:"Europe/Madrid"`, sin librería de fechas nueva); CRUD; `runTick()` con `@Cron(EVERY_5_MINUTES)`; claim de idempotencia vía `updateMany` condicionado a `lastRunAt` sin cambios (compare-and-swap); reutiliza `PurchaseListService.generateOrder` (Sprint 1) tal cual, sin tocarlo.
- **`backend/src/modules/compras/dto/purchase-schedule.dto.ts`** (nuevo): validación de `daysOfWeek` (enteros 0-6) y `timeOfDay` (regex `HH:mm` 24h).
- **`backend/src/modules/compras/compras.controller.ts`**: `GET/POST /programaciones`, `GET/PATCH/DELETE /programaciones/:id`.
- **`backend/src/modules/compras/compras.module.ts`**: provider `PurchaseScheduleService` (NotificationsService ya alcanzable vía `CoreModule` `@Global()`, sin cambios de imports necesarios).

## Decisiones anotadas

- **Zona horaria fija Europe/Madrid**, no configurable por tenant — el phase file dejaba la decisión abierta; dado que la app es de un solo país/idioma (todo el UI en español, sin señales de expansión multi-región), configurarla por tenant sería alcance no pedido (YAGNI). Si en el futuro se necesita, es un campo nuevo en `Configuration` + pasar el tz a `toMadridParts`.
- **`daysOfWeek` usa la convención de `Date.getDay()` de JS** (0=domingo…6=sábado) en vez de ISO-8601 (1=lunes…7=domingo), para evitar una capa de conversión innecesaria entre el backend y cualquier `Date` nativo.
- **Sin dependencia nueva de fechas/zonas horarias**: `Intl.DateTimeFormat` (nativo de Node) es suficiente para extraer día/hora/fecha en una zona horaria concreta — no hace falta `date-fns-tz`/`luxon` para esto.
- **Frontend**: CRUD de programaciones en la pestaña "Programaciones" (antes placeholder) — selector de proveedor→lista (filtrada por proveedor), local opcional, días de semana (L-D), hora, próxima ejecución calculada en cliente (informativa; el cron real vive en el backend), toggle activar/pausar, borrar. `use-purchase-schedules.ts` sigue el mismo patrón que `use-purchase-lists.ts`.

## Checking frontend

| Criterio | Resultado |
|---|---|
| `tsc --noEmit` | ✅ limpio |
| `eslint` de los 3 ficheros nuevos/tocados | ✅ 0 errores, 0 warnings |
| Página `/dashboard/compras` sigue sirviendo 200 con la pestaña nueva wireada | ✅ |
| Verificación visual en navegador | ⚠️ no realizada (sin herramienta de browser en este entorno) — pendiente que el usuario la abra con su sesión |

## Observaciones / pendiente

1. **Verificación visual en navegador no realizada** — mismo motivo que en sprints anteriores (sin herramienta de automatización de browser disponible). Typecheck, lint y respuesta 200 de la página verificados.
2. Datos de prueba: creados y **ya limpiados** (2 programaciones sintéticas, 2 pedidos BORRADOR generados por ellas, sus eventos y la notificación) — soft-deleted igual que haría un usuario real, no un borrado físico. La BD queda en el mismo estado que antes del checking (mismo nº de pedidos activos que al empezar).
3. `npm install` de `@nestjs/schedule` requirió `--legacy-peer-deps` por el mismatch preexistente `@nestjs/core@^11` / `@nestjs/common@^10` del repo — no es nuevo de este sprint, ya afectaba a cualquier instalación de paquete.
4. "Próxima ejecución" en el frontend es una estimación calculada en el navegador (mismo algoritmo conceptual que `shouldRun`, pero sin llamar al backend) — puramente informativa; la que manda es siempre la evaluación real del cron en el servidor.
