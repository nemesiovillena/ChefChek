---
title: Asistente IA — consulta de lotes / trazabilidad
description: >-
  Nueva tool del asistente Chefchek para preguntar por el nº de lote de un
  artículo recibido (por proveedor y semana natural) y a la inversa, desde qué
  albarán/proveedor entró un lote. Incluye fecha actual en el system prompt y
  resolución de "semana pasada".
status: implemented
priority: P2
branch: feat/sala-notificaciones-kanban
tags:
  - ai-assistant
  - tool-calling
  - trazabilidad
  - lotes
  - albaranes
blockedBy: []
blocks: []
created: '2026-08-30T18:02:54.000Z'
createdBy: 'ck:plan'
source: skill
---

# Asistente IA — consulta de lotes / trazabilidad

## Overview

El asistente Chefchek (`modules/ai-assistant`, tool-calling, 9 tools) no puede
responder "¿qué lote tiene el lomo alto de añojo de Mar Menor de la semana
pasada?": ninguna tool toca albaranes / líneas / lotes, y el `SYSTEM_PROMPT` no
inyecta la fecha actual, así que el LLM no puede razonar sobre "la semana
pasada".

El dato **sí existe** en producción:

- `AlbaranLine.lot` (`String?`) — nº de lote en crudo leído por el OCR.
- Modelo `Lot` — registro de trazabilidad real: `lotNumber`, `productId`,
  `supplierId`, `albaranLineId` (`@@unique`, 1 lote por línea recibida),
  `quantity`, `expiryDate`, `receivedAt`. Se crea al confirmar recepción
  (`albaranes/services/lot.service.ts:createLotFromReception`). Hoy ese servicio
  **solo escribe**; no hay lectura.

Este plan añade:

1. Fecha actual (Europe/Madrid) en el system prompt del asistente.
2. Util de periodo natural (`semana_actual` / `semana_pasada` / `mes_actual` /
   `mes_pasado`) con reglas lunes–domingo y DST.
3. `LotService.findLots()` — lectura de trazabilidad reutilizable por la futura
   feature de etiquetas.
4. `ProductsService.searchByNameLoose()` — búsqueda de artículo por tokens
   (tolerante a voz / prefijos tipo `CR.` / acentos), separada del
   `findNameMatches` afinado para detección de duplicados.
5. Nueva tool `consultar_lote` (`get_lot_traceability`), bidireccional
   (artículo→lote y lote→artículo/albarán/proveedor), registrada en
   `ToolRegistryService`.

## Decisiones cerradas (con el usuario)

| Tema | Decisión |
|---|---|
| Semana | Natural **lunes–domingo**, zona `Europe/Madrid`, DST-aware. No restar `7*24h` a pelo. |
| Nº de resultados | Devolver **todos** los lotes del rango (varias entregas/semana → varias filas). |
| Filtro temporal | Contra **`albaran.date`** (fecha del papel), no `Lot.receivedAt`. |
| Búsqueda inversa | Sí: param `lotNumber` → artículo, albarán, proveedor, fecha. Puede devolver varias filas (lote no único). |
| Sin fecha en la pregunta | Devolver las últimas 10 coincidencias por `albaran.date` desc. |
| Granularidad | Por artículo (el modelo `Lot` ya es 1 por línea recibida). |
| Pérdida de datos | **Cero.** Todo el plan es lectura + código aditivo. Sin migración, sin cambios de esquema, sin tocar rutas de escritura. |
| Fallback | **Siempre activo.** Si la línea no tiene registro `Lot`, leer `AlbaranLine.lot` en crudo (`source: "raw_line"`). No condicionado a ninguna medición. |
| Permisos | La tool es **visible para todos los roles** (el lote no es un importe €). No se filtra por `role`. |

## Verificaciones hechas (2026-08-30)

- **Sin ciclo de módulos.** Análisis estático: `AiAssistantModule` solo lo importa
  `app.module.ts`. Ningún módulo de la cadena transitiva de `AlbaranesModule`
  (`compras`, `products`, `ocr`, `ocr-config`, `core`, `auth`, `users`,
  `tenants`, `websocket`) importa `AiAssistantModule`. `ComprasModule` ya evita
  a propósito importar `AlbaranesModule` (comentario en `compras.module.ts:58`).
  → Importar `AlbaranesModule` en `AiAssistantModule` es seguro. **Plan B
  (Prisma directo) queda como respaldo, no como camino esperado.**
- **Cobertura de `Lot` medida** sobre backup de producción de un tenant real
  (`Downloads/cmrt4tec…json`, 2026-08-29, scope TENANT — NO se commitea):
  - 592 `albaran_lines`, 403 con `lot` en crudo (68%), 479 con
    `matchedProductId`.
  - 354 registros `Lot`. Los 354 tienen `albaranLineId` + `supplierId` y su
    cadena `Lot → line → albaran` resuelve **100%**.
  - **49 líneas (12%) tienen `lot` en crudo pero SIN registro `Lot`** →
    confirma el gap de captura histórico (memoria
    `lot-traceability-albaran-lines-plan`). El fallback `raw_line` es
    **necesario e incondicional**, no cosmético.
  - `expiryDate`: **0/354** — el OCR nunca lo rellena hoy. La tool devuelve
    `expiryDate: null` siempre; el campo queda listo para la feature de
    etiquetas.
