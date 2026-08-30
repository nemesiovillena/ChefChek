---
phase: 1
title: 'Backend: núcleo de acceso por sección'
status: completed
priority: P1
dependencies: []
---

# Phase 1: Backend — núcleo de acceso por sección

## Overview

Módulo `role-access`: registro de secciones, servicio de resolución sobre `Configuration`, `SectionAccessGuard` + `@RequireSection`, endpoints CRUD para OWNER/ADMIN, y cableado del guard en los controllers ligados a apartado. Sin cambios de comportamiento observable todavía (default = permitido).

## Requirements

- Funcional: `GET /api/v1/role-access` devuelve `{ USER: {...}, VIEWER: {...} }` con todas las secciones y su booleano efectivo para el tenant. `PUT /api/v1/role-access` persiste cambios (solo `@Roles("ADMIN")`). `GET /api/v1/role-access/me` devuelve el mapa plano de secciones permitidas para el usuario autenticado.
- Funcional: cualquier controller con `@RequireSection("x")` responde `403 {error:"SECTION_HIDDEN", section:"x"}` a un USER/VIEWER sin acceso; ADMIN+ nunca se bloquea.
- No-funcional: sin config guardada, ningún endpoint cambia de comportamiento. `isSectionAllowed` cacheable por request (evitar N queries por request).
- No-funcional: no romper los specs existentes de los controllers tocados.

## Architecture

### Nuevo módulo `backend/src/modules/role-access/`

```
role-access/
  constants/section-registry.ts   # SECTION_REGISTRY + helpers
  dto/role-access.dto.ts          # UpdateRoleAccessDto
  role-access.service.ts          # getRoleAccess, isSectionAllowed, updateRoleAccess, getSectionsForUser
  role-access.service.spec.ts
  role-access.controller.ts       # GET / PUT / GET me
  role-access.controller.spec.ts
  role-access.module.ts           # exporta RoleAccessService
```

### `section-registry.ts`

```ts
import { MODULE_REGISTRY } from "../../modules/constants/registry";

export interface SectionDefinition {
  key: string;               // 'recipes', 'recipes.cost', 'historico-precios'
  label: string;             // 'Recetas', 'Ver coste', 'Histórico de precios'
  moduleId?: string;         // id de MODULE_REGISTRY si la sección depende de un módulo
  parent?: string;           // key del padre para sub-capacidades
  defaultAllowed: boolean;   // siempre true (la feature solo resta) — explícito para claridad
}

export const SECTION_REGISTRY: SectionDefinition[] = [
  // ligadas a módulo (label/moduleId derivados de MODULE_REGISTRY donde aplique)
  { key: "articulos", label: "Artículos", moduleId: "articulos", defaultAllowed: true },
  { key: "recipes", label: "Recetas", moduleId: "recipes", defaultAllowed: true },
  { key: "recipes.cost", label: "Ver coste", parent: "recipes", defaultAllowed: true },
  { key: "recipes.ficha", label: "Ver ficha técnica", parent: "recipes", defaultAllowed: true },
  { key: "recipes.edit", label: "Editar recetas", parent: "recipes", defaultAllowed: true },
  { key: "production", label: "Producción", moduleId: "production", defaultAllowed: true },
  { key: "production.tasks", label: "Ver tareas de preparación", parent: "production", defaultAllowed: true },
  // ... resto de módulos: menus, escandallos, almacenes, sala, sala-notificaciones,
  //     appcc, allergens, digital-menu, albaranes, compras, proveedores,
  //     conocimiento, technical-sheets, asistente-ia, categories
  // transversales (sin moduleId)
  { key: "historico-precios", label: "Histórico de precios", defaultAllowed: true },
  { key: "papelera", label: "Papelera", defaultAllowed: true },
  { key: "backups", label: "Copias de seguridad", defaultAllowed: true },
  { key: "sprint", label: "Sprint", defaultAllowed: true },
];

export const SECTION_KEYS = new Set(SECTION_REGISTRY.map((s) => s.key));
export const ROLE_ACCESS_ROLES = ["USER", "VIEWER"] as const;
export function findSection(key: string) { return SECTION_REGISTRY.find((s) => s.key === key); }
```

