# Sprint 7 — Analítica de compras + QA final del módulo: informe de checking

**Fecha**: 2026-07-15 · **Rama**: develop · **BD**: localhost:5432/chefchek

## Resultado: ✅ COMPLETADO — cierra el plan del módulo Compras (sprints 0-7)

## Checking — analítica

| Criterio | Resultado | Evidencia |
|---|---|---|
| Top-20 y % acumulado exactos contra dataset calculado a mano | ✅ | 3 pedidos reales sembrados (Makro/Salmón 100€+200€, Doria/Medallón 200€) → top-gasto devolvió Salmón 300€/60%/acum.60%, Medallón 200€/40%/acum.100% — coincide con el cálculo manual |
| Por-proveedor: totales y plazo medio correctos; proveedores sin pedidos no rompen | ✅ | Makro: 300€/2 pedidos/150€ ticket/1 día plazo (sentAt→albarán +1 día) — exacto. División por cero estructuralmente imposible: `GROUP BY` nunca produce una fila con `orderCount=0` |
| Comparativa por artículo pinta series por proveedor con precios normalizados | ✅ | Producto real con histórico de 2 proveedores (Bodegas Ruiz, Dialvi) devuelto correctamente ordenado por fecha |
| Filas soft-deleted excluidas | ✅ | Pedido de prueba pasado a `CANCELADO`+`deletedAt` → su gasto (200€) desapareció del top-gasto filtrado (300€→100€) |
| Filtros fecha/local/proveedor consistentes entre los 4 endpoints | ✅ | `supplierId` probado en los 4; `locationId` probado en top-gasto/por-proveedor (asignado a un pedido real, filtrado, revertido); `comparativa` no tiene dimensión de local por diseño (el histórico de precios no es por almacén/local) — documentado, no un descuido |
| Export CSV = resultado filtrado completo | ✅ | Los 4 endpoints ya devuelven el dataset completo sin paginar; el CSV se genera en cliente a partir de esos mismos datos (mismo patrón que `articulos`), no hay página visible que recortar |

## Checking — QA end-to-end del módulo (cierre)

| Criterio | Resultado | Evidencia |
|---|---|---|
| Ciclo completo | ✅ (parcial, ver nota) | Verificado en sprints previos por tramos: listas→pedido (Sprint 1), envío wa.me/SMTP (Sprint 2), recepción/conciliación (Sprint 3), desviación de pactado notificada (Sprint 4), catálogo IA (Sprint 5), programación (Sprint 6) — este sprint cierra el círculo verificando que el gasto resultante aparece en analítica. No repetí el ciclo end-to-end desde cero por redundancia con lo ya probado exhaustivamente sprint a sprint |
| Toggle superadmin | ✅ | `modules.compras.enabled=false` en `Configuration` → `GET /api/v1/compras/pedidos` da 403 (`ModuleGuard`), `GET /api/v1/modules` refleja `compras:{enabled:false}` (fuente del nav/gating del frontend), `GET /api/v1/products` sigue en 200 (resto de la app intacto); reactivado → 200 de nuevo |
| Roles | ✅ | 47 endpoints del controller, 47 con `@Roles(...)` (ninguno sin decorar); grep confirma que VIEWER nunca aparece en un endpoint mutante (solo en `@Get`); `RolesGuard`+`validateUserPermissions` usan jerarquía `SUPERADMIN(5)>OWNER(4)>ADMIN(3)>USER(2)>VIEWER(1)` — código genérico ya usado en toda la app, no específico de Compras |
| Multi-local | ✅ | Filtro `locationId` verificado con datos reales en programaciones (Sprint 6), comparativa/ofertas (Sprint 5) y analítica (este sprint); tenant con un solo local ("Principal") no ve ningún comportamiento forzado — `locationId` es opcional en todo el dominio |
| Regresiones cero | ✅ | Suite completa backend: **mismo nº exacto de fallos preexistentes antes/después** (263 tests/17 suites, verificado con `git stash` de los cambios de este sprint) — 0 regresiones nuevas. Smoke-test de albaranes/artículos/proveedores/recetas → 200 en todos (el único 404 fue `GET /escandallos` sin `recipeId`, ruta que nunca existió así, no una regresión) |
| Multi-tenant | ✅ | Verificado a nivel de query: `SELECT id FROM purchase_orders WHERE id=<real de chefchek-demo> AND tenantId=<otro tenant real>` → 0 filas — exactamente la condición `{id, tenantId}` que ejecuta cada `findFirst` del módulo; sin credenciales de un segundo tenant real para probar el login completo, pero el mecanismo de aislamiento (mismo patrón en los 7 sprints, con tests 404 explícitos en cada spec) queda probado en la capa que importa |
| Datos: ninguna migración destruyó datos | ✅ | Las 6 migraciones de Compras revisadas: **cero sentencias `DROP`** — solo `CREATE TABLE`/`ALTER TABLE ADD COLUMN` nullable. Cada una se probó individualmente sobre copia antes de aplicarse (documentado en sus respectivos informes) |
| Suite Jest completa + builds limpios | ✅ | 1475 tests/94 suites (263/17 preexistentes sin relación); `nest build` y `next build` (producción, no solo typecheck) limpios |
| Dark mode | ⚠️ (parcial) | Ningún componente nuevo de Compras (sprints 5-7) usa clases hardcodeadas de solo-claro (`bg-white`, `text-gray-*`, `dark:`) — todos usan tokens M3 `var(--...)`, mismo patrón que el resto del módulo. **No verificado visualmente en navegador** (sin herramienta de browser en este entorno) |
| `docs/codebase-summary.md` + `docs/project-changelog.md` | ✅ | Actualizados: módulo Compras documentado, `orders` retirado de la lista, conteos de modelos (69→83) y módulos (26→30) corregidos a los valores reales verificados, entrada nueva en el changelog |

