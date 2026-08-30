# Scout Report — Rol de usuario restringido ("sala / camarero")

Objetivo: permitir un usuario que SOLO ve: Recetas (ver en pantalla + imprimir, sin costo, sin ficha, sin tabs), Producción (incl. crear lotes), Notificaciones de Sala (como está, puede crear), Asistente IA (limitado a lo que puede ver). Todo lo demás oculto: Equipo, Almacén, Compras, Albaranes, Artículos, Proveedores, Menús, APPCC, etc.

## Hallazgos clave (arquitectura de autorización)

### 1. Enum de roles — no existe rol "sala"
- `backend/prisma/schema.prisma:485` — `enum UserRole { SUPERADMIN OWNER ADMIN USER VIEWER }`
- `frontend/src/types/api.types.ts:26` — mismo union type
- `frontend/src/components/protected-route.tsx:7` — mismo union
- `backend/src/modules/users/dto/create-user.dto.ts:16,63` — `@IsEnum(["ADMIN","USER","VIEWER"])` (crear/editar solo permite estos 3; OWNER/SUPERADMIN se rechazan — ver memoria `user-patch-400-role-not-in-enum`)

### 2. RolesGuard es ESTRICTAMENTE JERÁRQUICO (constraint central)
- `backend/src/guards/roles.guard.ts` + `backend/src/decorators/roles.decorator.ts` (`@Roles(...)`, key `"roles"`)
- `backend/src/modules/users/users.service.ts:329-355` `validateUserPermissions`:
  - jerarquía `SUPERADMIN:5 OWNER:4 ADMIN:3 USER:2 VIEWER:1`
  - regla: `requiredRoles.some(r => userLevel >= level(r))` → pasa si el usuario iguala/supera **el más bajo** de los roles listados.
  - Consecuencia: `@Roles("ADMIN","USER")` = cualquiera ≥ USER; `@Roles("ADMIN")` = ≥ ADMIN.
- Implicación para el nuevo rol: si se inserta como nivel bajo (≤ USER), automáticamente:
  - ✅ bloquea rutas `@Roles("ADMIN")` (crear usuarios, borrar recetas, etc.)
  - ❌ pero también **concede** todo lo marcado `@Roles("ADMIN","USER")` en los 21 controllers (incluye `recipes` POST/PATCH, `production` writes, etc.)
  - → un rol puramente jerárquico NO expresa "recetas solo lectura + producción escritura". Hace falta rol **lateral** + allowlist explícito por ruta, o migrar al PermissionGuard (ver punto 3).

### 3. PermissionGuard / ROLE_PERMISSIONS — existe pero está SIN USAR
- `backend/src/guards/permission.guard.ts` (`@RequirePermissions`, `RequireAnyPermission`, helpers `CanCreateRecipes`…)
- `backend/src/modules/auth/permissions.service.ts` — `PERMISSIONS` granular + `ROLE_PERMISSIONS` map (ADMIN/USER/VIEWER → listas de capabilities `recipes:read` etc.)
- `grep RequirePermissions|PermissionGuard` en `backend/src/modules` → **0 usos**. Código muerto. `ROLE_PERMISSIONS` no está cableado a ningún guard de ruta.
- Opción: es el mecanismo "correcto" para capabilities por-rol, pero implica cablear el guard en cada controller relevante.

### 4. Módulos (ModuleGuard / nav-config) son PER-TENANT, no per-user
- `backend/src/guards/module.guard.ts` (`@RequireModule("x")`) → `ModulesService.isModuleEnabled(tenantId, x)`. SUPERADMIN bypass. NO mira rol.
- `backend/src/modules/modules/constants/registry.ts` — `MODULE_REGISTRY` (ids: `recipes`, `production`, `sala`, `sala-notificaciones`, `asistente-ia`, `almacenes`, `articulos`, `compras`, `albaranes`, `proveedores`, `menus`, `appcc`, `allergens`, …). Ver memoria `modules-registry-per-tenant-activation`.
- `frontend/src/features/modules/lib/nav-config.ts` — `NAV_GROUPS`, `MOBILE_NAV`, `ROUTE_MODULE_MAP`, `moduleForPath()`.
  - Nota: "Equipo" (`/dashboard/users`) está gateado por `moduleId: 'sala'` (no por rol).
