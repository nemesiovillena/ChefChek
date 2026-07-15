---
title: "Módulo Compras: pedidos a proveedores, envío multicanal, pactados, catálogos IA, programación y analítica"
description: "Nuevo módulo tenant-activable `compras` que centraliza el ciclo pedido→envío→recepción→factura, con control de precios pactados, importación de tarifas por IA, comparativa por local, pedidos programados y analítica; retira el prototipo roto `orders` e introduce la entidad Location (multi-local)"
status: in-progress
priority: P1
effort: 104-120h
branch: develop
tags: [backend, frontend, prisma, compras, suppliers, modules, ia, scheduler]
created: 2026-07-14
---

## Overview

PDR completo: [docs/pdr-modulo-compras.md](../../docs/pdr-modulo-compras.md). Decisiones de producto confirmadas 2026-07-14: (1) módulo nuevo `compras` retirando el prototipo roto `orders`; (2) envío wa.me + SMTP por tenant + tel: + PDF; (3) programaciones generan borrador + notificación (sin auto-envío); (4) nueva entidad `Location` multi-local, aditiva y acotada a compras+almacenes.

Cada fase termina con su **Checking** (checklist en el phase file) y un informe en `reports/sprint-N-checking-report.md`. Regla innegociable: **cero pérdida de datos** (migraciones aditivas, reversibles).

## Phases

| # | Phase | Status | Effort | Dependencies |
|---|-------|--------|--------|-------------|
| 0 | [Fundaciones: módulo `compras`, retirada de `orders`, `Location`, modelos de pedido](phase-00-fundaciones-modulo-location-modelos.md) | [x] | 10-12h | None |
| 1 | [Listas de compra (checklist) y pedidos manuales con sugerencias mín/máx](phase-01-listas-checklist-pedidos-manuales.md) | [x] | 16-18h | 0 |
| 2 | [Envío multicanal: PDF, wa.me, SMTP por tenant, tel:, eventos](phase-02-envio-multicanal-pdf-whatsapp-smtp.md) | [x] | 14-16h | 1 |
| 3 | [Recepción: conciliación pedido↔albarán y factura mínima](phase-03-recepcion-conciliacion-albaran-factura.md) | [x] | 12-14h | 1 |
| 4 | [Precios pactados y panel de desviaciones con notificación](phase-04-precios-pactados-desviaciones.md) | [ ] | 10-12h | 3 |
| 5 | [Catálogos/tarifas con IA, comparativa de proveedores y activación por local](phase-05-catalogos-ia-comparativa-por-local.md) | [ ] | 18-20h | 0 (integra 4 si está) |
| 6 | [Programación de pedidos (scheduler → borrador + notificación)](phase-06-programacion-pedidos-scheduler.md) | [ ] | 10-12h | 1 |
| 7 | [Analítica de compras + QA end-to-end del módulo](phase-07-analitica-compras-qa-final.md) | [ ] | 14-16h | 2,3,4,5,6 |

## Key Insights

