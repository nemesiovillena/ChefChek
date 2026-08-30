# Fase 03 — Tool `get_lot_traceability` + registro + wiring de módulo

## Depende de

- Fase 01 (`resolveCalendarPeriod`, fecha en prompt).
- Fase 02 (`LotService.findLots`, `ProductsService.searchByNameLoose`,
  `LotService` exportado).

## Contexto

- `backend/src/modules/ai-assistant/tools/tool-definition.interface.ts` —
  contrato: `parameters` es JSON Schema (sin `tenantId`),
  `handler(tenantId, params)`. `properties` solo admite
  `{ type, description, enum? }`.
- `backend/src/modules/ai-assistant/tools/tool-registry.service.ts` — L34-42
  `this.tools = [...]`; constructor inyecta servicios concretos
  (`ProductsService`, `RecipesService`, `WarehousesService`, analytics…).
- `backend/src/modules/ai-assistant/ai-assistant.module.ts` — importa
  `ProductsModule`, `RecipesModule`, `AlmacenesModule`, `ComprasModule`.
  **No importa `AlbaranesModule`.**
- Patrón de tool con resolución de artículo: `stock.tool.ts`.

## Requisitos

### 3A — `lot-traceability.tool.ts`

`export function createLotTraceabilityTool(lotService: LotService, productsService: ProductsService): ToolDefinition`

```
name: "get_lot_traceability"
description:
  "Trazabilidad de lotes recibidos. Dos usos: (a) nº de lote de un artículo
   recibido, filtrable por proveedor y periodo; (b) inverso: de qué albarán y
   proveedor viene un nº de lote. Devuelve una fila por entrega."
parameters.properties:
  productName  { type: string, description: "Nombre (o parte) del artículo. Requerido salvo que se dé lotNumber." }
  lotNumber    { type: string, description: "Nº de lote a rastrear (búsqueda inversa)." }
  supplierName { type: string, description: "Filtrar por proveedor (opcional)." }
  periodo      { type: string, enum: ["semana_actual","semana_pasada","mes_actual","mes_pasado"],
                 description: "Periodo natural a consultar contra la fecha del albarán (opcional)." }
  desde        { type: string, description: "Fecha inicio ISO YYYY-MM-DD (opcional, alternativa a periodo)." }
  hasta        { type: string, description: "Fecha fin ISO YYYY-MM-DD (opcional)." }
required: []   // validación en el handler
```

`handler(tenantId, params)`:

1. Si no hay `productName` ni `lotNumber` →
   `{ error: "Dime el artículo o el número de lote que quieres consultar." }`.
2. Rango de fechas:
   - `periodo` → `resolveCalendarPeriod(periodo, new Date())`.
   - si no, `desde`/`hasta` → `new Date(desde)` / fin de día de `hasta`.
   - si ninguno → sin rango (la query aplica `limit: 10`).
3. `productIds`: si hay `productName` →
   `productsService.searchByNameLoose(tenantId, productName)`; si `[]` →
   `{ error: 'No encuentro ningún artículo que encaje con "<productName>".' }`.
   Si solo hay `lotNumber`, `productIds = undefined`.
4. `lotService.findLots({ tenantId, productIds, lotNumber, supplierName, from, to, limit: rango ? undefined : 10 })`.
5. Si `[]` → `{ error: "No encuentro lotes con esos criterios." }`.
6. Devolver `{ lotes: rows }` (rows tal cual `LotTraceabilityRow`, fechas ISO).
   No incluir `source` en la respuesta al LLM salvo que sea `raw_line` en
   TODOS los resultados (entonces añadir
   `nota: "Datos del texto del albarán; sin registro de trazabilidad formal."`).

### 3B — Registro

`tool-registry.service.ts`:

- Inyectar `LotService` en el constructor.
- Añadir `createLotTraceabilityTool(lotService, productsService)` al array
  `this.tools`.

### 3C — Wiring de módulo

`ai-assistant.module.ts` → `imports: [..., AlbaranesModule]`.

- `AlbaranesModule` exporta `LotService` (Fase 02).
- **Ciclo ya descartado** (análisis estático 2026-08-30): `grep -rn
  "AiAssistantModule" backend/src` → solo `app.module.ts`; ningún módulo de la
  cadena transitiva de `AlbaranesModule` importa `AiAssistantModule`.
- Plan B (solo si Nest sorprende con un ciclo en runtime): no importar
  `AlbaranesModule`; ejecutar la query de `findLots` en la tool con
  `PrismaService` directo (ya disponible vía `PrismaModule` en
  `AiAssistantModule`). `LotService.findLots` seguiría existiendo para la
  feature de etiquetas.

## Archivos

- **Crear** `backend/src/modules/ai-assistant/tools/lot-traceability.tool.ts`
- **Crear** `backend/src/modules/ai-assistant/tools/lot-traceability.tool.spec.ts`
- **Modificar** `backend/src/modules/ai-assistant/tools/tool-registry.service.ts`
- **Modificar** `backend/src/modules/ai-assistant/ai-assistant.module.ts`
- **Modificar** `backend/src/modules/albaranes/albaranes.module.ts` (ya en Fase
  02: export `LotService`)

## Tests

- `lot-traceability.tool.spec.ts` (mock `LotService` + `ProductsService`):
  - sin `productName` ni `lotNumber` → error.
  - `productName` sin periodo → llama `findLots` con `limit: 10`, sin `from/to`.
  - `periodo: "semana_pasada"` → `from/to` = `resolveCalendarPeriod(...)`.
  - `lotNumber` solo → `productIds: undefined`, pasa `lotNumber`.
  - `searchByNameLoose` `[]` → error "no encuentro artículo".
  - `findLots` `[]` → error "no encuentro lotes".
  - todos `source: "raw_line"` → respuesta incluye `nota`.
- `tool-registry.service.spec.ts` — actualizar: `getToolSchemas()` incluye
  `get_lot_traceability`; `getTool("get_lot_traceability")` resuelve.
- `ai-assistant.controller.spec.ts` / `ai-assistant.service.spec.ts` — solo si
  se rompen por el nuevo import de módulo (ajustar `TestingModule.imports` /
  providers mockeados).

## Validación

```
bun run --cwd backend test -- lot-traceability tool-registry ai-assistant
bun run --cwd backend build
# arranque real (dist, sin hot-reload):
bun run --cwd backend build && <relanzar backend :3001>
```

Prueba manual en la app (asistente): 
- "¿Qué lote tiene el lomo alto de añojo de Mar Menor?"
- "…y la semana pasada?"
- "¿De qué albarán viene el lote <uno real de la BD>?"

## Riesgos / rollback

- Dependencia circular de módulos → plan B documentado arriba (Prisma directo).
- Sin migración, sin escritura, sin cambio de esquema.
- Rollback: revertir 3 archivos nuevos/modificados de `ai-assistant` + el
  export en `albaranes.module.ts`. El asistente vuelve a 9 tools.