- **Nombres reales validan `searchByNameLoose`.** El artículo del caso es
  `CR.AÑOJO FRES LOMO ALTO S/H S/T PREMIUM *`. `findNameMatches` NO lo
  encuentra con "lomo alto de añojo" (primera palabra significativa distinta,
  sin contención). El match por tokens-AND (`lomo` ∧ `alto` ∧ `añojo`, todos
  ILIKE-presentes sobre el nombre normalizado) sí. Proveedor `Mar Menor`
  existe.
- **Nº de lote ambiguo**: valores reales tipo `A1`, `1704`, `2909`, `260708`.
  La búsqueda inversa por `lotNumber` devuelve varias filas (decidido: todas).
  Preferir igualdad case-insensitive; `contains` solo si igualdad da 0.
- **Albarán**: usar `albaranNumber` (nº del proveedor, el que reconoce el
  usuario) y además `internalNumber`. Filtro temporal contra `albaran.date`.

## Restricciones

- **Producción viva, módulos nuevos.** Regla `zero-data-loss`: no se toca ninguna
  ruta de escritura ni el esquema. La única mutación de comportamiento es el
  string del system prompt (runtime) y añadir una tool al registro.
- Multi-tenant: todo filtrado por `tenantId` (el `handler(tenantId, params)` del
  contrato de tool ya lo garantiza).
- Proyecto usa **bun**; tests backend con **jest** (no `bun test`).
- Backend `:3001` corre en modo `dist` (sin hot-reload): tras cambios, build +
  relanzar para probar en la app.

## Fases

| Fase | Nombre | Depende de | Estado | Entregable |
|---|---|---|---|---|
| 01 | Fecha en system prompt + util de periodo natural | — | ✅ hecho | `buildSystemPrompt(now)` inyecta fecha; `calendar-period.util.ts` + spec (9 casos, incl. DST octubre) |
| 02 | Lectura: `LotService.findLots` + `ProductsService.searchByNameLoose` | — | ✅ hecho | Dos métodos de consulta pura + specs; shapes Prisma validados contra cliente real |
| 03 | Tool `get_lot_traceability` + registro + wiring de módulo | 01, 02 | ✅ hecho | Tool registrada (10 tools); `AiAssistantModule → AlbaranesModule`; app arranca sin ciclo |

### Verificación de implementación (2026-08-30)

- `bun run build` OK. `npx jest src/modules/ai-assistant src/modules/albaranes src/modules/products/products.service.spec.ts` → todo verde (nuevos: 44; regresión albaranes: 159).
- App completa arranca en `:3999` → "Nest application successfully started" (sin dependencia circular).
- Shapes de query Prisma de `findLots` (directa / rango / inversa) y el `$queryRaw` de `searchByNameLoose` ejecutados contra el cliente Prisma real + Postgres local sin error.
- `searchByNameLoose` simulado contra los 219 nombres reales del backup de prod:
  "lomo alto de añojo" / "lomo alto añojo" / "anojo lomo" → los 3 resuelven a
  `CR.AÑOJO FRES LOMO ALTO S/H S/T PREMIUM *` (único). "lomo salmon",
  "bacalao desalado" → 1 resultado limpio cada uno.

Fases 01 y 02 son independientes (distintos archivos) y pueden ir en paralelo.
Fase 03 integra ambas.

## Criterios de aceptación

- "¿Qué lote tiene el lomo alto de añojo de Mar Menor?" → devuelve el último
  lote conocido con nº de albarán y fecha.
- "…la semana pasada" → filtra lunes–domingo anteriores contra `albaran.date`.
- "¿De qué albarán viene el lote `L-2026-0812`?" → proveedor + nº albarán +
  fecha + artículo.
- Artículo con 2 entregas la misma semana → 2 filas.
- Artículo inexistente / sin lotes → mensaje claro ("no encuentro…"), nunca
  cifra inventada.
- `bun run --cwd backend test` verde en los specs nuevos y en
  `tool-registry.service.spec`, `ai-assistant.service.spec`.
- `bun run --cwd backend build` sin errores TS.
- Sin fichero de migración nuevo. `git diff` no toca `schema.prisma`.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| `SYSTEM_PROMPT` es `const` de módulo; specs lo importan | Convertir a `buildSystemPrompt(now)` o construir el string dentro de `ask()`; actualizar specs afectados. |
| Acoplamiento `LotService` (AlbaranesModule) ↔ `ToolRegistry` (AiAssistantModule) | **Ciclo descartado por análisis estático** (ver "Verificaciones hechas"). Exportar `LotService` desde `AlbaranesModule`, importar `AlbaranesModule` en `AiAssistantModule`. Si Nest sorprende con un ciclo en runtime → plan B: query Prisma directa en la tool. |
| DST: "semana pasada" cruzando cambio de hora (oct/mar) | Resolver límites con `Intl.DateTimeFormat` / offset por fecha, no aritmética de ms fija. Spec con fecha dentro de semana de cambio horario. |
| `pg_trgm` no habilitado | `searchByNameLoose` usa `ILIKE` por token, sin extensión ni migración. |
| `AppModule` duplica registros de controller/provider (gotcha histórico) | No se añade controller. Provider nuevo (`LotService`) ya existe; solo se añade a `exports`. Revisar que `AppModule` no re-registre. |
| Fallback `AlbaranLine.lot` | Incondicional. No depende de ninguna medición. |

## Preguntas abiertas

- Ninguna bloqueante. Nombre de la tool hacia el LLM fijado en
  `get_lot_traceability` (coherente con el resto del registro `get_*`).
