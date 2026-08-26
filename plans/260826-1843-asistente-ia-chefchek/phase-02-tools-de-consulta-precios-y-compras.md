---
phase: 2
title: Tools de consulta (precios y compras)
status: completed
priority: P1
dependencies:
  - 1
---

# Phase 2: Tools de consulta (precios y compras)

## Overview

Catálogo de "tools" (funciones) que el LLM puede invocar para responder preguntas concretas, envolviendo/ampliando la analítica que ya existe en `compras` (`purchase-analytics.service.ts`, `PriceAgreementService`, `ProductPriceHistory`), en `recipes`/`escandallos` (coste de receta) y en `almacenes` (stock), en vez de generar SQL libre.

<!-- Updated: Validation Session 1 - alcance v1 ampliado a recetas/costes/stock; get_price_increases usa ProductPriceHistory (no SupplierPriceHistory, que solo guarda precio medio) -->


## Requirements

- Funcional: cubrir explícitamente los dos ejemplos del usuario — "¿quién me ha subido precios este mes/semana?" y "¿qué producto se compró más la última semana?" — más un set razonable de preguntas relacionadas (gasto por proveedor, histórico de precio de un producto, artículos con desviación de precio pendiente de revisar).
- No-funcional: cada tool recibe `tenantId` como primer argumento inyectado por el orquestador (fase 3), **nunca** como parámetro que el LLM pueda rellenar — el JSON schema expuesto al LLM no incluye `tenantId`.
- No-funcional: cada tool devuelve datos ya formateados/resumidos (no dumps de filas crudas) para que el LLM no tenga que hacer aritmética — evita alucinaciones de cifras.
- No-funcional: registro de tools extensible (patrón similar a `MODULE_REGISTRY`) para poder añadir preguntas nuevas sin tocar el orquestador.

## Architecture

```
ToolRegistry (array de ToolDefinition)
  name: string                    // "get_price_increases"
  description: string             // para que el LLM elija bien
  parameters: JSONSchema           // { from?, to?, supplierId? }
  handler: (tenantId, params) => Promise<ToolResult>
```

Tools iniciales (v1) — 9 tools, alcance ampliado en validación a recetas/costes/stock:

1. `get_price_increases(tenantId, { period: "week"|"month", supplierId? })` — quién subió precios en el periodo. Query sobre **`ProductPriceHistory`** (verificado en schema.prisma:1961: tiene `previousPrice`, `newPrice`, `supplierId`, `recordedAt` — **no** `SupplierPriceHistory`, que solo guarda `averagePrice`/`recordDate`, un snapshot sin antes/después) filtrando `newPrice > previousPrice` y `recordedAt` en el periodo, agrupado por proveedor con % de subida por artículo.
2. `get_top_purchased_products(tenantId, { period: "week"|"month", limit? })` — producto(s) más comprados por cantidad. Agrega `PurchaseOrderLine.receivedQuantity` (confirmado en validación: "lo pedido y conciliado", mismo dominio que ya usa `PurchaseAnalyticsService`, no `AlbaranLine`).
3. `get_top_spend_products(tenantId, { period, limit? })` — envoltorio directo de `PurchaseAnalyticsService` existente (top gasto, ya implementado).
4. `get_supplier_spend(tenantId, { period })` — envoltorio de `SupplierSpendRow` existente.
5. `get_price_history(tenantId, { productName })` — resuelve el producto por nombre (fuzzy, reusar accent-folding de `articulos-advisory-duplicate-name-check`) y devuelve su histórico de precio resumido (`ProductPriceHistory`).
6. `get_pending_price_deviations(tenantId)` — desviaciones de precio (`PriceDeviation`) aún sin revisar.
7. `get_recipe_cost(tenantId, { recipeName })` — resuelve receta por nombre (mismo fuzzy match que producto) y envuelve `RecipesService.calculateRecipeCost` (`backend/src/modules/recipes/recipes.service.ts:576`) para devolver coste total/por ración y margen.
8. `get_low_stock_products(tenantId, { warehouseId? })` — envuelve `WarehousesService.getStock` (`backend/src/modules/almacenes/almacenes.service.ts:144`) filtrando `quantity <= reorderLevel` (modelo `Stock`, campos `quantity`/`minimumStock`/`reorderLevel` verificados en schema.prisma:1322).
9. `get_product_stock(tenantId, { productName })` — resuelve producto por nombre, devuelve stock actual por almacén vía `WarehousesService.getStock`.

## Related Code Files

