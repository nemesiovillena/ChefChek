# Permisos por rol (USER/VIEWER): guard semantics bug + cost-leak surfaces caught in review

**Date**: 2026-08-30 20:30
**Severity**: High (1 critical + 3 high findings in code review, all fixed pre-merge)
**Component**: New `role-access` module (backend), `SectionAccessGuard`, ~19 controllers, frontend nav/dashboard/recipes/settings
**Status**: Shipped to PR #66 (`feat/sala-notificaciones-kanban` → `develop`)

## What Happened

Full implementation, via `/ck:scout` → `/ck:plan` (validated) → `/ck:cook`, of a per-role, per-tenant **section visibility** layer on top of the existing per-tenant module system. OWNER/ADMIN configures in **Configuración → "Permisos por rol"** which sections USER and VIEWER see. The driving use case: a front-of-house ("sala") user who can only view+print recipes (no cost), complete prep tasks from the dashboard without seeing Producción, use Notificaciones de Sala and the AI assistant (no cost data), and nothing else.

**Delivery facts:**
- New `backend/src/modules/role-access/`: `SECTION_REGISTRY` (24 sections), `RoleAccessService` over the `Configuration` key/value table (`roleAccess.{ROLE}.{key}`, mirrors how modules are stored), `GET` / `GET /me` / `PUT` endpoints.
- `SectionAccessGuard` + `@RequireSection(...)` wired into ~19 controllers. Proveedores gated independently of Artículos via per-method decorators on `products.controller.ts`.
- Fine-grained cost gating: recipe cost endpoint + list/detail payloads, recipe edit, technical-sheet generation (recipe-card always allowed), production task completion, dashboard KPIs stripped of €, price alerts filtered from `/v1/alerts` + WebSocket, AI assistant filtered of its 6 cost tools + a system-prompt notice.
- Frontend: `useSectionAccess()` (module-level shared store via `useSyncExternalStore`), nav filtering + URL redirect, dashboard cards, `recipes/page.tsx` sub-capability flags, a new "Permisos por rol" matrix in settings.
- **Zero-regression invariant**: with no config saved, USER/VIEWER behave exactly as before. Default = allowed; the feature only ever subtracts.
- Backend: **113 suites / 1754 tests** green (+26 new). tsc + build + eslint clean.
- `docs/authorization-model.md` (new "Acceso por Sección" section), `docs/codebase-summary.md`.

## The Brutal Truth

The plan was validated, the phases went green one by one, all gates passed — and then the multi-agent `code-reviewer` found that **the feature's headline use case was broken by a guard-semantics bug I introduced deliberately.**

In Phase 1 I made `SectionAccessGuard` evaluate class-level and method-level `@RequireSection` metadata *separately*, combined with **AND** — so `@RequireSection("recipes.cost")` on a handler of a `@RequireSection("recipes")` controller still requires `recipes` too. That is correct and necessary for the recipe sub-flags.

But I then applied the same decorator to `PUT /production/orders/:id/complete` as `@RequireSection("production", "production.tasks")`, expecting OR. With the class also carrying `@RequireSection("production")`, the sala role (`production=false`, `production.tasks=true`) got:
- class check: `production` → **false**
- method check: `production` OR `production.tasks` → true
- `classOk && handlerOk` → **false → 403**

The dashboard "Completar" button hits exactly this endpoint. So the restricted role could *see* the prep-task board but **could not complete a single task** — the entire reason the `production.tasks` sub-capability exists. And every failed click fired the `chefchek:section-hidden` event, triggering a nav refetch.

Two more findings that also contradicted the acceptance criteria:
- **H1**: `GET /recipes` and `GET /recipes/:id` returned full cost/PVP/margin data in the JSON even for a role without `recipes.cost`. I had gated `/recipes/:id/calculate` and hidden the UI column — but the list payload itself still shipped every € figure across the trust boundary. The plan *explicitly* said "enumera cada superficie de € y córtala en backend, no solo en UI." I cut one and missed two.
- **H2**: `/v1/alerts` and the WebSocket feed pushed "Precio subió 15% de 1.00€ a 1.50€" to any role.

## Technical Details

**C1 fix — a second decorator instead of bending the guard.**

Rather than weaken the class-AND-method rule (which the recipe sub-flags depend on), I added `@RequireSectionAny(...)` — handler-only metadata that *replaces* the class gate entirely (OR within its keys):

```ts
// guard: check the override first
const anyKeys = this.reflector.get<string[]>(SECTION_ANY_METADATA_KEY, ctx.getHandler()) ?? [];
if (anyKeys.length > 0) {
  if (await anyAllowed(anyKeys)) return true;
  throw new ForbiddenException({ error: "SECTION_HIDDEN", section: anyKeys[0], ... });
}
// otherwise: (classKeys OR) AND (handlerKeys OR)
```

