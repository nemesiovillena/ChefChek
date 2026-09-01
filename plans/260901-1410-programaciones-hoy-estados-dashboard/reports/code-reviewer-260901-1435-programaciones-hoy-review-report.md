# Code Review — Programaciones: estados HOY + aviso dashboard

Reviewer: code-reviewer | Fecha: 2026-09-01 14:35 | Branch: feat/programaciones-hoy-estados (base develop, cambios en worktree sin commit)

## Scope

- `backend/src/modules/compras/services/purchase-schedule.service.ts` (+71: ScheduleStatus/SchedulePendingDraft, describeSchedule, findAll enriquecido)
- `backend/src/modules/compras/services/purchase-schedule.service.spec.ts` (+157: 6 tests describeSchedule, 3 findAll)
- `backend/src/modules/dashboard/dashboard.service.ts` (+8/-3: isToday/isPendingDraft en ambas ramas, `now` único)
- `backend/src/modules/dashboard/dashboard.service.spec.ts` (+4: flags en 2 aserciones)
- `frontend/src/hooks/use-purchase-schedules.ts` (+6: tipo extendido)
- `frontend/src/app/dashboard/compras/components/programaciones-tab.tsx` (+71/-34: nextRun() cliente eliminado, 3 estados de fila)
- `frontend/src/hooks/use-dashboard-kpis.ts` (+4)
- `frontend/src/app/dashboard/page.tsx` (+38/-7: chip HOY + énfasis pendiente)
- LOC: ~346 añadidos / 34 eliminados
- Verificación previa confiada: jest 61/61, nest build, tsc --noEmit, next build (no repetida)

## Overall Assessment

Solid implementation. Single source of truth server-side achieved; client tz logic fully removed (criterion b verified: `formatDateKey` solo splitea strings, `formatGeneratedAt`/`formatTime` solo formatean instantes ISO, jamás comparan fechas). Contrato solo extendido (criterion e). Sin popup/modal/toast (criterion f). Sin regresiones detectadas en findAll/createFromOrder/runTick ni en consumidores (grep: `nextScheduledPurchase` → solo page.tsx + hook, ambos actualizados; `PurchaseSchedule` → tab, dialog y hook; nadie lee los campos nuevos fuera del listado). Un finding medium en un spec (time bomb de fecha), resto low/informational.

## Critical Issues

Ninguna.

## High Priority

Ninguna. Verificados en profundidad:

- **IDOR cross-tenant (descartado)**: la query de drafts filtra `tenantId` a nivel de `purchaseOrder`; los eventos incluidos son relación de esos mismos pedidos. `payload.scheduleId` de otro tenant no puede colarse (los eventos SCHEDULED_GENERATION solo los crea `tryGenerate` con el schedule del mismo tenant) y aunque colara, `draftBySchedule.get(schedule.id)` solo consulta ids de schedules del tenant — no hay fuga.
- **Soft-delete (descartado)**: `purchaseorder` y `purchaseschedule` están en `modelsWithSoftDelete` (prisma.service.ts:16-35); el middleware inyecta `deletedAt: null` en findMany. Los drafts soft-deleted y las programaciones soft-deleted quedan excluidos automáticamente (el `remove()` del servicio soft-deleta vía rewrite del middleware).
- **Serialización (descartado)**: `pendingDraft.generatedAt` explícitamente `toISOString()`; el resto de Dates del schedule serializan a ISO vía JSON del wrapper `{ success, data }` del controller (compras.controller.ts:750). Formato homogéneo en el wire.
- **Escalado (descartado)**: 1 query extra por findAll, acotada a BORRADORES vivos del tenant, con `take: 1` en eventos. Sin N+1. Early-return cuando no hay schedules (además testeado).
- **DST en getNextRunAt (descartado)**: el walk de offsets 0..7 con pasos de 24h absolutos atraviesa transiciones DST sin saltarse ninguna fecha calendario (máximo una repetición de fecha por ventana de 8 días → 7 fechas distintas → siempre cubre los 7 weekdays). Pre-existente además; describeSchedule solo lo reutiliza.

## Medium Priority

