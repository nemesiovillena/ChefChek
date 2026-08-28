# Code Review: Notificaciones de Sala (CRUD + Kanban)

## Score: 6.5/10

Backend is solid (tenant scoping, soft-delete, reorder transaction, number coercion all correct and test-covered). Frontend has one real functional bug in the Kanban drag logic and one real staleness bug in the shared modal. Neither is a security/data-loss issue but both break stated acceptance criteria as currently written. Lint claim from the prior tester is not accurate (one real eslint error found).

## Scope Reviewed

- Backend: `backend/prisma/schema.prisma`, migration `20260828234752_add_sala_task`, `backend/src/modules/sala-tasks/**`, `backend/src/app.module.ts`, `backend/src/modules/modules/constants/registry.ts`
- Frontend: `frontend/src/hooks/use-sala-tasks.ts`, `frontend/src/app/dashboard/page.tsx`, `frontend/src/app/dashboard/sala-task-row.tsx`, `frontend/src/app/dashboard/sala-notificaciones/**`, `frontend/src/components/sala-tasks/sala-task-modal.tsx`, `frontend/src/features/modules/lib/nav-config.ts`
- Cross-checked against `production.controller/service.ts`, `costing-config.controller.ts`, `albaranes/dto/update-albaran.dto.ts`, `use-dashboard-kpis.ts`, `upcoming-task-row.tsx`, `production/tasks/page.tsx`.

## Critical Issues

None. No tenant-isolation break, no soft-delete violation, no data exposure beyond what the plan's own decisions (PII fields, module-gated) already accept.

## High Priority

### 1. Kanban drag optimistic update writes stale `sortOrder`, causing visible snap-back / potential order-clobbering race
`frontend/src/app/dashboard/sala-notificaciones/page.tsx`, `handleDragEnd` (~lines 84-121).

The function correctly computes the right `sortOrder` for **every** affected item in both source and destination columns for the network payload:
```ts
const items = flat
  .filter((t) => affectedStatuses.has(t.status))
  .map((t) => ({
    id: t.id,
    status: t.status,
    sortOrder: next[t.status].findIndex((x) => x.id === t.id),
  }));
reorderTasks.mutate(items);
```
But it never writes that recomputed `sortOrder` back onto the task objects before caching them:
```ts
const flat = COLUMNS.flatMap((c) => next[c.status]);
queryClient.setQueryData(['sala-tasks'], flat);
```
`flat` still carries each task's **original** `sortOrder` field (only `.status` was mutated for the cross-column case, via `{...moved, status: destStatus}`). On the next render, `groupByStatus()` re-sorts every column by `t.sortOrder`:
```ts
grouped[status].sort((a, b) => a.sortOrder - b.sortOrder);
```
Since that field was never updated, the just-dropped position is discarded immediately and the column visually reverts to the pre-drag order (status changes survive, because grouping is by `.status`, not order — so cross-column moves look "right" in terms of which column, but the position within it is unreliable). The screen only shows the correct order once `useReorderSalaTasks`'s `onSuccess` invalidates `['sala-tasks']` and the refetch completes.

Impact:
- Visible flicker/snap-back on every drag, worse on slower networks — the acceptance criteria "Drag dentro de una columna reordena y persiste" / "Drag entre columnas cambia status y persiste" are only true after a full round-trip, not optimistically as the pattern in the rest of the codebase implies (compare `useReorderProductionTasks`, whose caller keeps working from the already-correct optimistic list).
- If a user performs a second drag before the first mutation's invalidate/refetch resolves, the second drag operates on the already-desynced (re-sorted-by-stale-value) list. Its recomputed indices are then sent to the backend and can silently overwrite the first drag's correct persisted order with the visually-wrong one — a real (if narrow) data-integrity risk, not just cosmetic.

Fix: when building `next`, write the corrected index onto each item's own `sortOrder` before flattening, e.g.
```ts
next[sourceStatus] = next[sourceStatus].map((t, i) => ({ ...t, sortOrder: i }));
next[destStatus] = next[destStatus].map((t, i) => ({ ...t, sortOrder: i }));
```
before computing `flat`, then reuse those already-correct values for the mutation payload instead of recomputing via `findIndex`.

## Medium Priority

### 2. `SalaTaskModal` doesn't reset its form when reopened for the *same* task after Cancel
`frontend/src/components/sala-tasks/sala-task-modal.tsx` (~lines 84-90).