### `role-access.service.ts`

```ts
@Injectable()
export class RoleAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modulesService: ModulesService,
  ) {}

  // Mapa plano { 'recipes': true, 'recipes.cost': false, ... } para un rol.
  async getRoleSectionMap(tenantId: string, role: "USER" | "VIEWER"): Promise<Record<string, boolean>> {
    const rows = await this.prisma.configuration.findMany({
      where: { tenantId, key: { startsWith: `roleAccess.${role}.` } },
    });
    const explicit = new Map<string, boolean>();
    for (const r of rows) explicit.set(r.key.replace(`roleAccess.${role}.`, ""), r.value === "true");

    const moduleStates = await this.modulesService.getModules(tenantId); // reuse
    const enabledModules = new Set(moduleStates.filter((m) => m.enabled).map((m) => m.id));

    const map: Record<string, boolean> = {};
    for (const s of SECTION_REGISTRY) {
      if (s.moduleId && !enabledModules.has(s.moduleId)) { map[s.key] = false; continue; }
      map[s.key] = explicit.has(s.key) ? explicit.get(s.key)! : s.defaultAllowed;
    }
    return map;
  }

  async isSectionAllowed(tenantId: string, role: string, key: string): Promise<boolean> {
    if (["SUPERADMIN", "OWNER", "ADMIN"].includes(role)) return true;
    if (role !== "USER" && role !== "VIEWER") return false;
    const map = await this.getRoleSectionMap(tenantId, role);
    return map[key] ?? true;
  }

  // Para la pantalla de config: ambas columnas + qué secciones listar (solo módulos activos).
  async getRoleAccessConfig(tenantId: string) {
    return {
      sections: /* SECTION_REGISTRY filtrado por módulos activos, con label/parent */,
      USER: await this.getRoleSectionMap(tenantId, "USER"),
      VIEWER: await this.getRoleSectionMap(tenantId, "VIEWER"),
    };
  }

  async updateRoleAccess(tenantId: string, userId: string, dto: UpdateRoleAccessDto) {
    // dto: { USER?: Record<string,boolean>, VIEWER?: Record<string,boolean> }
    // validar keys ∈ SECTION_KEYS; rechazar roles fuera de USER/VIEWER
    // upsert Configuration por cada (role, key) con category "ROLE_ACCESS", updatedBy: userId
    // KISS: escribir SIEMPRE el valor (true y false), así el estado es explícito y legible
  }
}
```

- `RoleAccessModule` importa `ModulesModule` (o `ModulesService` via `forwardRef` si hay ciclo — comprobar) y `PrismaModule`. Exporta `RoleAccessService`.
- Request-scoped cache: envolver `getRoleSectionMap` con un `Map` en `AsyncLocalStorage` o simplemente memoizar en el guard por `(tenantId, role)` durante el request (el guard es el único consumidor caliente).

### `SectionAccessGuard` — `backend/src/guards/section-access.guard.ts`

Espejo de `module.guard.ts`:

```ts
export const SECTION_METADATA_KEY = "section";
export const RequireSection = (...keys: string[]) => SetMetadata(SECTION_METADATA_KEY, keys);

@Injectable()
export class SectionAccessGuard implements CanActivate {
  constructor(private reflector: Reflector, private roleAccess: RoleAccessService) {}
  async canActivate(ctx: ExecutionContext) {
    const keys = this.reflector.getAllAndOverride<string[]>(SECTION_METADATA_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!keys?.length) return true;
    const req = ctx.switchToHttp().getRequest();
    const role = req.user?.role;
    if (["SUPERADMIN", "OWNER", "ADMIN"].includes(role)) return true;
    const tenantId = req.tenantId ?? req.user?.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant context is required");
    for (const k of keys) {
      if (await this.roleAccess.isSectionAllowed(tenantId, role, k)) return true;
    }
    throw new ForbiddenException({ error: "SECTION_HIDDEN", section: keys[0] });
  }
}
```

