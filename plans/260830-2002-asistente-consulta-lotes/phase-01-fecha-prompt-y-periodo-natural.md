# Fase 01 — Fecha en system prompt + util de periodo natural

## Contexto

- `backend/src/modules/ai-assistant/ai-assistant.service.ts`
  - L30 `SYSTEM_PROMPT` (const de módulo, sin fecha).
  - L92-98 ensamblado del mensaje `role: "system"` (`SYSTEM_PROMPT` +
    opcional `NO_COST_ACCESS_PROMPT`).
- `backend/src/modules/ai-assistant/tools/period.util.ts`
  - `periodStart(period: "week" | "month" | undefined): Date` — solo "últimos
    7/30 días móviles". NO sirve para "semana natural anterior".

## Requisitos

1. El asistente conoce la fecha de hoy (Europe/Madrid) en cada `ask()`.
2. Función que traduce un enum de periodo natural a un rango
   `{ from: Date; to: Date }` (ambos límites inclusivos a nivel de día, en
   Europe/Madrid), DST-aware:
   - `semana_actual` — lunes 00:00 de esta semana → domingo 23:59:59.999.
   - `semana_pasada` — lunes–domingo de la semana anterior.
   - `mes_actual` — día 1 → fin de mes.
   - `mes_pasado` — mes natural anterior completo.

## Archivos

- **Modificar** `ai-assistant.service.ts`:
  - Sustituir `SYSTEM_PROMPT` const por `buildSystemPrompt(now: Date): string`
    (o construir dentro de `ask()`). Añade línea:
    `Hoy es <weekday> <d> de <mes> de <yyyy> (zona horaria Europe/Madrid). "La semana pasada" = lunes a domingo de la semana natural anterior.`
    Usar `Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "full" })`.
  - `NO_COST_ACCESS_PROMPT` se mantiene y se concatena igual.
- **Crear** `backend/src/modules/ai-assistant/tools/calendar-period.util.ts`:
  - `export type CalendarPeriod = "semana_actual" | "semana_pasada" | "mes_actual" | "mes_pasado";`
  - `export function resolveCalendarPeriod(period: CalendarPeriod, now: Date): { from: Date; to: Date }`
  - Implementación con `Intl.DateTimeFormat` para obtener Y/M/D en
    `Europe/Madrid` a partir de `now`; construir límites como instantes UTC que
    corresponden a 00:00 y 23:59:59.999 de Madrid ese día (resta del offset
    calculado para esa fecha concreta, no fijo).
  - Semana ISO: lunes = primer día. `getUTCDay()` sobre la fecha civil de
    Madrid, `(day + 6) % 7` días hacia atrás para el lunes.
- **Mantener** `period.util.ts` intacto (lo usan `price-increases`,
  `purchase-spend`, `top-purchased-products`). No tocar.

## Pasos

1. Refactor `SYSTEM_PROMPT` → `buildSystemPrompt(now)`. Ajustar el único punto
   de uso en `ask()` (`new Date()`).
2. Implementar `calendar-period.util.ts`.
3. Specs.

## Tests

- **Crear** `calendar-period.util.spec.ts`:
  - `semana_pasada` con `now = 2026-08-30` (domingo) → `from 2026-08-17 00:00 Madrid`, `to 2026-08-23 23:59:59.999 Madrid`.
  - `semana_actual` con `now = 2026-08-30` → `from 2026-08-24`, `to 2026-08-30`.
  - `semana_pasada` cruzando DST: `now = 2026-11-02` (lunes) → semana previa
    `2026-10-26 … 2026-11-01` incluye el cambio de hora del 25-oct; verificar
    que `from` es 00:00 Madrid real (offset +02 antes / +01 después).
  - `mes_pasado` con `now = 2026-03-15` → `2026-02-01 … 2026-02-28`.
- **Actualizar** `ai-assistant.service.spec.ts`: si mockea/asserta el system
  prompt, adaptarlo a `buildSystemPrompt`. Añadir aserción de que el prompt
  contiene la fecha formateada.

## Validación

```
bun run --cwd backend test -- calendar-period.util ai-assistant.service
bun run --cwd backend build
```

## Riesgos / rollback

- Solo strings y una util pura. Rollback = revertir 2 archivos.
- Sin efectos en datos.
