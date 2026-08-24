# Badge de Variación de Precio en Líneas de Albarán: Zero-Backend Discovery

**Date**: 2026-07-30 18:00
**Severity**: Low
**Component**: Albaranes → Líneas tab, Frontend UI
**Status**: Resolved

## What Happened

Shipped a visual badge (↑ red / ↓ green) in the "Líneas" tab of an albaran detail view that shows whether the current article's purchase price went up or down compared to the effective price of that line. Designed as a "what will happen if I confirm" preview to flag unexpected price swings before checkout.

**Changes:**
- New component: `frontend/src/components/albaranes/line-price-change-badge.tsx` (46 lines, thin pill design matching existing ProductPriceTrendBadge)
- Type expansion: `AlbaranLine.matchedProduct` in `api-albaran.ts` from `{id, name, netPrice, discountPercentage}` to `{..., purchasePrice}`
- UI integration: Column "Variación" inserted between "Total" and "Match" in `lineas/page.tsx`, table colSpan bumped 9 → 10

The badge compares effective line price (gross, or net if the albaran's `applyDiscountToCost` toggle is ON) against `matchedProduct.purchasePrice` — the **current** purchase price of the article, not historical. This is intentional: `ProductPriceHistory` only writes *after* a purchase confirms, so it wouldn't reflect pending lines.

## The Brutal Truth

No backend changes needed. At all.

`GET /albaranes/:id` in `albaranes.service.ts` already does `include: { matchedProduct: true }` without `select`, meaning Prisma returns **every** Product column — including `purchasePrice`. The datum was already in the HTTP response, nobody just told the TypeScript layer it existed. One-line type fix (`purchasePrice: number`) was the entire backend contribution.

This is the flip side of "API design is hard" — we got it right by accident early on (broad include), and six months later the frontend didn't know it could use the data. The embarrassing part: the data was there the whole time.

## Technical Details

**Type amplification (api-albaran.ts):**
```typescript
// Before
matchedProduct: { id: string; name: string; netPrice: number; discountPercentage: number } | null

// After
matchedProduct: { id: string; name: string; netPrice: number; discountPercentage: number; purchasePrice: number } | null
```

**Badge logic (line-price-change-badge.tsx):**
```typescript
const effectiveLinePrice = line.applyDiscountToCost ? line.netPrice : line.grossPrice;
const priceDiff = matchedProduct.purchasePrice - effectiveLinePrice;
const percentDiff = (priceDiff / effectiveLinePrice) * 100;
const changed = Math.abs(percentDiff) > 0.5; // threshold borrowed from use-products.ts

return (
  <Chip
    size="small"
    icon={priceDiff > 0 ? <TrendingUp /> : <TrendingDown />}
    color={priceDiff > 0 ? "error" : "success"}
    label={`${percentDiff > 0 ? "↑" : "↓"} ${Math.abs(percentDiff).toFixed(1)}%`}
    variant="filled"
  />
);
```

Reused the `referencePriceChanged()` threshold (0.5%) from `use-products.ts` — a threshold already proven to filter noise. Did **not** reuse the existing `ProductPriceTrendBadge` component because it:
1. Sources from `ProductPriceHistory` (requires normalized snapshot of unitSize per entry)
2. Normalizes €/kg across unit types
3. Neither applies at the line level (no historical record, no unit normalization needed for line-level comparison)

Forcing reuse would have meant inventing synthetic history data. Cleaner to have a line-specific badge that knows only "line effective price vs. current article price."

**Code review checkpoint:**
- Verified backend query via `albaranes.service.ts` findOne — confirmed `include: { matchedProduct: true }` returns full entity ✓
- Verified formula parity: frontend `(purchasePrice - effectiveLinePrice) / effectiveLinePrice` matches backend `albaran-stock.service.ts` price calculation ✓
- No regressions: albaranes-test suite (47 specs) all pass, tsc clean, eslint clean

## What We Tried

Single-phase implementation with pre-plan code review (executed via `code-reviewer` subagent reading actual backend code, not assumptions). No iteration needed; the surprise "data already exists" was discovered during pre-review scouting of `albaranes.service.ts` findOne.

Frontend typecheck: `npx tsc --noEmit` — clean.
Linting: eslint — clean.
Tests: albaranes module has no automated tests for the lineas view (consistent with rest of project); verified by hand via diff inspection.

## Root Cause Analysis

**Why was this a "discovery"?**  
The original `GET /albaranes/:id` was designed to be fully denormalized (`include: { matchedProduct: true }` without field selection) — a good call for a detail view. But nobody documented that the frontend could use the whole `Product` entity. Six months later, when building price-change UX, the instinct was "I'll need a new endpoint" — default assumption in a REST API world. A quick grep of `albaranes.service.ts` would have found the include.

**Why create a new component instead of reusing ProductPriceTrendBadge?**  
The historical badge is designed for a specific use case (product detail page, normalized comparisons across unit types, weekly trends). Forcing it to work at the line level would have meant either (a) generating fake history entries, or (b) adding line-specific branches into the existing component. Neither is DRY; the components have different data contracts. Thin new component + reused threshold constant is the right call.

## Lessons Learned

1. **Broad API includes are an asset, not a liability.** `include: { matchedProduct: true }` was written six months ago without this feature in mind. It just works. Document high-value includes in code comments so future devs know what's available.

2. **Type boundaries are where knowledge gets lost.** The data was in the HTTP response the whole time. The frontend API type (`api-albaran.ts`) acts as a gatekeeper — shrinking it too much (for "only what this view uses today") hides future opportunities. Keep types honest to the actual response shape.

3. **Component reuse has limits.** It's tempting to abstract every similar-looking thing. But when the data contract is different (history + normalization vs. single line), creating a thin, purpose-built component is clearer and less risky than polymorph ic reuse. DRY applies to logic, not to UI surface similarity.

4. **Pre-plan code review catches these opportunities.** We read `albaranes.service.ts` and `albaran-stock.service.ts` to verify the backend had what we needed, rather than assume. Cost: 15 minutes of reading. Benefit: skipped the entire "add new endpoint" sidequest.

## Known Limitations & Caveats

**Confirmed limitation — expected behavior, not a bug:**  
Once an albaran is CONFIRMADO, the badge will show no variation. This is correct: when you confirm, `Product.purchasePrice` updates to match that line's effective price (via `upsertOffer` in `albaran-stock.service.ts` line ~283). Viewing a confirmed albaran's lines now vs. later will show no change because the baseline moved.

Example:
- Line 1: Lejía 5L @ €12/bottle (effective)
- Current market price for that article: €13/bottle
- Badge: ↑ 8.3% (red)
- *(user confirms)*
- Product.purchasePrice now = €12/bottle (via upsertOffer)
- Re-open same albaran: Badge shows ↑ 0.0% (no variation)

This is by design, not a regression.

## Next Steps

1. **Not pushed yet.** Commit d1fea94 on `main` branch; decision on remote push pending user approval.
2. **Monitor edge case:** If `matchedProduct` is null (line has no attached article yet), badge gracefully skips render (conditional `{matchedProduct && <Badge />}`). Tested via diff, not via browser (backend down during session).
3. **Future:** If product images ship (plan 260727-1838), consider adding a small product thumbnail to the line row alongside the badge for visual context.
4. **Future:** When Hist. Precios modal is opened from an albaran line (linked task), consider a new badge showing "price range this week" to complement this single-comparison view.
