# SICTED: «Hojas vencidas sin completar (N)» — qué es y cómo se gestiona

Fecha: 2026-10-01 16:17 · Fuente: lectura de código (rama `feat/dashboard-sala-scroll`), sin acceso a datos de prod.

## Resumen

- El aviso lista hojas (`ChecklistRun`) en estado `INCOMPLETE` con periodo en los últimos 7 días.
- Una hoja pasa a `INCOMPLETE` sola: el scheduler cierra las `OPEN` cuyo periodo ya terminó sin todos los ítems obligatorios marcados.
- Hoy la app NO ofrece ninguna acción sobre ella: no se puede completar tarde, ni validar, ni descartar. Es informativo.
- Desaparece del panel sola a los 7 días. En Auditoría (cobertura) queda como hueco `INCOMPLETE` de forma permanente.

## Cómo funciona (código)

| Qué | Dónde |
|---|---|
| Lista del aviso = runs `status=INCOMPLETE`, `from = hoy-7d` | `frontend/src/hooks/use-sicted.ts:138,151` |
| Render sin enlace ni botón | `frontend/src/app/dashboard/sicted/page.tsx:193-207` |
| Cierre `OPEN → INCOMPLETE` al acabar el periodo | `backend/src/modules/checklists/services/checklist-run.service.ts:420-444` |
| Alerta `CHECKLIST_RUN_INCOMPLETE` al cerrar | `backend/src/modules/checklists/services/checklist-run-scheduler.service.ts:74` |
| Detalle desde Registros siempre `readOnly` | `frontend/src/app/dashboard/sicted/registros/[runId]/page.tsx:24` |
| Botón Validar solo si `status === 'COMPLETED'` | `frontend/src/app/dashboard/sicted/components/sicted-run-checklist.tsx:59` |
| `maybeCompleteRun` solo promueve desde `OPEN` | `checklist-run.service.ts:363` |
| Hueco en cobertura de auditoría | `backend/src/modules/sicted/services/sicted-coverage.service.ts:106-115` |

Matiz backend: `addEntries` no rechaza marcas en una hoja `INCOMPLETE` (solo si está supervisada) y `supervise` la acepta (solo rechaza `OPEN`). Pero el estado nunca vuelve a `COMPLETED`, y la UI no expone ninguna de las dos vías.

## Qué hacer hoy

1. Identificar la hoja: el aviso muestra plantilla + periodo. Verla en SICTED → Registros.
2. Decidir si es un fallo real (no se hizo el control) o un falso positivo (día cerrado, plantilla que no tocaba).
3. Real → nada que arreglar en la app; el registro es inalterable por diseño. Dejar constancia fuera (acción de mejora en Dirección) si se quiere justificar ante auditor.
4. Falso positivo recurrente → corregir la plantilla en «Editar el Plan» (frecuencia/días, ítems obligatorios) para que no vuelva a generarse.
5. No tocar la BD de prod para «limpiar» el aviso.

## Opciones si se quiere gestionar desde la app (no implementado)

- A. Enlazar el aviso al detalle de la hoja (cambio mínimo, solo front).
- B. Permitir justificar/validar una hoja `INCOMPLETE` con nota del supervisor (el backend ya lo acepta; falta UI y que el aviso excluya las supervisadas).
- C. Permitir completar tarde marcando la hoja como «completada fuera de plazo» (toca semántica de inalterabilidad; decisión de producto).

## Preguntas abiertas

- ¿Qué hoja y periodo es la de prod? Sin eso no se sabe si es fallo real o plantilla mal configurada.
- ¿Los días de cierre del local generan hojas igualmente? Si sí, habrá vencidas recurrentes.
- ¿Se quiere poder justificar (B) de cara al auditor SICTED?
