---
phase: 2
title: Backend resumen en dashboard KPIs
status: completed
priority: P2
dependencies:
  - 1
---

# Phase 2: Backend resumen de caducidades en dashboard KPIs

## Overview

Añade `expiringLabels` al payload de `GET /dashboard/kpis`
(`DashboardService.calculateKPIs`), siguiendo el mismo patrón que
`nextScheduledPurchase` (dashboard.service.ts:201-273): una query barata
calculada siempre, visibilidad decidida en frontend por `canSeeEtiquetado`
(no gating de módulo en el backend — consistente con cómo ya se calculan
`pendingOrders`/`activeProductionBatches` sin chequear si esos módulos están
activos).

## Requirements

- Funcional: `expiringLabels` = `{ count, nearest }` con `count` = nº de
  `FoodLabel` con `voidedAt: null` y `daysUntilExpiry <= expiryWarningDays`
  del tenant (incluye ya caducadas); `nearest` = la de fecha efectiva más
  próxima (puede estar ya caducada), o `null` si `count === 0`.
- No funcional: una sola query adicional (`count` + `findFirst` ordenado),
  igual de barata que las demás queries de `calculateKPIs`. No traer el
  listado completo aquí — eso es el panel (fase 3).
- No funcional: reusa el umbral de la fase 1 — **no** query directa a
  `Configuration` desde `DashboardService`; inyectar `EtiquetadoConfigService`
  (mismo patrón de inyección cruzada de servicios ya usado en este servicio
  con `PurchaseScheduleService`/`RoleAccessService`, ver imports líneas 4-7).

## Architecture

`DashboardService.calculateKPIs` ya mezcla queries directas a Prisma
(`purchaseOrder`, `workBatch`, `productionOrder`) con lógica reutilizada de
otros módulos vía servicio inyectado (`PurchaseScheduleService.getNextRunAt`
en línea 247). Seguir ese segundo patrón para el umbral: inyectar
`EtiquetadoConfigService.getExpiryWarningDays(tenantId)`, pero la query de
`FoodLabel` en sí va directa a `this.prisma.foodLabel` (como las demás
entidades de este servicio) — no crear un método nuevo en
`FoodLabelService` solo para esto.

## Related Code Files

- Modify: `backend/src/modules/dashboard/dashboard.service.ts`
  — inyectar `EtiquetadoConfigService` en el constructor; en
  `calculateKPIs`, tras el bloque de `nextScheduledPurchase` (~línea 273),
  añadir el cálculo de `expiringLabels` y meterlo en el objeto de retorno
  (~línea 383, junto a `nextScheduledPurchase`).
- Modify: `backend/src/modules/dashboard/dashboard.module.ts` — importar
  `EtiquetadoModule` (o exportar `EtiquetadoConfigService` desde ahí si no
  lo está ya) para poder inyectarlo en `DashboardModule`.
- Modify: `frontend/src/hooks/use-dashboard-kpis.ts` — extender la interface
  `KPIs` con:
  ```ts
  expiringLabels: {
    count: number;
    nearest: { id: string; itemName: string; labelType: 'ELABORATED' | 'HANDLED'; useByDate: string } | null;
  } | null;
  ```
- Modify: `backend/src/modules/dashboard/dashboard.service.spec.ts` — test del
  nuevo campo (mock de `EtiquetadoConfigService` + `prisma.foodLabel`).

## Implementation Steps

1. **Verificado (fact-check):** `etiquetado.module.ts` hoy exporta solo
   `FoodLabelService` (`exports: [FoodLabelService]`); `EtiquetadoConfigService`
   está en `providers` pero no en `exports` — añadirlo a `exports`.
2. **Verificado (fact-check):** `dashboard.module.ts` hoy solo importa
   `AuthModule` (`imports: [AuthModule]`) y declara `PrismaService` como
   provider propio (no importa `PrismaModule`) — sin riesgo de ciclo al
   añadir `EtiquetadoModule` (que a su vez importa `PrismaModule`,
   `AuthModule`, `CoreModule`, ninguno depende de `DashboardModule`).
   `dashboard.module.ts`: `imports: [AuthModule, EtiquetadoModule]`.
3. `dashboard.service.ts`: inyectar el servicio, calcular `expiringLabels`
   reusando la misma fórmula de `daysUntilExpiry` de la fase 1 (si el helper
   de la fase 1 no es exportable/reusable tal cual, duplicar la comparación
   mínima aquí es aceptable — es una sola condición `where`, no vale la pena
   una abstracción compartida para esto, ver YAGNI).
4. Actualizar el tipo en el hook frontend.
5. Test del nuevo campo en `dashboard.service.spec.ts` (con y sin labels
   expirando, con el módulo `etiquetado` sin config guardada → usa default).
6. Build + jest backend.

## Success Criteria

- [ ] `GET /dashboard/kpis` incluye `expiringLabels` con la forma acordada.
- [ ] Tenant sin ninguna `FoodLabel` próxima a caducar → `{ count: 0, nearest:
      null }` (no `null` a secas, para que el frontend no tenga que
      distinguir "sin datos" de "sin alertas" — decisión de implementación,
      documentar la elegida).
- [ ] El `count` respeta el `expiryWarningDays` configurado del tenant (test
      con umbral distinto al default).
- [ ] Labels anuladas (`voidedAt` seteado) nunca cuentan.
- [ ] `jest` de `dashboard.service.spec.ts` en verde.

## Risk Assessment

- **Import circular**: descartado (ver Implementation Steps — verificado por
  lectura directa de ambos módulos, sin dependencia cruzada).
- **Coste de la query**: `count` + `findFirst` sobre `food_labels` con índice
  existente en `[tenantId, preparedAt]` pero no en la fecha efectiva de
  caducidad — con volumen bajo (etiquetas de un solo tenant/restaurante) no
  es un problema; si se ve lento en verificación, considerar índice sobre
  `useByDate` (fuera de alcance de esta fase salvo que verificación lo pida).