```ts
const [openedForTaskId, setOpenedForTaskId] = useState<string | null | undefined>(task?.id);
if (open && openedForTaskId !== (task?.id ?? null)) {
  setOpenedForTaskId(task?.id ?? null);
  setForm(task ? taskToFormState(task) : emptyFormState());
}
```
This correctly handles "reopened for a **different** task" (mandate check #5) because the id comparison changes. But the guard is gated on `open` being `true`, so closing the modal (`open=false`, parent sets `task` back to `null`) never runs the branch and `openedForTaskId` is never cleared. Reopening the **same** task id afterwards (`openedForTaskId === task.id` again) skips the reset entirely, so the form still holds whatever the user typed and then discarded via "Cancelar." Concretely: open task A → edit a field → Cancel → reopen task A again (dashboard row or Kanban card) → sees the discarded edit, not the real persisted values. If the user then hits "Guardar" believing they're looking at current data, the discarded edit gets persisted.

Fix: reset `openedForTaskId` to `null` (or use `useEffect` keyed off `open` transitioning to `false`) on close, or simplest — key the modal by task id so React remounts it: `<SalaTaskModal key={task?.id ?? 'new'} ... />` in both call sites (`page.tsx` dashboard and `sala-notificaciones/page.tsx`).

### 3. Lint is not actually clean — contradicts prior tester's report
```
backend/src/modules/sala-tasks/sala-tasks.service.spec.ts
  58:31  error  Replace `·success:·true,·data:·{·id:·"t1",·sortOrder:·3·}` with ... prettier/prettier
```
Confirmed via `npx eslint src/modules/sala-tasks/**/*.ts` in `backend/`. One real `error`-level (not `warning`) violation in the new spec file. Frontend eslint targets (`page.tsx`, `sala-task-row.tsx`, `sala-notificaciones/*.tsx`, `sala-task-modal.tsx`, `use-sala-tasks.ts`, `nav-config.ts`) are clean, confirmed independently. `@typescript-eslint/no-explicit-any` warnings on `sala-tasks.controller.ts` (`req: any`) are pre-existing codebase convention (same as `production.controller.ts`, 32 occurrences), not a regression.

## Low Priority

- `sala-task-modal.tsx`: `payload.guestCount = form.guestCount || undefined` treats `0` as falsy — typing "0" comensales silently becomes "no comensales" on save. Use `form.guestCount === undefined || form.guestCount === null ? undefined : form.guestCount` or `?? undefined` won't fix it either since `0 ?? undefined` still yields `0` correctly — just avoid `||`.
- `sala-tasks.controller.ts` uses `req.user.id` (no optional chaining) vs. `req.user?.id` used throughout `production.controller.ts`. Not a functional bug (AuthGuard guarantees `req.user` before this runs) but an avoidable inconsistency.
- DTOs were consolidated into a single `dto/sala-task.dto.ts` instead of the three separate files (`create-sala-task.dto.ts`, `update-sala-task.dto.ts`, `reorder-sala-tasks.dto.ts`) that phase-01's "Related Code Files" section specifies. Not a defect — file is small (~120 lines) and this is arguably more YAGNI-aligned — but it is a deviation from the written plan worth a one-line note to whoever closes out the phase checklist.
- `backend/prisma/schema.prisma` diff includes large unrelated whitespace realignment (column padding) across `User`, `ProductionOrder`, `PurchaseOrder`, `PurchaseOrderLine`, `PurchaseList`, `AssistantConversation` — almost certainly from `prisma format` reflowing the whole file after the new model was added. Not a functional issue, but it makes the true diff harder to review; worth calling out in the PR description so reviewers don't chase phantom changes in unrelated models.
- `sala-tasks.service.spec.ts`'s `findOne` test only asserts the `NotFoundException` is thrown on a `null` mock return; unlike the `findAll` test it doesn't assert `findFirst` was called with `{ tenantId, deletedAt: null }` in the `where`. Weaker (not phantom, but under-specified) proof of tenant scoping for that one method — the actual service code is correct, this is a test-quality nit only.

## Verified Non-Issues (checked against the review's own risk list)

- **Tenant isolation** (`create`/`findAll`/`findOne`/`update`/`remove`/`reorder`): every method in `sala-tasks.service.ts` filters or asserts by `tenantId`, including `reorder`'s explicit `owned.length !== ids.length` check before the transaction. Matches `production.service.ts`'s `reorderProductionOrders` pattern exactly.
- **Soft-delete**: `remove()` calls `.update({ deletedAt: new Date() })`, never `.delete()`. Test-covered.
- **Number coercion**: `guestCount` and `sortOrder` use `@Type(() => Number)` + `@IsNumber()`, which works correctly because `main.ts`'s global `ValidationPipe` has `transform: true`. This is the *correct* direction for genuinely-numeric fields — different from (but not inconsistent with) the `numberAsString` trick in `update-albaran.dto.ts`, which exists only because those particular DTO fields are declared `@IsString()` by design (service does `parseFloat`). No bug here.
- **Module gating**: `useSalaTasks(salaNotificacionesEnabled)` passes `enabled` straight into React Query's `useQuery` options via `useApiQuery`, so the dashboard card genuinely skips the network call (not just a CSS hide) when the module is off for the tenant. Route-level gating via `ROUTE_MODULE_MAP` addition in `nav-config.ts` covers direct URL access to `/dashboard/sala-notificaciones`.
- **Drag drop-target resolution**: `SalaTaskColumn` registers `useDroppable({ id: status })`, and `handleDragEnd`'s `isStatus(over.id)` check correctly resolves both "drop on empty column" and "drop on a card" (via `findStatusOf`) cases. `reorder` route (`PATCH /reorder`) is declared before `PATCH /:id` in the controller, avoiding the classic NestJS route-shadowing gotcha.
- **Dashboard summary card scope reduction (no drag-and-drop)**: confirmed deliberate per the task brief — `SalaTaskRow` is click-only, comment explicitly states drag-and-drop only makes sense in the Kanban page where each column is its own priority queue. Reasoning holds; not flagged as unmet scope.
- **No RolesGuard on `SalaTasksController`**: any authenticated tenant user (including VIEWER) can create/edit/delete sala tasks (including customer PII: name/phone/email). This looks like a gap at first glance next to `production.controller.ts`/`costing-config.controller.ts` (both use `RolesGuard` + `@Roles`), but it is an exact match of the `albaranes.controller.ts` precedent the plan explicitly told the implementer to copy (`@UseGuards(AuthGuard, TenantGuard, ModuleGuard)`, no RolesGuard, no `@Roles` anywhere in that controller either). Not a regression introduced by this feature — flagging only as an FYI for the team's stated pattern is otherwise inconsistent, not asking to fix it here.
- **Backup/Papelera**: `SalaTask` was deliberately left out of the Papelera module per phase-03's explicit decision — verified no references to it in `backend/src/modules/trash/`. Backup coverage is not at risk either: `BackupIntrospectionService` discovers tables from `information_schema` at runtime and backs up anything not in `EXCLUDED_TABLES`, so `sala_tasks` is automatically included without needing a registry entry (the older "CHILD_SCOPE_RULES huérfanas" failure mode this project hit before does not apply to the current, schema-introspecting backup implementation).
- **Backwards compatibility**: purely additive changes to `app.module.ts`, `registry.ts`, `nav-config.ts`, `schema.prisma` (aside from the reformatting noise above). No existing exported type, DTO, or route signature was changed.
- **Dashboard regression check**: diffed `page.tsx` line-by-line; `tareasPendientesBoard`'s drag/complete/postpone logic is untouched other than the `DASHBOARD_TASKS_LIMIT` (6) → `PRODUCTION_TASKS_LIMIT` (4) rename, applied consistently at all 3 use sites. "Orden móvil" comment updated. No stray leftover references to the old constant name.
- **Dark-mode date input**: handled globally in `globals.css` (`.dark input[type='date'] { color-scheme: dark; }`), so the new modal's date input needs no per-component fix and is correctly covered.

## Metrics

- Backend `npx jest src/modules/sala-tasks`: 10/10 passing.
- Backend `npx eslint src/modules/sala-tasks/**/*.ts`: 1 error (prettier, spec file), 6 warnings (`no-explicit-any`, pre-existing codebase convention).
- Frontend `bunx eslint` on all 8 target files: 0 problems.
- `tsc --noEmit` (backend and frontend): no errors touching any sala-tasks/sala-notificaciones file.
- `npx prisma validate`: schema valid.

## Recommended Actions

1. Fix `handleDragEnd` in `sala-notificaciones/page.tsx` to write the corrected `sortOrder` onto the cached task objects, not just the mutation payload (High).
2. Fix `SalaTaskModal` to reset on close (or key by task id) so reopening the same task doesn't show a previously-cancelled draft (Medium).
3. Run `npx eslint --fix` (or reformat manually) on `sala-tasks.service.spec.ts` before merge — current lint is not clean as previously reported (Low, but blocking if the team's gate is "zero eslint errors").
4. Optional: fix the `guestCount === 0` falsy coercion in the modal's save payload (Low).

## Plan Follow-up

All three phases' functional success criteria are met with the two exceptions above (drag persistence UX correctness, modal same-task staleness). Recommend the lead mark phase 2 and phase 3 as "done with concerns" rather than fully done until issues #1 and #2 are addressed; phase 1 (backend) is clean and can be marked done as-is.

## Unresolved Questions

- Is the deliberate absence of `RolesGuard` on `sala-tasks` (matching `albaranes`) an accepted project-wide stance for this class of module, or should VIEWER-role write access to customer PII be revisited at some point? Not blocking this PR since it copies an existing precedent, but worth a product decision if it hasn't been made explicitly before.