- `frontend/src/features/modules/hooks/use-modules.ts` — `isEnabled(moduleId)`; per-tenant, sin noción de rol.
- → No se puede reutilizar el sistema de módulos para restringir por-usuario. La nav **nunca** filtra por rol hoy.

### 5. Nav / rutas frontend — cero filtrado por rol
- `frontend/src/app/dashboard/layout.tsx:99-106` `visibleGroups` = `NAV_GROUPS` filtrado SOLO por `isEnabled(item.moduleId)`.
- `layout.tsx:52-58` — redirección directa por URL: solo por módulo deshabilitado (`moduleForPath` + `isEnabled`), no por rol.
- `frontend/src/components/protected-route.tsx` — SÍ soporta `requiredRoles`, pero `grep` muestra que solo lo usa el panel superadmin (`superadmin-dashboard-page.tsx:39,60` hace su propio check). Las páginas de `/dashboard/*` no envuelven en `ProtectedRoute` con roles.
- Checks de rol ad-hoc dispersos en páginas (patrón `MANAGE_ROLES.includes(user?.role)` / `user?.role === 'VIEWER'`): `compras/page.tsx:79`, `articulos/page.tsx:41`, `proveedores/page.tsx:94`, `backups/page.tsx:33`, `proveedores/components/supplier-offers-ficha-dialog.tsx:26`. No hay helper central.

### 6. Recetas — la vista restringida YA EXISTE
- `frontend/src/app/dashboard/recipes/components/recipe-visual-view.tsx` — modal solo-lectura: nombre, descripción, ingredientes, elaboración, alérgenos, botón **Imprimir** (`onPrint`, `isPrinting`). **No muestra costo.**
- `frontend/src/app/dashboard/recipes/page.tsx`:
  - `:342` `handleViewRecipeCard` → PDF `recipeCardOnly: true` (sin costes ni alérgenos) — el "imprimir receta".
  - `:333` `handleViewSheet` → ficha técnica PDF `includeCosts:true` (esto NO debe verlo el rol sala).
  - `:671-708` vista móvil ya es solo-lectura → abre `setVisualViewRecipe` (RecipeVisualView). El escritorio muestra tabla con columna "Costo/Ración" (`:720,:789`), botón ficha (`:830`), y el modal de edición con tabs (`:921` `role="tablist"`).
  - Costo vive en: `recipe-cost-modal.tsx`, `recipe-cost-tables.tsx`, `recipe-pricing-editor.tsx`, columna tabla desktop.
- Backend `backend/src/modules/recipes/recipes.controller.ts:37` `@UseGuards(AuthGuard,TenantGuard,RolesGuard,ModuleGuard)` `@RequireModule("recipes")`:
  - `GET /`, `GET /:id`, `GET /:id/calculate`, `GET options`, `check-name` → `@Roles("ADMIN","USER","VIEWER")`
  - `POST`, `PATCH /:id`, `POST /:id/duplicate`, `upload-image` → `@Roles("ADMIN","USER")`
  - `DELETE /:id` → `@Roles("ADMIN")`
  - `GET /:id/calculate` (coste) es `VIEWER+` → si el rol sala es ≥ VIEWER podrá pedir coste vía API salvo que se restrinja.

### 7. Producción
- `backend/src/modules/production/production.controller.ts:48` `@UseGuards(AuthGuard,TenantGuard,RolesGuard,ModuleGuard)` `@RequireModule("production")` (dep: `almacenes`).
  - Crear lote `POST batches` `:55` → `@Roles("ADMIN","USER")`. Completar, orders, tasks, staff writes → todos `@Roles("ADMIN","USER")`. Lecturas → `+VIEWER`.
  - → el rol sala necesita nivel ≥ USER (o allowlist explícito) para crear lotes.
  - Nota dependencia: módulo `production` depende de `almacenes` en el registry (per-tenant, no afecta al rol, pero el módulo `almacenes` debe estar activo en el tenant).
- Frontend `frontend/src/app/dashboard/production/page.tsx` — sin gating por rol; tabs internos.