1. **Test time bomb** — `backend/src/modules/dashboard/dashboard.service.spec.ts:261-283`
   El test "anuncia el pedido programado pendiente de enviar…" fija el `createdAt` del draft en `2026-09-02` pero NO usa fake timers (el test hermano de la línea 295 sí). `isToday: false` se calcula contra el reloj REAL: la suite fallará si se ejecuta el 2026-09-02 (Madrid). La aserción añadida convirtió un test determinista en fecha-dependiente.
   Fix: envolver con `jest.useFakeTimers().setSystemTime(new Date("2026-09-01T07:00:00Z"))` + finally `jest.useRealTimers()`, igual que el test de la línea 293.

2. **"generado hoy" decide con `ranToday`, no con el día del draft** — `programaciones-tab.tsx:250` (`formatGeneratedAt(generatedAt, schedule.ranToday)`)
   `ranToday` refleja el día de `lastRunAt`; el draft mostrado puede ser de otro día. Divergencia real: schedule que corre lun+yue con el draft del lunes sin enviar → el martes el cron genera un segundo draft (lastRunAt=martes); si el map retiene el draft del lunes (ver finding 3), el label dice "generado hoy 09:05" con la hora del LUNES. También: `tryGenerate` hace claim de `lastRunAt` ANTES de generar (purchase-schedule.service.ts:397-403); si `generateOrder` falla, lastRunAt=hoy sin draft nuevo y un draft viejo pendiente se mostraría "generado hoy" con timestamp antiguo.
   Fix recomendado (sin reintroducir lógica tz en cliente): que el backend añada `generatedToday: boolean` dentro de `pendingDraft` (computed con `toMadridParts(draft.generatedAt).dateKey === today` en describeSchedule) y el label use ese flag. Cosmético, sin pérdida de datos.

## Low Priority

3. **"Gana el más reciente" no garantizado** — `purchase-schedule.service.ts:210-223`
   El comentario asume que el último `draftBySchedule.set` del loop es el draft más reciente, pero el `findMany` de drafts NO lleva `orderBy`: el orden de filas en Postgres sin ORDER BY es indefinido (en práctica insertion order, que hace el comentario cierto por accidente).
   Fix: añadir `orderBy: { createdAt: "asc" }` a la query de drafts → el overwrite del map deja deterministicamente el más reciente. (Con `desc` sería peor: ganaría el más viejo; alternativa `if (!draftBySchedule.has(scheduleId))`).

4. **Tipo `PurchaseSchedule` overclaim para mutaciones** — `use-purchase-schedules.ts:7-25`
   Los campos nuevos son required en la interfaz, pero `useCreatePurchaseSchedule`/`useUpdatePurchaseSchedule`/`useSchedulePurchaseOrder` tipan su retorno como `PurchaseSchedule` cuando POST/PATCH devuelven la entidad Prisma sin `nextRunAt/runsToday/ranToday/pendingDraft`. Hoy ningún consumidor lee `mutation.data.<campo nuevo>` (verificado con grep; tsc pasa), pero es un footgun latente: un `result.pendingDraft` futuro daría `undefined` silencioso.
   Fix pragmático: mantener `PurchaseSchedule` como entidad base y `type PurchaseScheduleWithStatus = PurchaseSchedule & ScheduleStatus` para el listado (`useApiQuery<PurchaseScheduleWithStatus[]>`).

5. **Cobertura `isToday: true` ausente** — ambos toEqual del dashboard spec assert `false`. El path del chip HOY (page.tsx:203-207) y "Hoy · HH:mm" del tab (testeado vía `runsToday` en el spec del schedule service, ese sí) no tienen cubierto el equivalente KPI. Bajo: el frontend del proyecto no tiene infra de tests y `describeSchedule` sí cubre el caso análogo.

## Edge Cases Found by Scout

