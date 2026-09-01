---
phase: 4
title: Verificación
status: completed
priority: P2
dependencies:
  - 1
  - 2
  - 3
---

# Phase 4: Verificación

## Overview

Specs backend del cálculo enriquecido, typecheck/build frontend y escenario
manual con dos programaciones activas el mismo día.

## Implementation Steps

1. Specs backend (jest, NO bun test — memoria del repo):
   ```bash
   cd backend && bun run test -- purchase-schedule.service
   ```
2. Typecheck + build frontend:
   ```bash
   cd frontend && bun run typecheck && bun run build
   ```
   (O el gate que use el repo si `typecheck` no existe como script: `bunx
   tsc --noEmit`.)
3. Escenario manual (dev, usuario admin@chefchek.local):
   - Crear dos programaciones activas con días que incluyan hoy, horas
     distintas (una pasada, una futura).
   - La pasada (cron ya disparado, BORRADOR generado) → fila "Pendiente de
     enviar · generado hoy HH:mm" en error/negrita; dashboard con badge + énfasis.
   - La futura → fila "Hoy · HH:mm" en primary/negrita; dashboard chip HOY sin
     error.
   - Enviar el BORRADOR → fila pasa a estado "corre hoy" o "Próxima" según
     hora; dashboard se actualiza (invalidación `dashboard-kpis` ya cubierta
     por el hook al mutar; el envío del pedido ya invalida lo suyo).
   - Pausar una programación → "Próxima: —".
4. Si el cron local no ha disparado aún (corre cada 5 min), forzar el estado B
   verificando la fila tras `lastRunAt` de hoy, o esperar un tick.

## Success Criteria

- [x] Specs backend en verde.
- [x] Typecheck/build frontend sin errores.
- [ ] Escenario de dos programaciones verificado visualmente (móvil y desktop).

## Risk Assessment

- Cron cada 5 min: la transición draft→enviado puede tardar un tick en
  reflejarse; invalidar queries de schedules tras enviar el pedido si no lo
  está ya (el listado de compras ya invalida al mutar pedidos — verificar, no
  asumir).
