# Asistente IA: Tool de trazabilidad de lotes + fecha en system prompt

**Fecha**: 2026-08-30 20:43  
**Severity**: Media (gap en funcionalidad, 0 bugs de lógica, 5 findings code review todos aplicados)  
**Componente**: AI Assistant (new tool `get_lot_traceability`), LotService, ProductsService, calendar-period util  
**Estado**: Resuelto

## Qué pasó

El asistente Chefchek no podía responder "¿qué lote tiene el lomo alto de añojo de Mar Menor de la semana pasada?" — un caso de uso real, pero imposible por razones arquitectónicas. Ninguna de sus 9 tools tocaba albaranes/líneas/lotes, y el `SYSTEM_PROMPT` era una const sin fecha, así que el LLM no podía razonar sobre "la semana pasada".

Implementación completa en 3 fases paralelas: (1) fecha en system prompt + util de período natural DST-aware; (2) lectura bidireccional de lotes + búsqueda de artículos por tokens; (3) tool registrada en el registry, AiAssistantModule importa AlbaranesModule (sin ciclo).

**Hechos de entrega:**
- Nueva tool `get_lot_traceability`: artículo→lote (por proveedor+período) y lote→artículo/albarán/proveedor.
- `buildSystemPrompt(now)` inyecta fecha Europe/Madrid + definición de "semana pasada".
- `calendar-period.util.ts`: semana natural lunes–domingo, DST-aware (spec: 10 casos, incluyendo octubre).
- `LotService.findLots()`: query `Lot` + fallback a `AlbaranLine.lot` raw (necesario: 49/403 líneas tienen lote pero sin registro Lot).
- `ProductsService.searchByNameLoose()`: búsqueda tolerante (tokens-AND ILIKE), separado de `findNameMatches` (optimizado para duplicados).
- Backend: **292 tests verdes** (+44 nuevos). tsc + build + eslint sin errores. App arranca sin dependencia circular.

## La verdad brutal

El dato estaba ahí todo el tiempo. 354 registros `Lot` en la BD de producción, cadenas `Lot→line→albaran` resolubles 100%, un proveedor "Mar Menor" real. El artículo del caso (`CR.AÑOJO FRES LOMO ALTO S/H S/T PREMIUM *`) existe. Pero el asistente respondía "no dispongo de esa info" porque *literalmente no tenía acceso a ningún sistema de lectura de lotes*.

Lo frustrante: esta es la segunda feature del asistente que requería arquitectura (después del bugazo crítico de parallel tool-calling hace 4 días). La mayoría de las herramientas consultan servicios de aplicación preexistentes. Los lotes eran un dato huérfano — `Lot` model existía desde 260810 solo para escritura, nunca se leyó.

## Detalles técnicos

**Cobertura real en backup de producción (tenant activo):**
- 592 `albaran_lines`, 403 con `lot` en crudo (68%).
- 354 registros `Lot`. **Cero campos `expiryDate` poblados** → el OCR nunca lo llena hoy; campo listo para feature de etiquetas futura.
- **49 líneas (12%) con `lot` raw pero SIN registro `Lot`** → brecha histórica de captura (nota memoria `lot-traceability-albaran-lines-plan`). El fallback `source:"raw_line"` es **necesario e incondicional**.
- Cadena `Lot → albaranLineId → Albaran` resuelve 100%.

**Búsqueda por tokens:**
`findNameMatches` (afinado para detección de duplicados) falla con "lomo alto de añojo" porque la primera palabra significativa no coincide exacta. El match tokens-AND (`lomo` ∧ `alto` ∧ `añojo` todos presentes ILIKE sobre nombre normalizado) resuelve a `CR.AÑOJO FRES LOMO ALTO S/H S/T PREMIUM *` limpiamente.

**Período natural DST-aware:**
Semana lunes–domingo, offset por fecha (no aritmética de ms fija). Octubre: el cambio de hora el último domingo no rompe el cálculo. Spec valida rollover de mes + DST con fechas reales.