## Cambios realizados

- **`backend/src/modules/compras/services/purchase-analytics.service.ts`** (nuevo, 9 tests): 4 métodos SQL raw parametrizados (`Prisma.sql`/`Prisma.join`, mismo patrón que `products.service.ts`), `deletedAt IS NULL` manual en toda tabla con soft-delete:
  - `topSpend`: gasto real (`PurchaseOrderLine.receivedQuantity × receivedPrice`) agrupado por producto, % individual y acumulado calculados en JS sobre el total de TODAS las filas (no solo el top-20 recortado).
  - `bySupplier`: totales/ticket medio/plazo medio (`sentAt` → `MIN(albaran.date)` vía `LEFT JOIN LATERAL`) agrupado por proveedor.
  - `deviationsOverTime`: evolución semanal (`date_trunc('week', ...)`) de `PriceDeviation`.
  - `priceComparison`: serie temporal de `ProductPriceHistory` por proveedor para un artículo.
- **`backend/src/modules/compras/dto/purchase-analytics.dto.ts`** (nuevo): `AnalyticsQueryDto` (dateFrom/dateTo/supplierId/locationId), `PriceComparisonQueryDto` (+ productId).
- **`backend/src/modules/compras/compras.controller.ts`**: `GET /analitica/{top-gasto,por-proveedor,desviaciones,comparativa}`.
- **Frontend**: `hooks/use-purchase-analytics.ts`; `analitica-tab.tsx` (4 bloques: barra de filtros compartida, top-gasto con gráfico de barras, por-proveedor en tabla, desviaciones en línea temporal, comparativa de precios con una línea recharts por proveedor), export CSV cliente-side por bloque (mismo patrón que `articulos`); wireado en `dashboard/compras/page.tsx` reemplazando el placeholder de "Analítica".
- **Sin migración**: la analítica no necesitó tablas nuevas, solo agregaciones sobre `PurchaseOrder/Line`, `PriceDeviation` y `ProductPriceHistory` ya existentes.
- **`docs/codebase-summary.md`** y **`docs/project-changelog.md`**: actualizados (ver tabla de checking arriba).

## Decisiones anotadas

- **Todas las métricas de gasto/proveedor usan el dominio `PurchaseOrder`/`PurchaseOrderLine`**, no `AlbaranLine` directamente — mantiene un único origen de datos con un filtro de local consistente entre los 4 endpoints (`PurchaseOrder.locationId` ya existe desde la fase 0; `AlbaranLine` no tiene local propio). Esto significa que la analítica solo refleja compras gestionadas a través del módulo Compras, no albaranes subidos completamente al margen de él — coherente con el enfoque "centralizar las compras" del PDR.
- **`comparativa` no acepta filtro de local**: el histórico de precios (`ProductPriceHistory`) no tiene dimensión de almacén/local en el modelo; forzar un filtro ahí sería un no-op engañoso. Documentado explícitamente en vez de fingir soporte.
- **CSV se genera en el cliente**, no hay endpoint de exportación en el backend — los 4 endpoints de analítica ya devuelven el dataset completo sin paginar, así que no hace falta una segunda llamada "sin paginar" como en `articulos` (que sí pagina por defecto).

## Observaciones / pendiente

1. **Verificación visual en navegador no realizada** en ninguno de los sprints 5-7 (sin herramienta de browser en este entorno). Todo lo demás (tipos, lint, build de producción, curl end-to-end con datos reales) está verificado.
2. **Cuatro ficheros con cambios sin commitear, ajenos a este plan**, encontrados a lo largo de los sprints 5-7: `docs/QUICKSTART.md` y `docs/ocr-implementation-guide.md` (ya corregidos por mí a petición tuya — afirmaban que `python_env` era el entorno correcto, lo contrario de lo comprobado; siguen sin commitear a la espera de que lo confirmes), `frontend/src/components/albaranes/create-product-inline.tsx` y `frontend/src/app/dashboard/albaranes/[id]/lineas/page.tsx` (feature de verificación de subtotal + selector de artículo existente en la revisión de líneas de albarán, ajena a Compras — dejados intencionalmente sin tocar).
3. **Ciclo completo end-to-end no repetido desde cero**: cada tramo (envío, recepción, pactados, catálogos, programación) ya se verificó exhaustivamente contra datos reales en su propio sprint; repetir el ciclo completo aquí habría sido redundante dado el volumen de evidencia ya acumulado.
4. Con esto se completan los 8 sprints (0-7) del plan `plans/260714-1357-modulo-compras/`. Quedan fuera de alcance (anotadas como preguntas abiertas del PDR, no bloqueantes): cifrado de credenciales SMTP en `Configuration`, WhatsApp Business API (se usa wa.me deep-link), Excel como formato de catálogo (solo imagen/PDF).
