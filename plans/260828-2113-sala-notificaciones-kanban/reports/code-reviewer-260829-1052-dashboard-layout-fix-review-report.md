# Review: dashboard layout fix (Notificaciones de Sala column + scroll)

**Score: 10/10**

## Scope
- File: `frontend/src/app/dashboard/page.tsx` (1 file, +9/-62)
- No API/type/prop surface touched — pure client JSX/Tailwind reposition + dead code removal.

## (a) Root cause verified
Parent is `hidden md:grid md:grid-cols-12 gap-gutter` — real CSS Grid. Grid items default to `align-items: stretch`, so each column `<div>` (col-span-4, col-span-8) stretches to the tallest row height. Before the fix, both `tareasPendientesBoard` and `salaTasksBoard` sat as siblings in the col-span-8 div under `space-y-gutter` (normal block flow, not flex/grid) — each independently computing `h-full` against the *already-stretched* column, so their heights summed to roughly 2x the intended height, overflowing the page. Confirmed by reading the JSX: `tareasPendientesBoard` (line 254) still carries `h-full` and is now the **sole** child of `md:col-span-8` (line 421) — correct, since it's the only claimant of the column's stretched height. `salaTasksBoard` (line 311, post-fix) dropped `h-full` and now lives in `md:col-span-4` alongside two non-full-height siblings (`pedidosPendientesCard`, `notificacionesCard`) under `space-y-gutter` — correct, since normal block flow sizes each child to its own content, no stretch conflict. Mechanism genuinely fixed, not symptom-patched.

## (b) Blast radius — confirmed clean
- `pedidosPendientesCard`, `notificacionesCard`, `crearOrdenButton`, mobile `md:hidden` stack, and the "Atmospheric Secondary Layer" section (recetas/telemetría/temp cámara) are untouched — verified via `git diff --stat` (all changes accounted for in the visible hunks) and direct read of the surrounding JSX.
- Dead-code grep for `efficiencyWidth`, `lowStockItems`, `activeUsers`, `Bajo Stock`, `En Turno`, `Índice de Eficiencia` — zero hits. Full removal confirmed, no orphans.
- `formatKPIValue`, `kpis?.pendingOrders`, `temp` — all still referenced and used elsewhere in the file (grep-verified); not orphaned.
- Mobile order comment updated to reflect removed KPI cards; mobile JSX order itself (`tareasPendientesBoard`, `salaTasksBoard`, `crearOrdenButton`, `pedidosPendientesCard`, `notificacionesCard`, `recetasCard`, `comprasCard`) unchanged.

## (c) Public contracts
No exported interfaces, hooks, API calls, or types touched. Pure layout/JSX reposition + local dead-state removal. No breaking-change risk.

## (d) Pattern consistency
Tailwind/M3 token usage (`tonal-layer-2`, `font-headline-md`, `space-y-gutter`, `border-border`) consistent with rest of file. New code comment on `salaTasksBoard` explains the *why* (grid stretch mechanism) rather than restating the diff — good practice, no stale plan/phase labels embedded.

## (e) Independently re-verified
- `bunx eslint src/app/dashboard/page.tsx` — clean, no output.
- `rm -rf .next && bun run build` — compiled successfully, TypeScript clean, all 33 static pages generated, `/dashboard` listed as `○ (Static)`.
- Dead-reference grep — zero hits (see above).

## Critical Issues
None.

## Warnings
None.

## Suggestions
None — change is minimal, scoped, and the root cause is correctly addressed.

## Unresolved Questions
None.