- **Añadir el módulo no requiere migración**: registro estático en [registry.ts](../../backend/src/modules/modules/constants/registry.ts), estado por tenant como filas `modules.compras.enabled` en `Configuration`; superadmin toggle y `useModules` son genéricos. Solo: entrada en registry + `@RequireModule("compras")` + `NavItem`/`ROUTE_MODULE_MAP` en [nav-config.ts](../../frontend/src/features/modules/lib/nav-config.ts).
- **El prototipo `orders` está roto**: [orders.service.ts](../../backend/src/modules/orders/orders.service.ts) referencia `prisma.automatedOrder`/`orderItem` (modelos inexistentes) vía `as any`; su página frontend son comandas desconectadas. Se retira de registry/nav/app.module; las tablas stub (`Order`, `GoodsReception`, `Invoice`) se conservan. Sus DTOs (OrderStatus, safety-factor, reorder) sirven de referencia de dominio.
- **Reuso máximo**: `Supplier.orderMethods/whatsapp/email/phone` ya modelan los canales; `ProductSupplierOffer` (+`isPreferred`) es la base de comparativa y pactados; `Stock.minimumStock/maximumStock/reorderLevel` alimenta sugerencias; el pipeline `albaranes` (máquina de estados + `notifyPriceChange`→`Alert` + upsert de ofertas) y el microservicio OCR/IA se reutilizan tal cual con prompt nuevo de tarifas.
- **Net-new real**: `@nestjs/schedule` (no instalado), transporte SMTP (el `email.service.ts` actual solo loguea), integración wa.me, y todos los modelos de pedido (`PurchaseOrder/Line/Event`, `PurchaseList/Item`, `PurchaseSchedule`, `CatalogImport/Line`, `OfferLocationSetting`, `Location`).
- **Gotchas del repo aplicables**: importar `AuthModule` en el módulo nuevo (si no, el backend no arranca); numeración secuencial con `$queryRaw MAX` anclado (`^PED-(\d+)$`) porque el soft-delete oculta filas a `findFirst` pero ocupan índices; SQL raw analítico debe añadir `deletedAt IS NULL` a mano; backend corre desde dist (build + relanzar, sin watch); tabs con `role="tablist"` (globals.css oculta `<nav>` no-fixed); `text-primary-foreground` (no `text-on-primary`); pickers con `useProductSearch` (useProducts pagina a 20/50).
- **API keys de IA siguen client-side** (localStorage → FormData por request), mismo patrón que albaranes: sin almacenamiento server-side de keys.

## Dependency Graph

```
Phase 0 (fundaciones) ──► Phase 1 (listas+pedidos) ──┬──► Phase 2 (envío)      ──┐
                    │                                 ├──► Phase 3 (recepción) ──►│ Phase 4 (pactados) ─┐
                    │                                 └──► Phase 6 (scheduler)  ──┤                     ├──► Phase 7 (analítica+QA)
                    └──► Phase 5 (catálogos IA + por-local) ──────────────────────┘─────────────────────┘
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Multi-local se expande fuera de compras (usuarios, stock, permisos) | Alta | Alto | Alcance cerrado en PDR: `Location` solo compras+`Warehouse.locationId?`; resto a preguntas abiertas/roadmap |
| Credenciales SMTP por tenant en `Configuration` | Media | Alto | Cifrar el valor (mecanismo se decide en fase 2); jamás devolver el password en GET |
| IA extrae mal tarifas heterogéneas | Alta | Medio | Revisión humana obligatoria línea a línea antes de aplicar; estados por línea; cero escritura directa |
| Cron genera pedidos duplicados | Media | Medio | Idempotencia por `lastRunAt` + ventana de ejecución; test de re-ejecución del tick |
| SQL raw sin `deletedAt IS NULL` | Media | Alto | Checklist en fases 0/7 + test con fila soft-deleted |
| Retirada de `orders` rompe imports/arranque | Baja | Medio | Grep exhaustivo de referencias antes de quitar; verificación de arranque en el checking de fase 0 |
| Migración `Location`+backfill sobre datos reales | Baja | Crítico | Aditiva y nullable; backfill idempotente; probar sobre copia; plan de rollback por fase |

## Rollback Plan

- Fase 0: quitar entrada del registry/nav revierte la visibilidad; la migración `Location`/modelos de pedido es aditiva (tablas nuevas + columnas nullable) → rollback = migración inversa que solo dropea lo nuevo (sin tocar datos existentes). La retirada de `orders` es reversible restaurando registry/nav/app.module (código en git).
- Fases 1-7: cada una añade tablas/columnas nullable y código nuevo; rollback = revertir commits de la fase + migración inversa aditiva. Ninguna fase modifica ni borra datos existentes de artículos/albaranes/proveedores.
- El módulo entero puede desactivarse por tenant desde superadmin en cualquier momento (kill-switch funcional sin deploy).