- Registrar `SectionAccessGuard` en `guards.module.ts` y hacerlo disponible (necesita `RoleAccessModule` importado donde se use; el patrón actual añade el guard a `@UseGuards(...)` de cada controller).

**Regla clase + método** (necesaria para los overrides de Phase 2): el guard lee metadata de `ctx.getClass()` y `ctx.getHandler()` **por separado**. Acceso permitido si: `(sin classKeys O alguna classKey permitida)` **Y** `(sin methodKeys O alguna methodKey permitida)`. Así `@RequireSection("recipes.cost")` en un método sigue exigiendo `recipes` (key de clase) además de `recipes.cost`.

### Cableado en controllers (orden: `AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard`)

Añadir `@UseGuards(..., SectionAccessGuard)` + `@RequireSection("<key>")` a nivel de clase en:

| Controller | `@RequireSection` |
|---|---|
| `recipes.controller.ts` | `"recipes"` |
| `production.controller.ts` | `"production"` (métodos de tareas se ajustan en Phase 2) |
| `almacenes.controller.ts` | `"almacenes"` |
| `products.controller.ts` (clase) | `@RequireSection("articulos","proveedores")` — **decisión validación #1: Proveedores es casilla propia independiente**. No hay controller de proveedores separado (verificado, viven aquí). Clase con OR para que pase quien vea *cualquiera* de los dos. |
| `products.controller.ts` rutas `suppliers*` (`@Get/@Post/@Put/@Delete "suppliers"`, ~L155-565) | override método `@RequireSection("proveedores")` |
| `products.controller.ts` resto de rutas (artículos, ofertas, historial precio, merge…) | override método `@RequireSection("articulos")` (o dejar que herede si se ajusta la regla; **explícito es más seguro**) |
| `compras.controller.ts` | `"compras"` |
| `albaranes.controller.ts` | `"albaranes"` |
| `trash.controller.ts` | `"papelera"` (**verificado**: `backend/src/modules/trash/trash.controller.ts`) |
| `menus.controller.ts` | `"menus"` |
| `escandallos.controller.ts` | `"escandallos"` |
| `appcc.controller.ts` | `"appcc"` |
| `allergens.controller.ts` | `"allergens"` |
| `digital-menu.controller.ts` | `"digital-menu"` |
| `conocimiento.controller.ts` | `"conocimiento"` |
| `technical-sheets.controller.ts` | `["technical-sheets","recipes"]` (carve-out ficha/recipe-card, detalle en Phase 2) |
| `sala-tasks.controller.ts` | `"sala-notificaciones"` |
| `users.controller.ts` | `"sala"` (apartado "Equipo") — **verificado seguro**: solo tiene `GET` lista/`:id` (USER/VIEWER) y mutaciones `@Roles("ADMIN")`; no hay `/users/me`; `settings/page.tsx` NO llama a `/users` (usa `useAuth`). Gatear la clase solo afecta a la página de equipo. |
| `ai-assistant.controller.ts` | `"asistente-ia"` |
| `backup/backup.controller.ts` (tenant, NO `superadmin-backup.controller.ts`) | `"backups"` (**verificado**) |
| `sprint/sprint.controller.ts` | `"sprint"` (**verificado**) |

**Excluir del gating** (transversales que deben seguir siempre): `auth`, `dashboard` (kpis — se sanea en Phase 2, no se bloquea), `modules` (GET), `role-access`, `categories` (se usa embebido en muchos formularios — **no** poner guard).

**`historico-precios`**: es una ruta de frontend; su data sale de endpoints de `products`/offers (ya gateados por `"articulos"`). No hay controller propio. Gating = solo nav + redirección de ruta (Phase 3). Si el USER tiene `articulos` oculto, la página ya falla sus fetch. Aceptable.

