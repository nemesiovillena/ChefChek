---
phase: 3
title: 'Dashboard: card reforzada'
status: completed
priority: P2
dependencies: []
---

# Phase 3: Dashboard: card reforzada

## Overview

La card "Pedidos Pendientes" del dashboard gana chip "HOY" y énfasis según
estado, diferenciando "pendiente de enviar" (error) de "corre hoy" (primary).
Sin popup, sin modal, sin toast — decisión explícita del usuario.

## Requirements

- Functional: `nextScheduledPurchase` (KPIs) añade `isToday` e
  `isPendingDraft`, computados server-side. La card renderiza:
  - `isPendingDraft && isToday` → texto error + negrita + badge existente:
    `Pendiente de enviar · {supplier} · HOY {time}`.
  - `isPendingDraft && !isToday` → como ahora (error, medium) pero con fecha.
  - `!isPendingDraft && isToday` → chip "HOY" + `Programado: {supplier} · HOY
    {timeOfDay}` en primary + medium (todavía no hay nada que hacer).
  - resto → render actual.
- Non-functional: la comparación "es hoy" la hace el backend (Madrid); el
  cliente solo consume flags. No tocar el badge rojo de `scheduledDraftOrders`
  (ya existe y funciona).

## Architecture

- `dashboard.service.ts` ya calcula `nextScheduledPurchase` en dos ramas:
  draft pendiente más antiguo (líneas ~183-224) o programación activa más
  cercana (else, ~225-260). Ambas ramas añaden los flags:
  - rama draft: `isPendingDraft: true`, `isToday: dateKey === toMadridParts(now).dateKey`.
  - rama schedule: `isPendingDraft: false`, mismo cálculo de `isToday`.
- `use-dashboard-kpis.ts` extiende `NextScheduledPurchase` (líneas ~32-33).
- `page.tsx` `pedidosPendientesCard` (líneas ~165-195): condicional de render +
  `formatNextScheduledDate` devuelve "HOY" cuando el flag lo indica.

## Related Code Files

- Modify: `backend/src/modules/dashboard/dashboard.service.ts`
- Modify: `frontend/src/hooks/use-dashboard-kpis.ts`
- Modify: `frontend/src/app/dashboard/page.tsx`

## Implementation Steps

1. Backend: extender el objeto `nextScheduledPurchase` en ambas ramas con
   `isToday` e `isPendingDraft` (reutilizar `toMadridParts`, ya importado).
2. Frontend: extender el tipo en `use-dashboard-kpis.ts`.
3. `page.tsx`: `formatNextScheduledDate(dateKey, isToday)` → `isToday ? 'HOY' : dd/mm`.
4. Render condicional del `<p>` (línea ~183-189) según los 4 casos del
   enunciado. Chip "HOY": `<span>` pequeño con `bg-[var(--error-container)]
   text-[var(--error)]` para el caso pendiente, o `bg-[var(--primary)]
   text-primary-foreground` para el caso "corre hoy" — pill redondeada, texto
   9-10px, junto al label. Nota repo: usar `text-primary-foreground`, NO
   `text-on-primary` (token inexistente).
5. Mantener `cursor-pointer` y navegación a `/dashboard/compras` intactos.

## Success Criteria

- [ ] Programación que corre hoy (sin draft): card muestra chip HOY + primary.
- [ ] Draft pendiente generado hoy: card enfatiza en error junto al badge.
- [ ] Programación futura: render igual al actual.
- [ ] Sin popup/modal/toast nuevo.

## Risk Assessment

- La rama "draft pendiente" anuncia el más antiguo; si hay drafts de varios
  días acumulados, `isToday` false → se muestra con fecha, sin chip. Correcto:
  el badge ya cuenta todos.
- Doble semántica de `nextScheduledPurchase` (draft vs próxima) queda
  explícita con `isPendingDraft` — mejora sin romper consumidores (solo hay
  uno: esta card).
