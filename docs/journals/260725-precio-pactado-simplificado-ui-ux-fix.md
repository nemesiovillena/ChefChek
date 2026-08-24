# Precio Pactado Simplificado: UI/UX Fix + Cache Bug Caught in Review

**Date**: 2026-07-25 14:31
**Severity**: Medium
**Component**: Products/Suppliers, Artículos modal, API
**Status**: Resolved

## What Happened

Shipped a three-phase UX polish for the "agreedPrice" (precio pactado) feature that already existed in the database and backend but was hidden and tedious in the UI. Users were copying-and-pasting purchase prices into a manual text field instead of 1-clicking, the supplier "detail" was a near-invisible expand-row that most never discovered, and there was no link between an article's offers and the supplier's full profile.

**Phase 1 (Backend):** Added `GET /v1/products/suppliers/:id/offers` — a read-only endpoint listing all offers from a supplier with product and category details.

**Phase 2 (Frontend, Artículos modal):** Extracted the agreed-price edit logic into a reusable `AgreedPriceCell` component with a new "copy current price" button (1 clic, no confirmation). Made the supplier name a clickable link to the supplier's ficha dialog.

**Phase 3 (Frontend, Suppliers module):** Replaced the hidden expand-row pattern with a proper modal dialog (`SupplierOffersFichaDialog`) featuring two real tabs (`role="tablist"` pattern): "Precios pactados" (new, table of offers with `AgreedPriceCell`) and "Productos e histórico" (reused existing `SupplierDetailPanel`). VIEWER role sees pricing data read-only, no edit buttons.

## The Brutal Truth

One critical cache bug slipped past first review and would have shipped silent. The new `useSupplierOffers` hook uses queryKey `['suppliers', supplierId, 'offers']`, but when you edit an agreed price via the new dialog, the mutation (`useUpdateSupplierOffer`) only invalidates keys like `['products', productId, ...]`. Result: you click "save," the backend persists it, the UI shows "Guardando..." and then stops — the price pactado updates in the DB but the dialog row keeps showing the stale value until the cache expires or you manually refresh. **Not a crash. Not wrong. Just silently failed to reflect the save.** This is the kind of bug that gets blamed on "the system is slow" or "my change didn't save" in production, when the code was fine, just incomplete.

Code review caught it before ship and it was fixed with an explicit `queryClient.invalidateQueries({ queryKey: ['suppliers', supplierId, 'offers'] })` call right after `mutateAsync` in the onSave handler (lines 98-102 of supplier-offers-ficha-dialog.tsx). Frustrating because the fix is trivial once spotted, but finding it required understanding React Query's key scoping — the pattern of "mutation invalidates all keys related to the entity it touches" broke down here because we were using a different query key scope than the mutation knew about.

## Technical Details

**The cache bug:**
```typescript
// useSupplierOffers hook — queryKey: ['suppliers', supplierId, 'offers']
export function useSupplierOffers(supplierId: string | null) {
  return useQuery({
    queryKey: ['suppliers', supplierId, 'offers'],
    queryFn: async () => {
      const res = await apiClient.get(`/v1/products/suppliers/${supplierId}/offers`);
      return res.data as SupplierOfferWithProduct[];
    },
    enabled: !!supplierId,
  });
}

// useUpdateSupplierOffer mutation — invalidates ['products', productId, 'offers'] and variants
// but NOT ['suppliers', supplierId, 'offers']
// Result: save goes through, row stays stale until cache expiry
```

**Fix applied in supplier-offers-ficha-dialog.tsx:91-103:**
```typescript
onSave={async (value) => {
  await updateOffer.mutateAsync({...});
  // Manual invalidation for the dialog's query key scope
  queryClient.invalidateQueries({ queryKey: ['suppliers', supplierId, 'offers'] });
}}
```

**Code review findings (initial pass scored 6/10, re-passed at 9/10 after fix):**
- 1 critical: missing cache invalidation (fixed above)
- 1 medium: added controller test for `getSupplierOffers` for parity with sibling endpoints
- Regression proof: 1531/1531 backend tests pass, tsc clean, eslint clean, manual diff of extracted component shows zero behavior change

