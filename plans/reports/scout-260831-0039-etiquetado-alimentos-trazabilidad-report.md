# Scout Report — Sistema de etiquetaje de alimentos

Fecha: 2026-08-31. Alcance: qué existe ya en el codebase para apoyar un sistema de etiquetas (platos elaborados + artículos manipulados) tipo yurest.com.

## Archivos y modelos relevantes

### Trazabilidad de lote (ya montada — base para etiquetas)
- `backend/prisma/schema.prisma:1950` — `model Lot`: 1 registro por línea de albarán recibida. Campos: `lotNumber`, `productId`, `supplierId`, `albaranLineId` (`@unique`), `quantity`, `warehouseId`, `receivedAt`, `expiryDate` (**reservado, hoy nunca se rellena** — el OCR no lo extrae), `notes`. Back-rel a `StockMovement`.
- `backend/prisma/schema.prisma:1886` — `AlbaranLine.lot` (`String?`): nº de lote en crudo del OCR. `lotRecord Lot?`.
- `backend/prisma/schema.prisma:145` — `Product.lot` (`String?`): "último lote conocido" (visualización, no autoritativo).
- `backend/src/modules/albaranes/services/lot.service.ts` — `createLotFromReception` (solo escribe) + `findLots()` (lectura, añadida en plan `260830-2002`). Reutilizable para el picker de lotes de ingredientes.
- Planes previos: `plans/260716-2335-lote-albaranes-trazabilidad/` (done — dejó la base y **menciona literalmente "impresión de etiquetas" como caso de uso futuro**) y `plans/260830-2002-asistente-consulta-lotes/` (tool del asistente para consultar lotes).

### Recetas
- `backend/prisma/schema.prisma:355` — `model Recipe`: `elaboration` (JSON pasos), `allergens Int[]`, `portions`, `portionSize`, `notes`. **Sin campos de vida útil / conservación.**
- `RecipeIngredient` (`:424`) → producto; `RecipeSubRecipe` (`:442`) → receta hija.
- `backend/src/modules/recipes/` — controller + service (sin sub-carpeta services).

### Producción
- `backend/prisma/schema.prisma:1098` — `model ProductionOrder`: `recipeId?`, `quantity`, `unit`, `status`, `completedAt`, `batchId` → `WorkBatch` (`:1055`). **No hay vínculo orden→lotes de ingredientes consumidos.** Módulo `production` depende de `almacenes`, `defaultEnabled: true`.

### APPCC / conservación
- `backend/src/modules/appcc/` — controles de temperatura, `GoodsReception` (`:942`, `items Json`), planes de limpieza, `compliance-reports`. **Ninguna noción de "caducidad secundaria".**
- `model TemperatureControl` (`:834`) — tipos FRIDGE/FREEZER/STORAGE con rango de °C (referencia para el vocabulario de conservación).

### PDF / QR
- `backend/src/modules/technical-sheets/technical-sheets.service.ts` — usa `pdfkit`, streaming a `Res`, gating por `RoleAccessService`, `assets/allergens` (iconos). Plantilla directa para el render de etiquetas.
- `backend/src/modules/qr/` — `qr.controller.ts` genera QR por entidad (`/qr/entity/:type/:id`), `generate-with-logo`, `scan`. `qr.service.ts` reutilizable o `qrcode` npm.
- `docs/pdf-generation-engine.md`, `docs/technical-sheet-generation.md`, `docs/qr-generation-architecture.md`.

### Multi-tenant / módulos / permisos
- `backend/src/modules/modules/constants/registry.ts` — `MODULE_REGISTRY` (21 módulos). Patrón para nuevo módulo `defaultEnabled:false`: `sala-notificaciones`.
- `backend/src/guards/module.guard.ts` — `ModuleGuard` + `@RequireModule(id)`; usa `ModulesService.isModuleEnabled`.
- `backend/src/modules/role-access/constants/section-registry.ts` — `SECTION_REGISTRY` (secciones + sub-capacidades por rol USER/VIEWER). `SectionAccessGuard`.
- Plantilla de controller gateado: `backend/src/modules/sala-tasks/sala-tasks.controller.ts` — `@UseGuards(AuthGuard, TenantGuard, ModuleGuard, SectionAccessGuard)` + `@RequireModule("sala-notificaciones")`.

### Frontend
- `frontend/src/app/dashboard/` — 1 carpeta por módulo. Cero código de etiquetas/impresión térmica.
- `frontend/src/features/modules/lib/nav-config.ts` — `NAV_GROUPS` por categoría (menú en dropdowns).
- `frontend/src/app/dashboard/sala-notificaciones/` — módulo reciente `defaultEnabled:false` como referencia.

## Restricciones descubiertas (de memoria + código)

- Tests backend: **jest**, no `bun test`. Proyecto usa **bun** (1.3.14), no npm.
- Prisma migrate sin TTY → `migrate diff` + `migration.sql` manual + `migrate deploy`.
- Dos Postgres en dev (`:5432` brew / `:5433` docker); aplicar a la que usa el backend `:3001`.
- `globals.css` oculta `<header>`/`<nav>` no-`.fixed` → usar `<div>` / `role="tablist"`.
- Generadores de secuencia con soft-delete → `$queryRaw MAX(...)`, no `findFirst`.
- api-client desenvuelve `{success,data}` y respuestas paginadas.
- Módulo con `@UseGuards(AuthGuard)` debe importar `AuthModule`.
- `ValidationPipe` no coacciona number→string → `@Transform` en DTOs numéricos.
- iOS: `window.open` debe ser síncrono en el gesto para abrir PDF tras fetch.

## Preguntas sin resolver

- Medidas exactas de etiqueta térmica (ancho rollo / área imprimible) y modelo de impresora.
- Stock A4 concreto (referencia Apli u otra).
- ¿Ficha de trazabilidad por QR accesible sin login para inspección, o siempre con sesión?
- Grupo de menú para "Etiquetado" (Cocina / Seguridad-APPCC / Almacén).
