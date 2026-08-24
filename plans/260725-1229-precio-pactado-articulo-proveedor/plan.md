---
title: 'Precio pactado simplificado: Artículos ↔ Proveedores'
description: >-
  1 clic para fijar precio pactado desde el precio actual de la oferta, link
  directo a ficha proveedor, y ficha de proveedor con pestañas reales (Precios
  pactados + Productos/histórico) en vez del expandible oculto.
status: completed
priority: P2
branch: main
tags:
  - frontend
  - backend
  - api
  - products
  - suppliers
blockedBy: []
blocks: []
created: '2026-07-25T10:49:16.380Z'
createdBy: 'ck:plan'
source: skill
---

# Precio pactado simplificado: Artículos ↔ Proveedores

## Overview

`agreedPrice` ("precio pactado") ya existe en `ProductSupplierOffer` (backend) y ya se edita/limpia desde el modal de Artículo. El problema es puramente de UX y de una vista que falta:

1. El input de precio pactado en Artículos nunca precarga el precio actual de la oferta — hay que teclearlo a mano aunque ya está en pantalla.
2. No hay forma de ir de una oferta (en Artículo) a la ficha de ese proveedor.
3. La "ficha" de proveedor hoy es una fila que se expande tras un chevron casi invisible, sin pestañas reales, y no muestra precios pactados por producto.

Scope confirmado con el usuario (HOLD SCOPE): endpoint de solo lectura + botón 1-clic en Artículos + ficha de proveedor con pestañas reales que sustituye el expandible oculto. Sin ruta nueva `/dashboard/proveedores/[id]`, sin edición masiva, sin exportación.

Ver scout report completo: [`plans/reports/scout-260725-1229-precio-pactado-articulo-proveedor-report.md`](../reports/scout-260725-1229-precio-pactado-articulo-proveedor-report.md).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Endpoint ofertas por proveedor](./phase-01-endpoint-ofertas-por-proveedor.md) | Completed |
| 2 | [Un clic y link en Artículos](./phase-02-un-clic-y-link-en-art-culos.md) | Completed |
| 3 | [Ficha proveedor con pestañas](./phase-03-ficha-proveedor-con-pesta-as.md) | Completed |

### Orden de ejecución (importante — no es 1→2→3 estricto)

La Fase 2 depende parcialmente de la Fase 3 (el botón "ir a ficha" abre un diálogo que construye la Fase 3) y la Fase 3 depende parcialmente de la Fase 2 (reutiliza el componente `AgreedPriceCell` que la Fase 2 extrae). Orden real:

1. **Fase 1** completa (backend, sin dependencias).
2. **Fase 2, pasos 1-2**: extraer `AgreedPriceCell` + botón "usar precio actual" (no requieren Fase 3).
3. **Fase 3** completa (usa `AgreedPriceCell` de la Fase 2 y el endpoint de la Fase 1).
4. **Fase 2, paso 3** (cierre): añadir el botón/link "ir a ficha proveedor" ahora que el diálogo de la Fase 3 existe.

## Decisiones ya confirmadas (no reabrir)

- Click "usar precio actual" → guarda DIRECTO en 1 clic (sin confirmación intermedia). Edición manual y "Sin pactar" se mantienen tal cual existen hoy.
- El link "ir a ficha proveedor" abre un modal/drawer reutilizado — NO se crea ruta `/dashboard/proveedores/[id]`.
- Ese modal/drawer sustituye el expandible oculto en la tabla de Proveedores y tiene pestañas reales y visibles (patrón `role="tablist"` de `articulo-modal.tsx`), con al menos una pestaña "Precios pactados".

## Dependencies

Ninguna dependencia cruzada con otros planes. `plans/260714-1357-modulo-compras/phase-04-precios-pactados-desviaciones.md` (status: done) introdujo `agreedPrice` originalmente — este plan no lo modifica, solo lo expone mejor en la UI.

## Validation Log

### Session 1 — 2026-07-25
**Trigger:** `/ck:plan validate` tras crear el plan inicial de 3 fases.
**Questions asked:** 3

#### Verification Results
- **Tier:** Standard (3 fases → Fact Checker + Contract Verifier)
- **Claims checked:** 12
- **Verified:** 10 | **Failed:** 1 | **Unverified:** 0 (1 corrección menor de código, no un "failed" de arquitectura)

Claims verificados directamente contra el código (grep/read, no memoria):
1. `backend/prisma/schema.prisma:257-294` `ProductSupplierOffer` — VERIFIED, campos exactos.
2. `backend/src/common/services/prisma.service.ts` middleware soft-delete (líneas 41,48,55,62 inyectan `deletedAt: null` en `args.where` del modelo top-level) — VERIFIED, confirma el gotcha de que `include` no hereda el filtro.
3. `products.service.ts:1414-1457` `getSupplierProducts` + convención de métodos "por proveedor" en `ProductsService` — VERIFIED.
4. `products.controller.ts:520` endpoint `suppliers/:id/products` — VERIFIED.
5. `product-supplier-offers.service.ts:37-43` `listOffers` — VERIFIED.
6. `tab-proveedor-stock.tsx` `startEditAgreed`/`handleSaveAgreed` (~370-394) y `offer.supplier?.name` en `<span>` (~419) — VERIFIED, líneas aproximadas correctas.
7. `use-products.ts` `useUpdateSupplierOffer` firma `{productId, offerId, ...}` → `PATCH /v1/products/:productId/supplier-offers/:offerId` — VERIFIED.
8. `product-supplier-offers.service.ts` `buildAgreedFields` re-estampa `agreedAt` solo si cambia — VERIFIED (comentario explícito en línea 389).
9. `articulo-modal.tsx` patrón `role="tablist"`/`role="tab"`/`aria-selected` (~349-371) — VERIFIED.
10. `supplier-table.tsx` `expandedId` (líneas 20,38,44,153-159) — VERIFIED (ya leído completo en sesión).