## What We Tried

Three-sprint execution with planned handoff order (Phase 1 → Phase 2 steps 1–2 → Phase 3 → Phase 2 step 3) to avoid circular dependencies. Code review caught the cache bug on the first full pass, and we fixed it before committing. Added the missing controller test spec as well.

## Root Cause Analysis

**The cache bug:** Lack of architectural symmetry. `useUpdateSupplierOffer` was designed (and is used elsewhere) with a product-scoped key: `['products', productId, 'offers']`. When we built the new dialog, we created a supplier-scoped key: `['suppliers', supplierId, 'offers']` — a reasonable choice for the view, but the mutation doesn't know it needs to invalidate that. The pattern of "mutations invalidate all related queries" assumes key homogeneity. It broke here because we had two different scopes for the same data (product-centric vs supplier-centric queries on the same offer object). **Lesson: when a mutation is reused in a different query scope, explicitly invalidate that scope too.**

**The design pattern inconsistency that *could* have been caught:** docs/code-standards.md rule 6 mandates URL-routed tabs (e.g., `/suppliers/[id]?tab=precios`), but the existing `articulo-modal.tsx` uses `useState`-based tab switching in production and ships without URL routing. During validation, the user explicitly chose to **keep following the existing, undocumented deviation** rather than use the written standard. This was the right call (consistency with proven UX), but it surfaced that the standard itself is aspirational, not enforced. **Lesson: verify standards against current codebase patterns before citing them; document waivers.**

## Lessons Learned

1. **Query key scope mismatch is silent.** When mutations and queries use different key hierarchies for the same entity (product-scoped vs supplier-scoped offers), invalidation doesn't compose. The fix is explicit: check the queryKey of any hook consuming the result and add manual invalidation if the mutation doesn't cover it.

2. **Reusable mutations need scope-aware invalidation.** `useUpdateSupplierOffer` is smart to invalidate product-scoped queries, but if you use it from a supplier-scoped query context, you own the additional invalidation. Document this, or make the mutation accept an optional callback or key array to invalidate.

3. **Code review found the real failure mode; tests didn't.** Backend jest tests all passed (1531/1531). Frontend typecheck passed. ESLint passed. But none of those run the React Query integration: saving data, waiting for async, checking cache state, re-rendering. A single manual flow test ("save agreed price, verify the row updates immediately") would have caught this. The test suite is good at catching crashes, not silent stalenesses.

4. **Standards vs. reality.** The codebase has an undocumented pattern (useState tabs in modals) that conflicts with written standards (URL-routed tabs). Rather than force compliance, the user chose proven UX over abstract rule. This was correct, but it means: (a) update the standard to match the pattern, or (b) accept the waiver and document why. Silently following the pattern while the standard says otherwise is how technical debt accumulates.

5. **Phase ordering matters for dependencies.** The plan specified Phase 1 → Phase 2.1-2.2 → Phase 3 → Phase 2.3 to avoid circular imports. This worked; the reusable component (`AgreedPriceCell`) stayed stable and didn't need rework after Phase 3. Planning parallel phases early saves rework.

## Next Steps

1. **Not pushed yet.** Commit `ae9508f` on `main` branch; not pushed to remote (user decision pending).
2. **Consider documenting the mutation/query key pattern.** Add a note to `useUpdateSupplierOffer` or `use-products.ts` explaining the product-scoped invalidation, so the next developer who reuses it in a supplier-scoped context thinks to add manual invalidation.
3. **Consider adding a React Query integration test.** The pattern `mutateAsync → check cache state → re-render` catches this class of bug. Not urgent, but valuable for future mutations that span multiple query scopes.
4. **Update docs/code-standards.md rule 6 or document the pattern deviation.** Choose one: either enforce URL-routed tabs going forward (refactor existing modals in next sprint), or update the standard to "use URL routes when the tab state is bookmarkable; useState tabs are OK for transient dialogs." Either way, stop the silent inconsistency.
