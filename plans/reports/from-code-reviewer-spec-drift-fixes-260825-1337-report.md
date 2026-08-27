# Code Review: Spec-Drift Fixes (4 test files, unstaged)

Reviewer: code-reviewer | Date: 2026-08-25 | Branch: `nemesiovillena/develop` (worktree)

## Scope

- `backend/src/modules/albaranes/services/albaran-stock.service.spec.ts` (+82)
- `backend/src/modules/dashboard/dashboard.service.spec.ts` (+3)
- `frontend/e2e/auth-reload.spec.ts` (+13/-4)
- `frontend/e2e/login-tenant-slug-sanitization.spec.ts` (+2/-2)
- LOC: 97 insertions, 9 deletions. Zero production code in diff (verified via `git diff`).
- Test suites not re-run per constraints (reported green by requester).

## Overall Assessment

Correct, minimal spec-drift repair. Every fixture/assertion change was verified against the cited production code and the cited commits (`e8e999d`, `507fedb`, `ae7ba7d` all confirmed to touch the cited files). The new `tracksInventory` regression test is mutation-strong, not assertion padding. One non-blocking gap: three stale `sessionStorage` comments now contradict the assertions they describe.

## Acceptance Criteria Verdicts

### 1. Fixtures/assertions match production behavior — PASS

- `albaran-stock.service.ts:246` — `if (!product.tracksInventory)` wraps the entire Lot/StockMovement/Stock block (lines 251-312); `upsertOffer` (line 142) runs before the gate unconditionally when `albaran.supplierId` is set. The 5 `tracksInventory: true` fixtures (spec lines 195, 503, 835, 843, 917) are exactly the tests whose assertions depend on the else-branch (`stock.create`/`stock.update`/`stockMovement.create` positive assertions at lines 258-259, 562-566). Without the flag those tests fail — so this was a required fix, not cosmetic.
- `dashboard.service.ts:176` — `this.prisma.purchaseSchedule.findMany(...)` confirmed; `[]` default flows safely through the `.map/.filter/.sort/[0] ?? null` chain (lines 186-199).
- `auth.service.ts:41,50-53,105-107` — login writes `tenant_slug`/`session_id`/`user`/`tenant_id` to localStorage; `getCurrentSession` reads localStorage. `seedSession` in auth-reload mirrors real post-login state exactly (including `tenant_id`, which only login writes — harmless, faithful).
- `dashboard/layout.tsx:129-155` — category buttons render per group; module links render only when `openGroup === group.title` (line 139, conditional rendering, not CSS). `nav-config.ts:37,40` — "Cocina" group contains `/dashboard/recipes`. Playwright config uses Desktop Chrome (1280x720) so the `hidden md:flex` desktop nav is visible; `getByRole("button", { name: "Cocina" })` resolves.
- **The previously-vacuous failed-login test is now genuine.** Production writes `tenant_slug` to localStorage *before* the POST (auth.service.ts:41) and removes it in the catch (line 60). The test (401 mock, filled slug) therefore proves the `removeItem` cleanup ran — if that line regresses, the test fails. Previously, reading sessionStorage made `toBeNull()` pass unconditionally. Playwright's per-test context isolation means the prior successful-login test cannot leak a `tenant_slug` into this test's localStorage.

### 2. New regression test genuinely covers the gate — PASS

Test at spec line 269. Verified mutation kill: the mock line carries `lot: "LOT-9"`, so if the gate at service line 246 is removed, execution reaches `lotService.createLotFromReception` (line 252), `stockMovement.create` (272), `stock.findFirst` (285), and `stock.create` (299) — four independent negative assertions (spec lines 332-335) fail. The test also asserts the offer path still runs (`upsertOffer` called once, line 329), matching the production ordering (offer at 142, gate at 246).

Fixture hygiene is good: product `supplierId` matches the albarán's (skips the unrelated supplier-inheritance update), `lineUnitPrice === currentPrice` (5) suppresses notification noise, and `productSupplierOffer.findFirst` resolves null (skips price-agreement path). The test isolates exactly the gate.

### 3. No production code, contracts, or unrelated tests touched — PASS