### 8. Notificaciones de Sala
- `backend/src/modules/sala-tasks/sala-tasks.controller.ts:26` `@UseGuards(AuthGuard, TenantGuard, ModuleGuard)` — **SIN RolesGuard**. `@RequireModule("sala-notificaciones")` (defaultEnabled:false).
  - Todos los endpoints (POST/GET/PATCH/DELETE/reorder) abiertos a cualquier usuario autenticado del tenant. "Como está" = ya funciona para cualquier rol.
- Frontend `frontend/src/app/dashboard/sala-notificaciones/page.tsx` + card dashboard (`frontend/src/app/dashboard/page.tsx:55-56` `salaNotificacionesEnabled`).
- Módulo `sala` (id `sala`, name "Equipo") ≠ módulo `sala-notificaciones`. "Equipo" que el rol NO debe ver = ruta `/dashboard/users` gateada por `moduleId:'sala'`.

### 9. Asistente IA
- `backend/src/modules/ai-assistant/ai-assistant.controller.ts:22` `@UseGuards(AuthGuard,TenantGuard,RolesGuard,ModuleGuard)` `@RequireModule("asistente-ia")` `@Roles("ADMIN","OWNER","SUPERADMIN","USER","VIEWER")` (todos).
- Herramientas: `backend/src/modules/ai-assistant/tools/` — `price-history`, `price-increases`, `purchase-spend`, `recipe-cost`, `stock`, `top-purchased-products`, `pending-price-deviations`. **Todas orientadas a coste / compras / stock.**
- `tool-registry.service.ts` + `ai-assistant.service.ts` — scoping SOLO por `tenantId`; NO por rol ni por módulos activos. Config IA por tenant (memoria `chefchek-ai-assistant-tool-calling-architecture`, PR #36).
- → "el asistente dentro de lo que puede ver" NO está implementado: hoy un rol sala podría preguntar costes de recetas, gasto de compras, subidas de precio, stock. Requiere filtrar el tool-registry por rol/capabilities.

### 10. Registro global de guards
- `backend/src/app.module.ts:122` — único `APP_GUARD` global = `ThrottlerGuard`. Auth/roles/module se aplican **por-controller** vía `@UseGuards`. No hay guard de rol global.
- `backend/src/modules/auth/auth.service.ts:77-83` — el login devuelve `user { id,email,name,role,tenantId,avatarUrl }`. No devuelve módulos ni permisos (los módulos se piden aparte con `fetchModuleStates`).

## Superficie de cambio estimada (para el plan)

| Capa | Archivos |
|---|---|
| Enum rol | `backend/prisma/schema.prisma` (migración), `frontend/src/types/api.types.ts`, `frontend/src/components/protected-route.tsx`, `backend/src/modules/users/dto/create-user.dto.ts` |
| Modelo authz backend | decidir: (a) rol lateral + `@Roles` allowlist por ruta, o (b) cablear `PermissionGuard`+`ROLE_PERMISSIONS`. Tocar `roles.guard.ts` / `users.service.ts:validateUserPermissions` si lateral. |
| Gating rutas backend | `recipes.controller.ts` (bloquear coste/`calculate`, ficha, writes salvo lo permitido), `production.controller.ts` (permitir writes al rol), `sala-tasks.controller.ts` (ya abierto), resto de controllers (denegar) |
| Nav frontend | `frontend/src/features/modules/lib/nav-config.ts` (añadir `roles?` por `NavItem` o allowlist), `frontend/src/app/dashboard/layout.tsx` (`visibleGroups` + redirección `moduleForPath` con check de rol) |
| Recetas UI | `frontend/src/app/dashboard/recipes/page.tsx` — para rol sala: forzar vista `RecipeVisualView` + imprimir, ocultar columna Costo, botón ficha, modal edición, tabs |
| Asistente | `backend/src/modules/ai-assistant/tools/tool-registry.service.ts` + `ai-assistant.service.ts` — filtrar herramientas por rol/capabilities |
| Dashboard home | `frontend/src/app/dashboard/page.tsx` — cards visibles según rol |
| Seed/gestión | `backend/prisma/seed.ts`, `frontend/src/app/dashboard/users/components/user-modal.tsx` (opción de rol) |

## DIRECCIÓN FINAL (decidida con el usuario, 2026-08-30)

**No hay rol nuevo.** En su lugar: pantalla de ajustes donde OWNER/ADMIN configura, por su cliente, **qué apartados ven los roles USER y VIEWER**, más sub-opciones dentro de Recetas.

- Configura: **OWNER/ADMIN** desde Configuración (per-tenant).
- Alcance: **solo afecta a USER y VIEWER**. ADMIN/OWNER/SUPERADMIN siempre lo ven todo.
- Granularidad: **on/off por apartado** (Recetas, Producción, Almacén/Stock, Compras, Albaranes, Artículos, Proveedores, Equipo, Notif. de Sala, Menús, APPCC, Alérgenos, Asistente IA, Menú digital, Wiki, Fichas técnicas…) **+ dentro de Recetas**: ocultar coste / ocultar ficha técnica / quitar edición (dejar solo ver + imprimir con `RecipeVisualView`).
- Capa **sobre** el sistema de módulos existente: si un módulo está OFF para el tenant, nadie lo ve. La config de rol solo **quita** acceso adicional a USER/VIEWER. La pantalla de ajustes solo lista apartados que el tenant tiene activos.
- **Compatibilidad**: sin config guardada → USER y VIEWER ven lo de hoy (la feature solo resta).

### Almacenamiento
Reusar tabla `Configuration` (`tenantId` + `key` + `value`), igual que `modules.{id}.enabled`:
- `roleAccess.USER.recipes = "false"` (apartado oculto)
- `roleAccess.USER.recipes.cost = "false"` / `roleAccess.USER.recipes.ficha = "false"` / `roleAccess.USER.recipes.edit = "false"`
- Ídem `roleAccess.VIEWER.*`
- `backend/src/modules/modules/modules.service.ts:24` ya hace este patrón (`key: { startsWith: "modules." }`).

### Backend — nuevo guard + endpoints
- Nuevo `SectionAccessGuard` + `@RequireSection("recipes")` (misma mecánica que `ModuleGuard`): lee metadata + config del tenant para el `req.user.role`. Bypass si rol ≥ ADMIN. 403 si USER/VIEWER no tiene el apartado.
  - Colocar tras `AuthGuard, TenantGuard` en los controllers de apartado: `recipes`, `production`, `almacenes`, `compras`, `albaranes`, `products`, `proveedores`, `menus`, `appcc`, `allergens`, `users` (Equipo), `sala-tasks`, `ai-assistant`, `digital-menu`, `conocimiento`, `technical-sheets`.
- Recetas sub-flags: gate a `GET /recipes/:id/calculate` (coste), ficha técnica (`technical-sheets` o el endpoint PDF con `includeCosts`), y writes (`POST`/`PATCH`/`duplicate`/`upload-image`) con `@RequireSection("recipes.cost" | "recipes.edit")`.
- CRUD config: `GET/PUT /api/v1/role-access` (o dentro de `modules`/`settings`), `@Roles("ADMIN")`. Devuelve/acepta el mapa `{ USER: {...}, VIEWER: {...} }`.
- Entregar la config efectiva al frontend: añadir a la respuesta de `/auth` login y a un `GET /role-access/me` (o piggyback en `fetchModuleStates`).

### Frontend
- Hook `useSectionAccess()` (espejo de `useModules()`), consumido en `layout.tsx`.
- `frontend/src/features/modules/lib/nav-config.ts` — `NAV_GROUPS`/`MOBILE_NAV` filtrado también por `canSeeSection(item)`; `ROUTE_MODULE_MAP` → añadir chequeo de sección en la redirección de `layout.tsx:52-58`.
- `frontend/src/app/dashboard/recipes/page.tsx` — con `!canViewCost`: ocultar columna "Costo/Ración" (`:720,:789`), badge de desvío, `RecipeCostModal`, `recipe-pricing-editor`. Con `!canViewFicha`: ocultar botón Ficha (`:830`) y `handleViewSheet`. Con `!canEditRecipes`: fila abre `RecipeVisualView` (ya existe) en vez del modal de edición; ocultar "Nueva receta", borrar, duplicar.
- `frontend/src/app/dashboard/page.tsx` — cards del home según secciones visibles.
- **Nueva UI de ajustes**: `frontend/src/app/dashboard/settings/` — panel "Permisos por rol": 2 columnas (USER / VIEWER), checkbox por apartado activo del tenant + sub-checkboxes de Recetas. Patrón visual: como el toggle de módulos del panel superadmin.

### Respuestas de detalle (2026-08-30, 2ª ronda)

**1. Producción / Tareas.** El apartado "Producción" (`/dashboard/production`, crear lotes, mise-en-place) queda **OFF** para el rol restringido. Pero el rol **sí ve y completa las "Tareas de Prep. Próximas"** del dashboard home. → tratar como el patrón Recetas: sección `production` con sub-flag `production.tasks`.
- Dashboard board: `frontend/src/app/dashboard/page.tsx:253` `tareasPendientesBoard` → `kpis.upcomingProductionTasks` (`use-dashboard-kpis`), acciones: completar (`useCompleteProductionTask` → `PUT /production/orders/:orderId/complete`, hoy `@Roles("ADMIN","USER")`), postponer, reordenar (`PATCH /production/orders/reorder`).
- Con `production` OFF + `production.tasks` ON: mostrar el board, permitir **completar**; el click de fila NO debe navegar a `/dashboard/production` (bloqueado) — o llevar a una vista de tarea de solo lectura. Reordenar/postponer: decidir (ver preguntas).
- Backend: los endpoints `PUT /production/orders/:orderId/complete` (y los que use el board) necesitan aceptar el sub-flag `production.tasks` aunque la sección `production` esté denegada. Endpoint KPIs del dashboard (`dashboard` controller) debe seguir accesible.
- USER **no** puede crear lotes (ya es `@Roles("ADMIN","USER")` en `POST /production/batches` — se le denegará vía `@RequireSection("production")`).

**2. Asistente IA.** Nuevo flag de rol `canViewCosts` (ligado a "ver coste" de Recetas / o propio). Con `canViewCosts=false`:
- **Bloquear** tools que devuelven importes €: `recipe-cost`, `price-history`, `price-increases`, `purchase-spend`, `pending-price-deviations`.
- **Permitir** consultas de "¿hemos comprado X?", cantidades y stock: `top-purchased-products`, `stock` — pero **quitando campos de precio/€** de su salida.
- Implementar en `backend/src/modules/ai-assistant/tools/tool-registry.service.ts` (filtrar catálogo por rol) + saneado de salida en las tools permitidas. `ai-assistant.service.ts` pasa `role` además de `tenantId`.

**3. Apartados transversales.** Histórico de precios, Papelera, Copias de seguridad, Sprint → **ocultables** para USER/VIEWER. Añadir como claves de sección propias (`historico-precios`, `papelera`, `backups`, `sprint`) aunque no tengan `moduleId`; gating en nav (`nav-config.ts` items sin `moduleId`) + en sus controllers/páginas.

---

## Preguntas sin resolver

1. **Tareas de prep. — acciones exactas.** Con `production` OFF + `production.tasks` ON: además de **completar**, ¿el rol puede **posponer** y **reordenar** tareas desde el dashboard? ¿O solo ver + completar?
2. **Click en una tarea del board**: hoy navega a `/dashboard/production?batchId=…` (bloqueado para el rol). ¿Deshabilitar el click (solo el botón completar), o abrir un detalle de tarea de solo lectura?
3. **VIEWER vs USER en escritura.** VIEWER hoy es solo-lectura en toda la app. Si el OWNER activa "Notif. de Sala" o "Recetas > editar" a un VIEWER, ¿se le permite escribir (la config manda) o VIEWER sigue siendo siempre RO y la config solo controla visibilidad?
4. **`canViewCosts`** — ¿es la misma casilla que "Recetas > ver coste", o una casilla independiente (afecta a asistente + escandallos + histórico)? Escandallos es módulo aparte (`escandallos`).
5. **Dashboard home**: ¿qué cards se ocultan y ligadas a qué sección? (board Tareas Prep ↔ `production.tasks`, card Notif. Sala ↔ `sala-notificaciones`, KPIs/alertas de compras ↔ `compras`/`albaranes`…).
6. **Efecto al guardar la config**: ¿aplica en el próximo login, o en vivo (refetch / WebSocket)?
7. **Impresión de receta**: ¿vale la de `RecipeVisualView` (incluye alérgenos) o el PDF `recipeCardOnly` (sin alérgenos)? ¿El rol restringido ve alérgenos?
8. **Nombre de la pantalla** en Configuración (p. ej. "Permisos por rol" / "Qué ve cada rol").