#### Failures
1. **[Fact Checker]** Fase 3 asumía que `SupplierModal` usa "el mismo primitive M3" compartido — **FALSO**. `supplier-modal.tsx:42-43` es un `<div>` con overlay fijo hand-rolled (sin componente `Dialog` importado), igual que `articulo-modal.tsx`. Además existe un `Sheet` (`@/components/ui/sheet`) ya usado en `proveedores/page.tsx` para el flujo de reasignar productos — dos convenciones distintas coexisten. Resuelto vía interview (ver abajo).

#### Questions & Answers

1. **[Architecture]** La ficha de proveedor (Fase 3) necesita un contenedor modal. ¿Modal centrado hand-rolled (como Artículo/Proveedor actual) o panel lateral `Sheet` (como el flujo de reasignar)?
   - Options: Modal centrado (Recomendado) | Panel lateral (Sheet)
   - **Answer:** Modal centrado
   - **Rationale:** Más ancho para tabla de ofertas + gráfico de histórico; coherente con la ficha de Artículo (6 pestañas ya en ese patrón).

2. **[Scope]** ¿El rol VIEWER debe ver la pestaña "Precios pactados"?
   - Options: Sí, solo lectura (Recomendado) | No, ocultar la pestaña
   - **Answer:** Sí, solo lectura
   - **Rationale:** Consistente con el resto de la app — VIEWER ve datos pero no controles de edición (mismo patrón que otras acciones en `tab-proveedor-stock.tsx`).

3. **[Verification Fix]** Confirmar corrección: `apiClient` ya desenvuelve `{success,data}` (`api-client.ts:111-116`) — `useSupplierOffers` debe usar `res.data` directo, sin `.data.data`.
   - Options: Sí, corregir (Recomendado) | Dejar como duda
   - **Answer:** Sí, corregir

#### Confirmed Decisions
- Contenedor de `SupplierOffersFichaDialog`: modal centrado hand-rolled (mismo patrón de markup que `articulo-modal.tsx`/`supplier-modal.tsx`, NO un componente `Dialog` compartido — no existe tal primitive en este proyecto para este patrón).
- Pestaña "Precios pactados" visible para VIEWER en modo solo-lectura (sin botones de editar/1-clic/limpiar).
- Hook `useSupplierOffers`: `res.data` de `apiClient.get(...)` es directamente el array de ofertas (interceptor ya desenvuelve `{success,data}`), sin `.data.data`.

#### Action Items
- [x] Fase 3: corregir sección Architecture — sustituir "primitive M3 compartido" por "estructura de markup hand-rolled igual a `articulo-modal.tsx`/`supplier-modal.tsx`".
- [x] Fase 3: corregir snippet de `useSupplierOffers` — quitar la duda sobre el shape, usar `res.data` directo.
- [x] Fase 3: añadir requisito explícito de visibilidad VIEWER (solo lectura) en la pestaña "Precios pactados".
- [x] Resueltas sin necesidad de preguntar al usuario (decisiones técnicas de bajo impacto, no de negocio): ubicación del hook `useSupplierOffers` → `use-products.ts` (coubicado con el tipo `ProductSupplierOffer`); ubicación del estado `fichaSupplier` → elevado a `page.tsx` de Proveedores (una sola instancia del diálogo, no una por fila).

#### Impact on Phases
- Phase 3: actualizar Architecture, snippet del hook, Related Code Files (ubicación definitiva del hook y del estado), y Requirements (visibilidad VIEWER).

### Whole-Plan Consistency Sweep
- Files reread: `plan.md`, `phase-01-endpoint-ofertas-por-proveedor.md`, `phase-02-un-clic-y-link-en-art-culos.md`, `phase-03-ficha-proveedor-con-pesta-as.md`.
- Decision deltas checked: 6 (contenedor modal, visibilidad VIEWER, fix apiClient, ubicación hook, ubicación estado ficha, y un hallazgo adicional detectado durante la propagación: la Fase 3 original justificaba el ocultamiento VIEWER como "consistencia con tab-proveedor-stock.tsx", pero `grep -rn "VIEWER|canManage|role" tab-proveedor-stock.tsx` no devolvió nada — ese archivo no tiene gating de rol hoy. Corregido: la Fase 3 ahora cita el precedente real (`proveedores/page.tsx` `canManage`/`MANAGE_ROLES`) y aclara que `AgreedPriceCell.readOnly` es opcional/default-false, sin usarse en la Fase 2).
- Reconciled stale references: 2 ("primitive M3 compartido" en Fase 3; premisa falsa de precedente de gating de rol en Fase 3 Risk Assessment, propagada también a la definición de props en Fase 2 Architecture).
- Unresolved contradictions: 0.
