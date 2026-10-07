# Fase 2: Backend de ChefChek, módulo `cuiner`

## Contexto
- Registro de módulos: `backend/src/modules/modules/constants/registry.ts` (`MODULE_REGISTRY` + `@RequireModule`).
- Stock: `backend/src/modules/almacenes/almacenes.service.ts` (`createStockMovement`, `updateStock`); modelos `Stock`, `StockMovement`, `Warehouse`.
- Albaranes: `backend/src/modules/albaranes/` (`albaran-stock.service.ts`: `processStockOnConfirmation`); modelos `Albaran`, `AlbaranLine`.
- Recetas: `Recipe`, `RecipeIngredient`, `RecipeSubRecipe` en `backend/prisma/schema.prisma`.
- Migraciones sin TTY: `prisma migrate diff` + `migration.sql` (ver memoria). Tests con jest, no con `bun test`.

## Modelos (Prisma; todos con `tenantId`)
- `CuinerConfig`:
  - `centro`, `almacen` (códigos de Cuiner) y `warehouseId` (almacén de ChefChek donde descuentan las ventas);
  - `mode` (`DRY_RUN` | `LIVE`, por defecto DRY_RUN), `enabled`;
  - `connectorTokenHash`, `lastVentasCabId`, `lastSeenAt`.
- Catálogos de Cuiner (los envía el conector; solo lectura en ChefChek):
  - `CuinerSupplier(codigo, nombre, cif)`;
  - `CuinerArticle(codigo, descripcion, manipulacion, medida, tipoIva)`;
  - `CuinerArticleSupplier(articulo, proveedor, refProveedor, ultImporte…)`;
  - `CuinerDish(producto, nombre)`.
- Mapeos:
  - `CuinerSupplierMap(supplierId ↔ codigo)`;
  - `CuinerProductMap(productId ↔ articulo)`;
  - `CuinerDishMap(producto ↔ recipeId | productId)`.
- `CuinerAlbaranExport`:
  - `albaranId` (único), `status` (PENDIENTE | ENVIADO | ERROR | SIMULADO);
  - `payload` (JSON, con el cálculo ya hecho), `cuinerIdDocsCab`, `error`, `attempts`, `requestedBy`, `sentAt`.
- `CuinerSaleLine`:
  - `idVentasCab` y `linea` (únicos por tenant), `producto`, `unidades`, `fecha`;
  - `status` (APLICADA | SIN_MAPEO | IGNORADA), `stockMovementIds`.

## API
**Para el conector:** guard por token (`X-Connector-Token`), sin JWT de usuario.
- `GET /cuiner/connector/config`: devuelve el modo, el centro y el cursor.
- `PUT /cuiner/connector/catalog`: sube los catálogos (upsert en lotes).
- `POST /cuiner/connector/sales`: sube un lote de líneas de venta y avanza el cursor. Idempotente.
- `GET /cuiner/connector/albaranes/pending`: devuelve los albaranes con estado PENDIENTE y su payload.
- `POST /cuiner/connector/albaranes/:id/result`: registra `{ok, idDocsCab | error, simulated}`.

**Para usuarios:** JWT + `@RequireModule('cuiner')`.
- CRUD de la configuración y regeneración del token del conector.
- Mapeos, con sugerencias automáticas por nombre o CIF.
- `POST /albaranes/:id/cuiner/send`: botón «Enviar a Cuiner». Valida y encola.
- Listados de envíos y de ventas sin mapear.

## Cálculo del payload (en ChefChek, probado con tests)
- Fórmulas sacadas de la prueba real (informe de exploración):
  - `Base = round(uds × importe × (1 − dto/100), 2)`;
  - `CosteUM = Base / (uds × Medida)`;
  - `DocsSumas` agrupado por IVA, con `Cuota = round(Base × iva/100, 2)`;
  - `Total = Σ bases + Σ cuotas`.
- Test que reproduce el albarán de prueba: 1 × 8,422 con un 10% de descuento debe dar Base 7,58, CosteUM 2,1055, Cuota 0,76 y Total 8,34. También el albarán real 21294.
- Validaciones antes de encolar:
  - el albarán está CONFIRMADO;
  - el proveedor está mapeado;
  - todas las líneas tienen un artículo mapeado;
  - el IVA existe en `TiposIVA`.
  - Si algo falla, el error dice qué falta mapear.

## Validación
- Tests unitarios del cálculo y de las validaciones.
- Tests del guard de token y del aislamiento entre tenants.
- `bun run build` y lint sin errores.

## ✅ Implementada el 05/10/2026 (rama `feat/conector-cuiner`, sin commit)
**Esquema:** `backend/prisma/schema.prisma` (solo un bloque añadido al final) y migración `20261005200000_cuiner_integration`.
- 10 tablas `cuiner_*` y 3 enums, todo nuevo, sin relaciones Prisma.
- Aplicada en la base de desarrollo.

**Módulo:** `backend/src/modules/cuiner/`:
- `cuiner-albaran-payload.ts`: cálculo puro. El descuento se deduce del neto del papel: primero con 2 decimales y, si no cuadra, con 4. Mapa de códigos de IVA, con el 7,5 % → `'7'`.
- `cuiner-config.service.ts`: configuración, token (solo se guarda el sha256) y cursor inicial de ventas.
- `cuiner-mapping.service.ts`: catálogos y enlaces, validados contra el catálogo sincronizado y el tenant.
- `cuiner-export.service.ts`: previsualización con lista de problemas, cola de envíos y resultado (solo transiciona desde PENDIENTE).
- `cuiner-sales.service.ts`: ingesta idempotente; el cursor solo avanza.
- `guards/cuiner-connector.guard.ts` y los controladores `cuiner.controller.ts` (solo ADMIN/OWNER/SUPERADMIN, `@RequireModule("cuiner")`) y `cuiner-connector.controller.ts` (token).

**Registro de módulos:** módulo `cuiner`, desactivado por defecto, con dependencia de `albaranes`.

**Cambio respecto al plan:** `CosteUM = round5(Importe × (1 − dto) / Medida)`. No se calcula sobre la base redondeada; verificado con 6 líneas reales.

**Verificación:** 41 tests del módulo; `nest build` correcto; suite completa del backend: 143 suites y 2101 tests en verde.