- Create: `backend/src/modules/ai-assistant/tools/tool-registry.service.ts`
- Create: `backend/src/modules/ai-assistant/tools/price-increases.tool.ts`
- Create: `backend/src/modules/ai-assistant/tools/top-purchased-products.tool.ts`
- Create: `backend/src/modules/ai-assistant/tools/purchase-spend.tool.ts` (envuelve `PurchaseAnalyticsService`)
- Create: `backend/src/modules/ai-assistant/tools/price-history.tool.ts`
- Create: `backend/src/modules/ai-assistant/tools/pending-price-deviations.tool.ts`
- Create: `backend/src/modules/ai-assistant/tools/recipe-cost.tool.ts` (envuelve `RecipesService.calculateRecipeCost`)
- Create: `backend/src/modules/ai-assistant/tools/stock.tool.ts` (`get_low_stock_products` + `get_product_stock`, envuelve `WarehousesService.getStock`)
- Create: `backend/src/modules/ai-assistant/tools/*.tool.spec.ts` (uno por tool con casos reales)
- Modify: `backend/src/modules/compras/services/purchase-analytics.service.ts` SOLO si hace falta exponer un método nuevo de agregación por cantidad (hoy es por gasto/€, no por unidades) — confirmar antes de tocarlo, puede bastar con una query nueva en el tool en vez de modificar el servicio existente.
- Reference: `backend/src/modules/compras/services/purchase-analytics.service.ts`, `backend/src/modules/compras/services/price-agreement.service.ts`, `backend/src/modules/recipes/recipes.service.ts` (`calculateRecipeCost`, línea 576), `backend/src/modules/almacenes/almacenes.service.ts` (`getStock`, línea 144), `backend/prisma/schema.prisma` (`ProductPriceHistory` línea 1961, `PriceDeviation` línea 2270, `Stock` línea 1322, `PurchaseOrderLine` línea 2144)

## Implementation Steps

1. Implementar `get_price_increases` sobre **`ProductPriceHistory`**: query filtrando `newPrice > previousPrice` y `recordedAt` dentro del periodo pedido, agrupado por proveedor con lista de artículos afectados y % de subida. Reusar el patrón `deletedAt IS NULL` manual si se usa SQL raw (memoria: soft-delete middleware no aplica en `$queryRaw`); con Prisma normal (`findMany`) el middleware ya lo aplica solo.
2. Implementar `get_top_purchased_products`: agregación `SUM(receivedQuantity)` sobre `PurchaseOrderLine`, mismo dominio (`PurchaseOrder`) que `PurchaseAnalyticsService` — confirmado en validación, no usar `AlbaranLine`.
3. Implementar `get_top_spend_products`/`get_supplier_spend` como wrappers finos que llaman directamente a `PurchaseAnalyticsService` existente y formatean el resultado para el LLM (no reimplementar la lógica).
4. Implementar `get_price_history` con resolución de producto por nombre: reusar `regexp_replace`/accent-folding ya usado en `check-name` (memoria `duplicate-name-check-hyphen-separator-fix`) para tolerar variaciones de escritura.
5. Implementar `get_pending_price_deviations` sobre `PriceDeviation` (ya tiene service en `price-agreement.service.ts`, solo falta el wrapper de formato para el LLM).
6. Implementar `get_recipe_cost`: resolver receta por nombre (mismo fuzzy match que producto) y llamar a `RecipesService.calculateRecipeCost` — leer su firma completa (`recipes.service.ts:576`) antes de envolverla, ya que puede requerir `tenantId` + `recipeId` y devolver un shape con desglose que hay que resumir para el LLM.
7. Implementar `get_low_stock_products`/`get_product_stock`: llamar a `WarehousesService.getStock(tenantId, query)` (`almacenes.service.ts:144`) y filtrar/formatear en el tool (no modificar el servicio) comparando `quantity` vs `reorderLevel`/`minimumStock`.
8. `ToolRegistryService`: array central `TOOL_REGISTRY: ToolDefinition[]` (9 entradas) + método `getToolSchemas()` (para pasar al LLM) y `executeTool(tenantId, name, params)` (valida `name` contra el registro, nunca ejecuta algo no registrado).
9. Tests unitarios por tool con datos sembrados (seed mínimo en el spec, no fixtures compartidos) verificando: (a) resultado correcto, (b) tenant A nunca ve datos de tenant B con el mismo `productId`/`supplierId`/`recipeId`.

## Success Criteria

- [ ] Las 9 tools responden correctamente contra datos reales de un tenant de prueba (verificado manualmente con `curl` o test de integración).
- [ ] Ningún tool acepta `tenantId` como parámetro expuesto al LLM — confirmado leyendo el JSON schema generado por `getToolSchemas()`.
- [ ] Test cruzado de aislamiento: tool ejecutado con `tenantId` de tenant A nunca devuelve filas de tenant B, para las 9 tools.
- [ ] `ToolRegistryService.executeTool` rechaza (no crashea) un `name` desconocido.
- [ ] Tests en verde vía `bunx jest`.

## Risk Assessment

- **Riesgo**: `get_price_increases` con SQL raw/Prisma olvida excluir productos/proveedores borrados. Mitigación: si se usa `$queryRaw`, copiar literalmente el patrón de condiciones de `buildOrderConditions` en `purchase-analytics.service.ts`; si se usa el cliente Prisma normal, el middleware de soft-delete ya lo cubre.
- **Riesgo**: `calculateRecipeCost` (recipes.service.ts:576) puede tener una firma o shape de retorno distinto al asumido aquí — no se leyó el cuerpo completo en el scouting inicial. Mitigación: leer la firma completa antes de escribir `recipe-cost.tool.ts` (paso 6), ajustar el wrapper al shape real.
- **Riesgo**: ampliar a 9 tools en vez de 6 aumenta el tamaño del system prompt (más `toolSchemas`) y el riesgo de que el LLM elija mal entre tools similares (p.ej. `get_product_stock` vs `get_low_stock_products`). Mitigación: descripciones de tool explícitas y sin solape, probadas manualmente en fase 6 con las preguntas reales del usuario.
