---
type: research
date: 2026-10-01 18:36
scope: frontend SICTED (solo UI)
---

# Research: fecha visible en «Hojas de hoy» y «Pendientes de validar»

## Resumen

Cambio solo de frontend, 2 ficheros + 1 helper. Sin backend, sin migración: el dato (`periodKey`, `periodStart`) ya viene en `ChecklistRunSummary` de `GET runs/today` y `GET runs`.

Sin búsqueda web: la pregunta se responde leyendo el repo.

## Estado actual

| Listado | Fichero | Fecha hoy |
|---|---|---|
| Hojas vencidas | `frontend/src/app/dashboard/sicted/page.tsx:207` | Sí, siempre: `{nombre} — {periodKey}` |
| Pendientes de validar | `frontend/src/app/dashboard/sicted/page.tsx:180-183` | Solo si la hoja NO es de hoy (`!runsToday.some(...)`) |
| Hojas de hoy (título) | `frontend/src/app/dashboard/sicted/hoy/page.tsx:64` | No |
| Hojas de hoy (tarjetas `RunCard`) | `frontend/src/app/dashboard/sicted/hoy/page.tsx:139-147` | No |

`periodKey` (backend `checklist-period.util.ts`): diaria `2026-10-01`, semanal `2026-W40`, mensual `2026-10`, trimestral `2026-Q4`, anual `2026`. Se muestra en crudo en vencidas, matriz mensual y auditoría.

## Recomendación

1. **Pendientes de validar**: quitar la condición `!runsToday.some(...)` → mostrar `· {periodKey}` siempre. 1 línea menos.
2. **Hojas de hoy**:
   - Bajo el título: fecha de hoy en largo (`jueves, 1 de octubre de 2026`, `toLocaleDateString('es-ES', {...})`).
   - En cada `RunCard`, en la línea secundaria: `{periodKey} · Modo · 3/8`. Necesario porque el listado puede mezclar hojas diarias con semanales/mensuales; solo con el título no se distingue.
3. **Formato** (opcional, recomendado): helper `formatPeriodKey(key)` en `frontend/src/lib/sicted-types.ts`: clave diaria `YYYY-MM-DD` → `01/10/2026`; resto se deja igual (`2026-W40`). Usarlo en los 3 sitios (vencidas incluida) para que quede coherente. Parsear el string a mano, no `new Date(key)` (desfase UTC).

Si se prefiere cero riesgo: omitir punto 3 y pintar `periodKey` crudo, idéntico a vencidas.

## Riesgos

- Ninguno funcional. Solo texto.
- Móvil: la línea secundaria de `RunCard` crece ~11 caracteres; ya hace wrap.

## Validación

- `bun run lint` + typecheck en `frontend`.
- Visual en `/dashboard/sicted` y `/dashboard/sicted/hoy` (claro y oscuro, móvil).

## Preguntas sin resolver

1. ¿Formato `01/10/2026` o ISO crudo `2026-10-01` como ahora en vencidas?
2. En «Hojas de hoy»: ¿fecha en cada tarjeta, solo en el título, o ambas (recomendado)?
