## Code Review Summary

### Scope
- Files reviewed (diff vs working tree HEAD): `backend/prisma/schema.prisma` + migration `20260709141644_add_product_manual_purchase_date`, `backend/src/modules/products/dto/create-product.dto.ts`, `backend/src/modules/products/products.controller.ts`, `backend/src/modules/products/products.service.ts`, `frontend/src/hooks/use-products.ts`, `frontend/src/app/dashboard/articulos/page.tsx`
- LOC: ~151 insertions / 31 deletions across 6 files (feature-relevant subset; see scope note below)
- Focus: uncommitted diff for inline "Última Compra" edit feature
- Scout findings: see Critical section — one high-frequency phantom-write bug found via close reading of `startEditDate`/`commitDate`; one plausible-looking "double commit via blur-on-unmount" theory investigated and ruled out (verified against React's actual synthetic-event behavior, not just theory)

### Overall Assessment
Backend precedence logic (`resolveLastPurchase`, `findAll`/`findOne`/`update`) is correct, DRY, tenant-scoped, and additive at the schema level — no issues found there. The frontend inline-edit cell has one real, high-likelihood data-integrity bug: the "did the user change anything" check in `commitDate` uses a different baseline than the value `startEditDate` used to prefill the input, so opening the cell and clicking away without typing anything silently writes a phantom `manualPurchaseDate` for any product whose displayed date currently comes from an albarán (the common case). This was not caught by the prior manual testing because that testing exercised "type a new date" and "Escape cancels" but not "open then blur/Enter with zero changes." Additionally, the diff for `products.controller.ts`, `frontend/src/hooks/use-products.ts`, and `articulo-modal.tsx` contains material unrelated to this feature (bundled from other in-progress, uncommitted work already in the tree) — none of it breaks this feature, but it should not be committed together with it.

### Critical Issues

**1. Phantom `manualPurchaseDate` write on no-op interaction (data integrity)**
`frontend/src/app/dashboard/articulos/page.tsx:376-390`
```ts
const startEditDate = (product: Product) => {
  setEditingDateId(product.id);
  setDateDraft(toDateInputValue(product.manualPurchaseDate ?? product.lastPurchaseDate)); // prefill baseline: manualPurchaseDate ?? lastPurchaseDate
};

const commitDate = async (product: Product) => {
  const next = dateDraft || null;
  const current = toDateInputValue(product.manualPurchaseDate); // comparison baseline: manualPurchaseDate ONLY
  setEditingDateId(null);
  if ((next ?? '') === current) return;
  ...
  await updateProductMutation.mutateAsync({ id: product.id, manualPurchaseDate: next });
```
The prefill uses `manualPurchaseDate ?? lastPurchaseDate` (the displayed/effective value), but the "no-op" guard compares against `manualPurchaseDate` alone (the raw persisted value, `??` does not fall back based on magnitude). For **any product with an albarán-derived date and no existing manual override** (`manualPurchaseDate === null`, `lastPurchaseDate` = albarán date):
- `startEditDate` prefills the input with the albarán date.
- User clicks the cell, then clicks elsewhere (or presses Enter) without changing anything.
- `next` = albarán-date-string, `current` = `''` (since `manualPurchaseDate` is null) → mismatch → `commitDate` fires a PATCH that sets `manualPurchaseDate` to a frozen copy of the current albarán date.

Immediate visible effect is none — `resolveLastPurchase` breaks ties in favor of the albarán (`albaranDate >= manualDate`), so the cell still shows the same date/source right after. The bug is **latent**: the DB now silently carries a stale `manualPurchaseDate`. If a later albarán arrives with an *older* date than the frozen one (data correction, reprocessed albarán, etc.), that stale value will incorrectly start winning and displaying with a "manual" (✎) badge, with no user action that explains why. Because the trigger condition (open cell, click away) is something almost every user will do accidentally while browsing the list, this is likely to affect a large fraction of rows in production, not an edge case.

Fix: use the same baseline for both prefill and no-op comparison, e.g. capture the prefilled draft once (state or ref) at edit-start and compare `next` against that captured value in `commitDate`, instead of recomputing `current` from `product.manualPurchaseDate`.

### High Priority
None beyond the Critical item above.

### Medium Priority

**2. Scope creep bundled into `products.controller.ts`, unrelated to this feature**
`backend/src/modules/products/products.controller.ts:43-46` adds `ModuleGuard`/`@RequireModule("articulos")` — an authorization-relevant change affecting every `/api/v1/products` endpoint. This is not part of the "última compra" plan (confirmed via `git status`: the same `ModuleGuard` pattern is being added across ~15 other controllers simultaneously, i.e. it's a separate in-progress feature-gating initiative sharing the dirty working tree). Not a bug in this feature, but: (a) it should not be committed in the same commit as the date-edit feature, and (b) since it touches authz for the whole controller, it deserves its own dedicated review/testing pass (verify `ModuleGuard` correctly resolves `"articulos"` for existing tenants, or every product list/PATCH call — including this new inline-edit PATCH — will start failing with 403 for tenants missing that module).

**3. Unrelated bug fix bundled into `products.service.ts`**
`backend/src/modules/products/products.service.ts:343-349` — moving `delete data.unitSize` into an `else` branch (only deleting it when the format wasn't changed) is a real, correct fix for the previously-known bug (module memory: `unitSize` was never persisted on update because it was deleted unconditionally right after being set). It's good, but it is explicitly out of scope for this task per `plan.md`'s "Fuera de alcance: ... refactors no relacionados". It doesn't interact with the new date logic (the date-only PATCH payload takes the `else` branch either way, consistent before/after), so it's not a functional risk to this feature, but it should be split into its own commit so the "última compra" history stays reviewable and revertible independently.

### Low Priority

**4. Redundant `@ValidateIf` decorator (dead code)**
`backend/src/modules/products/dto/create-product.dto.ts:277-280`
```ts
@IsOptional()
@ValidateIf((o) => o.manualPurchaseDate !== null)
@IsDateString()
manualPurchaseDate?: string | null;
```
`@IsOptional()` alone already skips all subsequent validators when the value is `null` or `undefined` (confirmed in `class-validator`'s `IsOptional.js`: constraint returns `false`, i.e. "skip", for both `null` and `undefined`). The `@ValidateIf` condition (`!== null`) is a strict subset of what `@IsOptional()` already covers, so it never changes behavior — it's dead code. Not a bug, just unnecessary complexity (YAGNI). Safe to remove, or keep if the author considers it self-documenting; not blocking.

**5. Timezone display drift between prefill and read-only badge (documented/accepted risk)**
`toDateInputValue` (`page.tsx:373`) extracts the date via `.toISOString().slice(0,10)` (UTC digits), while `formatLastPurchaseDate` (`page.tsx:367`) renders via `.toLocaleDateString('es-ES', …)` (local timezone). For users in a negative UTC-offset timezone, a date stored as UTC midnight can display as the previous day in the read-only badge but the following day in the edit input, or vice versa. This is the same known risk already called out and accepted in `plan.md` ("Desfase de zona horaria... Documentar"), consistent with how albarán dates are already handled elsewhere. No action required unless the product needs to support users outside CET/CEST.

**6. Generic error message on PATCH failure**
`page.tsx:388-389` — `error instanceof Error ? error.message : '...'` surfaces axios's generic message (e.g. "Request failed with status code 400") rather than the server's specific validation message (`error.response?.data?.message`). Low-impact since the frontend always sends a well-formed `YYYY-MM-DD` or `null`, making a 400 from this particular call unlikely in practice; still, minor UX inconsistency versus other parts of the app that surface server messages.

**7. Extra `albaranLines` sub-query added to every `update()` call**
`products.service.ts:427-431` — the `update()` mutation's Prisma `include` now always fetches `albaranLines` (single extra indexed query) to compute `lastPurchaseDate`/`purchaseDateSource` for the response, even for edits unrelated to the date (e.g. renaming a product). Acceptable overhead (one extra cheap query, not a loop/N+1), just noting it broadens the "hot path" cost of the existing single-product PATCH endpoint.

### Edge Cases Found by Scout
- Confirmed (Critical #1): no-op open+blur/Enter on an albarán-sourced row writes a phantom `manualPurchaseDate`.
- Investigated and **ruled out**: theorized "Enter triggers `setEditingDateId(null)` → input unmounts → cascading native blur → `onBlur` re-invokes `commitDate` → duplicate PATCH." Verified against React's actual synthetic-event behavior (React does not fire `onBlur` when it is the one unmounting the focused element within the same handler — confirmed via multiple `facebook/react` issue threads) and against this task's own manual test result (Escape verified via API to not fire a PATCH, which relies on the same mechanism). Not a real bug in this codebase's React version; documented in agent memory so it isn't re-flagged without cause.
- Verified tie-break semantics: `resolveLastPurchase`'s `albaranDate >= manualDate` correctly favors the albarán on an exact date tie, matching acceptance criteria.
- Verified tenant scoping unchanged in `findOne`/`update` (`where: { id, tenantId: requestTenantId }` untouched by the diff).
- Verified `resolveLastPurchase` is the sole implementation used in `findAll`, `findOne`, and `update` — no hand-rolled duplicate logic (DRY criterion satisfied).
- Verified DTO type/frontend type parity (`purchaseDateSource: 'albaran' | 'manual' | null`, `manualPurchaseDate?: string | null` match on both sides).
- Verified `useUpdate()`'s generic mutation sends only the fields passed (`{ id, manualPurchaseDate }`, no accidental merge/overwrite of other product fields) and invalidates `['products']` + `['products', id]` on success — confirms the plan's stated cache-invalidation flow.
- Verified export CSV / column sort (`sortedProducts`, `getExportData`) both read the same recalculated `lastPurchaseDate` field, unmodified logic — criterion 4 holds.
- Confirmed `articulo-modal.tsx`'s diff contains zero `manualPurchaseDate`/`lastPurchaseDate` references — this feature itself did not touch the modal (criterion 5 holds), even though the file has unrelated diff noise from other pending work.

### Positive Observations
- Migration is minimal, additive, nullable, no default — zero data-loss risk, matches the zero-data-loss project rule.
- Backend precedence helper (`resolveLastPurchase`) is a small, well-anchored domain function reused consistently in all three call sites — no duplication, no unnecessary abstraction.

### Recommended Actions
1. **Blocking**: Fix the `startEditDate`/`commitDate` baseline mismatch (Critical #1) before merging — this is the one item that will silently corrupt provenance data (`manualPurchaseDate`) for a large share of normal usage.
2. Split the commit: keep only the manualPurchaseDate feature files/hunks in this commit; move the `ModuleGuard` controller change and the `unitSize` else-branch fix to their own commits (they're unrelated, already-working, but should not ship attached to this feature's history).
3. Optional cleanup: drop the redundant `@ValidateIf` on `manualPurchaseDate` in the DTO.
4. Optional polish: surface `error.response?.data?.message` in the PATCH failure toast for consistency with other error paths in the app.

### Metrics
- Type Coverage: not separately measured (build reported clean per task context, not re-run here)
- Test Coverage: no automated tests added for this feature (manual/API/browser testing only, per task context)
- Linting Issues: 0 new (per task context; not re-run in this review)

### Unresolved Questions
- Should `ModuleGuard`/`@RequireModule("articulos")` on `products.controller.ts` be committed alongside this feature, or is it confirmed to belong to a separate, already-tested initiative? It changes authorization for every product endpoint including the new inline-edit PATCH, so it needs its own review pass regardless of commit grouping.