Diff is the 4 spec files only. Untracked items (`backend/test-results/`, `scripts/`) are not part of the diff; `scripts/` predates this change (present in branch status snapshot).

### 4. Style consistency — PASS

- Backend spec comments in Spanish, matching file convention (e.g., "Cargo de servicio: la línea cuenta en el albarán...").
- `purchaseSchedule: { findMany: jest.fn().mockResolvedValue([]) }` follows the existing `order.findMany` precedent in the same provider object (dashboard spec line 29); `afterEach(jest.clearAllMocks)` preserves the implementation across tests.
- `lotService` exposed as a module-level variable mirrors the existing `priceAgreementService` pattern (line 15).
- New test's `mockTx` shape matches its siblings (compare line 338's test at 368-387, including the omitted `supplier` key — `generateSupplierHints` swallows the resulting TypeError in its own try/catch, service lines 426-498, same as all pre-existing tests).

### 5. No leftover sessionStorage — PARTIAL (code clean, comments stale)

No sessionStorage *reads/writes* remain in either e2e spec (grep-verified across `frontend/e2e/`). However, `login-tenant-slug-sanitization.spec.ts` retains three stale comments:

- Line 85: "el slug del intento fallido no queda en sessionStorage" — directly describes the assertion at line 93-96, which now reads localStorage. Contradicts the code below it.
- Line 90: "evita leer sessionStorage en mitad de una navegación" — describes the `evaluate()` at line 93, which now reads localStorage.
- Line 7 (file docblock): "si se guarda crudo en sessionStorage, todo fetch posterior lanza..." — mechanism is storage-agnostic but as written implies sessionStorage is the current store.

(`auth-reload.spec.ts:20` mentions sessionStorage as an explicit contrast — "localStorage (not sessionStorage)" — which is accurate and fine.)

## Issues

### Medium

1. **Stale sessionStorage comments contradict their own assertions** — `frontend/e2e/login-tenant-slug-sanitization.spec.ts:85,90` (and docblock line 7). This spec's entire purpose is documenting storage semantics for the tenant slug; the comments now misdescribe the system under test and will mislead the next editor. Fix: s/sessionStorage/localStorage/ (line 7 could say "en el storage de sesión (localStorage)"). Comment-only change, no behavior.

### Low

2. **Backend gitignore gap (outside diff)** — `backend/test-results/.last-run.json` is untracked because `backend/.gitignore` lacks the `test-results/` entry that `frontend/.gitignore` has (lines 15, 48). One-line housekeeping to avoid accidentally committing Playwright artifacts on future backend-dir runs.

### Informational (no action required)

- `tracksInventory` was deliberately NOT added to the offer/notification-path tests (lines 338, 422, 651, 716) — verified their assertions all execute before the gate, so the omission is correct-minimal, not an oversight. Two explanatory comments (spec lines 501, 915) document the field's meaning for future readers.
- `nextScheduledPurchase` (dashboard.service.ts:186-199) has no positive test coverage — the mock default only prevents the crash. Pre-existing gap from feature commit 507fedb, out of scope for a drift fix.

## Behavioral Checklist

- Concurrency: N/A (test-only; no shared mutable state introduced — `lotService` variable is reassigned per `beforeEach` like its siblings)
- Error boundaries: N/A
- API contracts: none touched
- Backwards compatibility: no production or schema changes
- Input validation: N/A
- Auth/authz: failed-login cleanup path now genuinely regression-tested (improvement)
- N+1/query efficiency: N/A
- Data leaks: no secrets in diff; all IDs are fake constants

## Recommended Actions

1. (Medium) Update the three stale sessionStorage comments in `login-tenant-slug-sanitization.spec.ts` (lines 7, 85, 90) to say localStorage.
2. (Low) Add `test-results/` to `backend/.gitignore` and delete `backend/test-results/`.

## Metrics

- Files: 4 (all spec) | LOC: +97/-9 | Production files touched: 0
- Commits cited: 3/3 verified | Production claims cited: 4/4 verified against source
- Blocking issues: 0 | Medium: 1 (comments) | Low: 1 (out-of-diff housekeeping)

## Unresolved Questions

None.