**`sprint`**: revisar `sprint` module/controller; gate con `@RequireSection("sprint")` si existe controller, si no solo nav.

**`backups`**: gate el/los controller(s) de backup de tenant con `@RequireSection("backups")` (no el de superadmin).

## Related Code Files

- Create: `backend/src/modules/role-access/**` (7 ficheros)
- Create: `backend/src/guards/section-access.guard.ts` + `.spec.ts`
- Modify: `backend/src/guards/guards.module.ts` (registrar guard)
- Modify: `backend/src/app.module.ts` (importar `RoleAccessModule`)
- Modify: ~18 `*.controller.ts` (añadir `@UseGuards`+`@RequireSection` a nivel clase)
- Reference: `backend/src/guards/module.guard.ts`, `backend/src/modules/modules/modules.service.ts:24-125`, `backend/prisma/schema.prisma:1426` (`Configuration`)

## Implementation Steps

1. Crear `section-registry.ts` con todas las secciones (derivar label/moduleId de `MODULE_REGISTRY` donde aplique).
2. Crear `RoleAccessService` + spec (casos: sin config ⇒ todo true; `false` explícito; ADMIN bypass; módulo desactivado ⇒ sección false; sub-key hereda default true).
3. Crear `SectionAccessGuard` + spec (metadata ausente ⇒ allow; ADMIN ⇒ allow; USER sin acceso ⇒ 403 SECTION_HIDDEN; `@RequireSection` con varias keys ⇒ OR).
4. Crear `RoleAccessController` (`GET /`, `PUT /` `@Roles("ADMIN")`, `GET /me`) + spec; DTO con validación de keys.
5. Crear `RoleAccessModule`, importarlo en `AppModule`; resolver ciclo con `ModulesModule` si aparece.
6. Cablear `@UseGuards`+`@RequireSection` clase por clase en los controllers de la tabla. Ejecutar el spec de cada controller tras tocarlo.
7. `bun test` backend completo; arreglar specs que asuman ausencia del guard (inyectar `RoleAccessService` mock que devuelva `true`).

## Success Criteria

- [ ] `GET /api/v1/role-access` (como ADMIN) devuelve `sections`, `USER`, `VIEWER` con todo a `true` en un tenant sin config.
- [ ] `PUT /api/v1/role-access {USER:{"recipes.cost":false}}` como USER ⇒ 403; como ADMIN ⇒ 200 y persiste `Configuration` `roleAccess.USER.recipes.cost = "false"`.
- [ ] `GET /api/v1/role-access/me` como USER refleja el mapa efectivo.
- [ ] Un USER con `roleAccess.USER.almacenes=false` recibe 403 `SECTION_HIDDEN` en `GET /api/v1/almacenes`; un ADMIN del mismo tenant, 200.
- [ ] Tenant sin config: toda la suite de specs de controllers sigue verde; ningún endpoint cambia de respuesta.
- [ ] `bun test` backend verde; `bunx tsc --noEmit` backend verde.

## Risk Assessment

- **Ciclo de módulos** `RoleAccessModule` ↔ `ModulesModule`: si `GuardsModule` ya importa cosas, usar `forwardRef` o mover `isModuleEnabled` a un servicio compartido ligero.
- **Specs existentes rotos** por el guard nuevo: mitigar con provider mock por defecto en los `Test.createTestingModule` afectados.
- **`categories` / `users/me`**: gatear de más puede romper formularios. Revisar consumidores antes de poner `@RequireSection` en `categories.controller.ts` y en rutas `users` self-service.

<!-- Updated: Validation Session 1 (2026-08-30) — decisiones: Proveedores casilla propia, Escandallos casilla propia, clic tarea no navega, tareas solo ver+completar, VIEWER siempre RO, transversales incluidos, efecto en recarga. Ver plan.md ## Validation Log. -->