```ts
@Put("orders/:orderId/complete")
@Roles("ADMIN", "USER")
@RequireSectionAny("production", "production.tasks")  // reachable with either
async complete(...) { ... }
```

**H1 fix — strip at the formatter.**

`formatRecipeResponse(recipe, includeCost = true)`; when `false` it returns the recipe with `totalCost: 0`, `sellingPrice: null`, `costBreakdown`/`pricing` omitted, and every ingredient/sub-recipe cost zeroed. `RecipesController` now injects `RoleAccessService` and resolves `recipes.cost` per request for `findAll`/`findOne`.

**H2 fix — semantic alert type + role-filtered reads + client-side WS filter.**

`notifyPriceChange` now stores `type: "PRICE_CHANGE"` (was the severity string). `getUserNotifications(..., excludeCostAlerts)` filters `PRICE_CHANGE` / `PRICE_AGREEMENT_DEVIATION` plus title prefixes (for historical rows). `AlertsController` passes the flag by role. `use-websocket.ts` drops live events whose title starts with the price-alert prefixes when `!canSee('recipes.cost')` — the REST hydration (source of truth on reload) is the properly-sanitized path.

**Also fixed in the same round:**
- **M1**: the module-level section-access cache never reset on logout/login — `layout.tsx` now calls `refetchSections()` in the `isAuthenticated` effect.
- **M2**: `refetchSectionAccess()` nulled the cache → flash of the full (unrestricted) nav. Now keeps the stale map until the new fetch resolves.
- **M3**: `SECTION_HIDDEN` was detected on the frontend by `message.startsWith("Section '")` — brittle against any reword/i18n. `GlobalExceptionFilter.getErrorCode` now preserves a caller-supplied string `error` field as the response `code`; the frontend matches `code === 'SECTION_HIDDEN'`.
- **L2**: the settings panel POSTed all ~50 keys on every save (and turned "no rows" into "explicit true everywhere", plus wholesale clobber on concurrent edits). Now sends only the diff.

## Root Cause Analysis

**Why C1?** I designed the class-AND-method rule for one shape (recipe sub-flags: need *both* parent and child) and then reused the same decorator for the opposite shape (production tasks: need *either*, ignoring the parent). The decorator name `@RequireSection` implied a single consistent semantics; there wasn't one. The Phase 2 plan file even *described* this exact scenario correctly ("`complete` → override to allow `production.tasks`") — I implemented it with the wrong primitive.

**Why H1?** Tunnel vision on the obvious cost endpoint (`/calculate`) and the obvious UI surface (the table column). The recipe *list* returning cost is non-obvious because the frontend never displays it there for a restricted role — the leak is invisible unless you read the raw JSON. Classic "hide in UI ≠ remove from payload."

**Why did review catch it and the gates didn't?** Unit tests mock `RoleAccessService`, so the guard's real class+method interaction was only tested in the guard's own spec — with contrived metadata, never the actual production controller wiring. The reviewer traced the concrete decorator stack on `ProductionController` and computed the boolean by hand. Same for H1: the reviewer read `formatRecipeResponse`'s return object field by field.

## Lessons Learned

1. **A decorator with two different combination semantics needs two decorators.** `@RequireSection` (AND with class) and `@RequireSectionAny` (replace class) — naming makes the intent legible at the call site.
2. **"Gated the endpoint" is not "gated the data."** For a confidentiality requirement, enumerate every response that carries the field, not every route that computes it. A `JSON.stringify(result)` regex assertion for `€` / blacklisted keys in the "no access" test is cheap insurance (added for recipes).
3. **Module-level stores need explicit lifecycle wiring.** `useSyncExternalStore` gave every consumer the same map without a provider — but "same map" also means "survives logout." Reset on auth change, don't null-then-refetch.
4. **The plan predicted the bug and I still shipped it.** The Phase 2 file said what `complete` needed. Re-reading the phase file against the actual diff before the review would have caught C1.

## Next Steps

- Committed `c234f08`, pushed, **PR #66** → `develop` (81 files, +3495/−187). CI will run.
- **No live browser verification** — could not stand up the worktree's backend + DB locally. Manual QA checklist is in `plans/260830-0113-permisos-por-rol-user-viewer/phase-05-*.md`; the PR reviewer or a follow-up session should run it.
- Deferred (documented in `plan.md` Validation Log, none blocking): M4 request-scoped map cache, L1 sub-keys not inheriting a disabled parent module, L3 `categories` intentionally outside the registry, L4 dead `dashboard-interactivo` endpoints, L5 cosmetic client gate.
- The branch is shared with another session's in-flight "asistente: consulta de lotes" work (uncommitted in the working tree). If that pushes before #66 merges, the PR grows.
