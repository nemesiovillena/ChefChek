# Lot Traceability: Two Silent Extraction Bugs + One Posix ional Matching Risk

**Date**: 2026-07-17 09:15  
**Severity**: High  
**Component**: Albaranes, OCR microservice, Stock Management, Data Model  
**Status**: Resolved  

## What Happened

Completed the foundational data model and wiring for lot (batch) traceability in receiving lines — a prerequisite for APPCC, recipe costing, and label printing. Discovered and fixed two critical extraction bugs that silently discarded lot numbers despite the IA extracting them, plus a third risk uncovered in code review: a posit ional match ing vulnerability in the manual albaran service that could attach lot to the wrong line.

## The Brutal Truth

This stung. The field already existed in the schema, DTOs, and service signatures since day one. No "new field" — just two silent leaks in the pipeline, six months in, finally noticed because we were building the next layer (APPCC). Code review caught a third invisible risk: `manual-albaran.service.ts` matched newly-created lines to their origin list by array index after a Prisma `include` — Postgres makes zero order guarantees on relations, so the lot could have been attached to the wrong line in a multi-line manual receive. The fix required rewriting the entire line-creation loop to capture id-at-insert rather than depend on relation order. Frustrating because the tests all passed; real-world multi-line receives would have been silently corrupted.

## Technical Details

**Bug 1 — OCR extraction killed in transit:**  
`backend/ocr-microservice/app/services/document_processor.py` lines 415–423, function `_build_document_from_ai()`:
```python
# Broken — discards lot, article_number, vat_percent, price_with_vat
ExtractedProduct(
    sku=product["sku"],
    name=product["name"],
    ...
    # lot, article_number, vat_percent, price_with_vat never passed
)
```
The Pydantic model and IA prompt both had those fields; the parser normalized them; but the DTO construction forgot them. Silent truncation — no error, no warning.

**Bug 2 — Stock propagation incomplete:**  
`backend/src/modules/albaranes/services/albaran-stock.service.ts`, `processStockOnConfirmation()`:
- When creating a new Product from a received line (lines 236–253): never set `Product.lot`.
- When updating Product from existing line (lines 207–229, 277–284): never set `Product.lot`.
- `Stock` and `StockMovement` had no `lot` column — no way to know which batch was in warehouse today.

**Bug 3 — Positional matching vulnerability (discovered in code review):**  
`backend/src/modules/manual-albaran/services/manual-albaran.service.ts`, lines ~86–110:
```typescript
// Old pattern (broken)
const savedLines = await this.prisma.albaranLine.createMany({
  data: linesToCreate,
});
const lineIds = albaran.lines.map(l => l.id); // Order NOT guaranteed after createMany
linesToCreate.forEach((input, index) => {
  await this.lotService.createLot({
    albaranLineId: lineIds[index], // ← wrong line if Postgres reordered
    ...
  });
});
```
Rewritten to create each line individually and capture its id at insertion time, eliminating the reliance on relation order.

## What We Tried

7 phases of implementation across schema, services, OCR fix, and frontend UI. Two iterations of code review (external subagent `code-reviewer`), which:
1. Caught missing `LotService` mock in `albaran-stock.service.spec.ts` — added to `TestingModule`.
2. Spotted the positional-match risk in `manual-albaran.service.ts` — refactored to line-at-a-time creation.
3. Suggested spec for `lot.service.ts` (not required, but good practice) — added.

Backend test suite: 95 suites / 1488 tests green; frontend typecheck clean; zero regressions in blast radius (products, almacenes, compras, recipes).

## Root Cause Analysis

- **OCR bug**: Parallel module development — schema owner, IA prompt owner, parser owner, DTO constructor owner never synchronized. Pipeline checklists would help (did you pass all extracted fields to the DTO?).
- **Stock propagation**: No architectural decision made upfront on "what does traceability really mean?" — does `Product.lot` (scalar, overwrites each receive) satisfy the use case, or do we need a full `Lot` entity? User chose the latter during scouting; backend never wired it.
- **Positional matching**: Pattern copy-pasted from somewhere else without verifying Prisma guarantees (it doesn't). Tests passed because Jest mocked Prisma and we never created multiple lines in a single transaction in tests.

## Lessons Learned

1. **Fields in transit need explicit handoff documentation.** When a value travels schema → IA prompt → parser → DTO → service → DB, someone must own each step. A pre-checklist ("did lot reach the DTO?") catches this in code review, not production.

2. **Code review found a real failure mode that tests miss.** Postgres ≠ Jest mock. Relation order is not guaranteed. Tests that create single objects in isolation pass; real multi-line scenarios fail silently. Need integration tests that create multiple lines in one transaction and verify they link to the correct lot.

3. **User's decision to build the full data model now was the right call.** Choosing model `Lot` (aditiv e, no changes to `Stock` uniqueness, separate tables for trazability) means APPCC/etiquetas can build on top without re-migrating. Backward-compatible from day one. The cost was one session; the savings are months of no-rework.

4. **Soft-delete in another module didn't affect this**, but it's a reminder: check for holes when reusing patterns. `manual-albaran.service.ts` took the wrong assumption from somewhere. Worth documenting why a pattern works (e.g., "Prisma.include preserves order" — false) vs. why it doesn't.

## Next Steps

1. **Not pushed yet.** Commit `e28afc2` on develop; waiting for user decision on whether to push/PR.
2. **Modules that depend on Lot** (APPCC proper, recipe consumption tracking, label printing) are explicitly out of scope and marked YAGNI — documented in plan. Lot table is ready to be consumed when those are built.
3. **Future touch point**: `warehouse.service.ts` / `almacenes` module also creates `Stock`/`StockMovement` outside the albaran flow (direct inventory adjustments). Should also propagate `lot` if present. Not requested now; flag in memory for next session.