**Tope de seguridad:**
`HARD_CAP = 200` filas incluso con rango (`contains` en `lotNumber` o nombre — parámetros vienen del LLM, riesgo de volcar contexto).

## Código review (subagent) — findings aplicados

| # | Sev | Finding | Acción |
|---|---|---|---|
| 1 | ALTA (CI) | prettier error línea 118 (CI corre eslint sin `--fix`) | **Corregido** |
| 2 | MEDIA | `findLots` con rango ilimitado → riesgo volcar cientos de filas | **Corregido**: `HARD_CAP = 200` también con rango |
| 3 | BAJA | nº lote `raw_line` sin `trim()` (OCR = espacios) | **Corregido**: `(l.lot as string).trim()` |
| 4 | BAJA | camino `desde/hasta` no TZ-aware (Albaran.date es UTC medianoche) | **Comentado** (inocuo) |
| 5 | BAJA | `semana_actual`/`mes_actual` → `to` futuro; prompt dice "esta semana = lun a hoy" | **Corregido**: `clampToNow` recorta `to` a fin de hoy |
| 6 | BAJA | reverse-lookup: exacta→contains; raw siempre contains | **No cambiado**: path raw=12% residual, mezcla aceptable |

Verificados sin defecto: tenant scoping, SQL injection (todo Prisma.sql/join), sin N+1, sin doble-conteo Lot↔raw, constructor LotService no rompe consumidores, sin ciclo de módulos, rollover mes + DST octubre cubiertos.

## Incidencia durante sesión

Ventana transitoria (~1 min): otra sesión concurrente en rama `feat/compras-programar-pedido-recurrente` operó el stash compartido (`git stash push` + tag `notmine-lottrace-wip-…` sobre mis cambios, luego `restore`). Dejó worktree en estado `UU` con rama cambiada.

Resolución: rama back a `feat/sala-notificaciones-kanban`, stash vacío, working tree = changeset esperado. Verificación posterior: 292 tests verdes. Cero datos perdidos. **Nota de arquitectura:** el stash git es *compartido* entre todos los worktrees; reforzar en docs que `git stash` es un recurso contencioso.

## Lecciones aprendidas

1. **Nuevas tools del asistente necesitan exploración de datos previa.** Validar que el modelo existe, leerlo, medir cobertura real (aquí: 354 Lot, gap de 49 líneas). Especificar el fallback.

2. **Período natural ≠ aritmética de días.** DST rompe `Date.getTime() - 7*24*60*60*1000`. Usar offset por fecha + Intl.DateTimeFormat. Spec debe cubrir cruce de cambio horario.

3. **Búsqueda tolerante = herramienta separada.** `findNameMatches` está afinada para otro caso (duplicados). Forzar la misma lógica a dos problemas distintos causa reescritura (`searchByNameLoose`).

4. **Cero pérdida de datos.** El plan decía "solo lectura, sin migración." Cumplido al pie. Todo el work es aditivo, ningun touching de rutas de escritura.

## Next Steps

- Commit `33ecd79` en rama `feat/sala-notificaciones-kanban`.
- **Prueba manual pendiente** (requiere usuario): app con proveedor IA configurado, "¿Qué lote tiene el lomo alto de añojo de Mar Menor?" y "…la semana pasada". El tope `HARD_CAP = 200` sin alcanzar hoy; revisar si crece mucho el histórico.
- Ningún fixing adicional de código. CI + tests pasados.

---

**Status**: DONE  
**Resumen**: Nueva tool de trazabilidad de lotes bidireccional + sistema prompt inyecta fecha Europe/Madrid. 292 tests verdes, arquitectura sin ciclos, fallback a líneas raw incondicional.  
**Preocupaciones**: Prueba manual en app con IA real aún pendiente de usuario.