- **enabled=false con pendingDraft**: el estado pendiente ganan al de "corre hoy" (orden de los ternarios, tab:247-263) — correcto según la semántica aceptada ("el accionable manda") y coherente con cero pérdida de datos: el draft existe aunque la programación esté pausada.
- **Draft de otro día**: tab → "generado dd/mm HH:mm" (fallback correcto); dashboard → `isToday:false` → "Pendiente de enviar · Sup · 31/08 09:00", sin "HOY" falso. Correcto salvo el caso del finding 2.
- **Ran today, draft ya enviado**: pendingDraft null, runsToday false → "Próxima: semana que viene" + "Última: hoy HH:mm". Coherente.
- **Ventana perdida + catch-up del cron (pre-existente, informational)**: `shouldRun` permite generar a cualquier hora posterior a `timeOfDay` si hoy no corrió (catch-up tras deploy/caída); `getNextRunAt` en cambio salta al día siguiente en cuanto `hhmm >= timeOfDay`. Resultado: el listado puede decir "Próxima: semana que viene" y minutos después aparecer el draft de HOY (cron catch-up). Se autocorrige con el estado pendingDraft y replica el comportamiento del viejo `nextRun()` cliente; asimetría pre-existente entre ambas funciones puras, no introducida aquí. Alinearla (que getNextRunAt devuelva hoy mientras no haya corrido) tocaría el dashboard else-branch y sus tests — decisión de producto, no blocker.
- **Doble draft vivo de la misma programación**: posible (schedule diario con drafts acumulados sin enviar). Ambos cuentan en el badge del dashboard (`scheduledDraftOrders`, pre-existente) y el listado solo señaliza el más reciente — suficiente para el propósito (ver finding 3 para determinismo).
- **Schedule soft-deleted con draft vivo**: excluido del listado (middleware), el draft sigue contando en el badge del dashboard — pre-existente, aceptable.

## Positive Observations (solo para calibrar riesgo)

- `describeSchedule` pura con reloj inyectado, hermana de `shouldRun`/`getNextRunAt` — misma fuente de verdad que el cron, criterios (a) y (c) cumplidos en el caso común.
- `const now = new Date()` unificado fuera del if en dashboard.service: elimina divergencia potencial de reloj entre ramas.
- Early-return de findAll sin schedules evita la query de drafts (y está testeado).
- Convenciones respetadas: `text-[var(--error)]`/`text-[var(--primary)]` en el tab (estilo del fichero), `text-error`/`bg-primary`/`text-primary-foreground` mapeados en globals.css:107/:81 en page.tsx (donde el fichero ya usaba utilities). Sin `dark:`, sin `text-on-primary`. Sin plan IDs en comentarios.

## Recommended Actions

1. (Medium, pre-merge) Fake timers en dashboard.service.spec.ts:261 — una línea + finally.
2. (Medium-low) `generatedToday` server-side en `pendingDraft` y usarlo en el label del tab (elimina la única aproximación cliente).
3. (Low) `orderBy: { createdAt: "asc" }` en la query de drafts para hacer true el comentario.
4. (Low, puede ser follow-up) Separar `PurchaseScheduleWithStatus` para no overclaimear el tipo en mutaciones.
5. Informational: documentar en su momento la asimetría catch-up (`shouldRun` vs `getNextRunAt`) como decisión conocida.

## Métricas

- Type Coverage: tsc --noEmit limpio (frontend) + nest build (backend) — verificación previa confiada.
- Test Coverage: 9 tests nuevos describeSchedule/findAll; 2 aserciones KPI extendidas; gaps: `isToday: true` (KPI), label multi-draft.
- Linting Issues: no ejecutado en esta revisión (no solicitado; builds verdes).

## Plan Status

- Phases 1-3 marcadas Completed — verificadas contra el código: en backend, estados de fila y card coinciden con lo descrito.
- Phase 4 (Verificación) marcada Pending pese a que jest/build/typecheck están verdes y esta revisión existe — el lead puede marcarla completada al aceptar el report. Los checkboxes de acceptance criteria del plan.md siguen sin marcar (dejar la mutación al lead).

## Unresolved Questions

- ¿Se quiere alinear `getNextRunAt` con la semántica catch-up de `shouldRun` (mostrar "Hoy" mientras la ventana diaria no haya corrido)? Es pre-existente y toucha el dashboard; lo dejo como decisión de producto, no como blocker.
