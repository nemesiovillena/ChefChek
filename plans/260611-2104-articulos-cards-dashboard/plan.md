---
title: "Artículos Cards Dashboard - 4 Stats Cards"
description: "Implementar 4 cards informativas en sección Artículos: artículos totales, proveedores activos con gestión completa, categorías con jerarquía, alertas de stock"
status: pending
priority: P2
branch: "develop"
tags: [frontend, dashboard, cards, suppliers, categories, stock-alerts]
effort: "26-34h"
created: "2026-06-11T19:04:45.667Z"
createdBy: "ck:plan"
source: skill
---

# Artículos Cards Dashboard - 4 Stats Cards

## Overview

Implementar dashboard con 4 cards informativas en la página de Artículos para mejorar UX y facilitar acceso a operaciones frecuentes. Las cards incluyen: contador de artículos totales + botones de acción, gestión de proveedores con badges de tendencia de precio, gestión jerárquica de categorías, y alertas de stock bajo/agotado.

Referencia: [PDR completo](../../docs/pdr-articulos-cards-dashboard.md)

## Arquitectura

```
frontend/src/app/dashboard/articulos/page.tsx
├── DashboardCardsSection (grid 4 cols)
│   ├── ArticlesSummaryCard
│   ├── SuppliersSummaryCard → SuppliersManagementModal
│   ├── CategoriesSummaryCard → CategoriesManagementModal
│   └── StockAlertsCard (click filtra tabla)
└── Existing components (table, filters, drawers)
```

Backend endpoints nuevos:
- Suppliers CRUD: `GET/POST/PUT/DELETE /v1/products/suppliers`
- Suppliers extras: `GET /v1/products/suppliers/:id/products`, `/v1/products/suppliers/:id/price-trend`, `/v1/products/suppliers/stats/active-count`
- Categories extras: `GET /v1/products/categories/:id/product-count`, `POST /v1/products/categories/reorder`
- Stock alerts: `GET /v1/products/stock-status/count`, `GET /v1/products?stockStatus=low`

Database: Crear tabla `SupplierPriceHistory` para seguimiento de precios

## Phases

| Phase | Name | Status | Effort |
|-------|------|--------|--------|
| 1 | [Backend](./phase-01-backend.md) | Pending | 8-10h |
| 2 | [Frontend Cards](./phase-02-frontend-cards.md) | Pending | 4-6h |
| 3 | [Frontend Modals](./phase-03-frontend-modals.md) | Pending | 8-10h |
| 4 | [Testing](./phase-04-testing.md) | Pending | 4-6h |

## Dependencies

```
Phase 1 (Backend) → Phase 2 (Cards) → Phase 3 (Modals) → Phase 4 (Testing)
```

- Fase 2 depende de Fase 1: Cards necesitan endpoints de contadores
- Fase 3 depende de Fase 1: Modals necesitan endpoints CRUD
- Fase 4 depende de Fases 1-3: Testing requiere código completo

## Related Code Files

### Backend
- Create: `backend/prisma/migrations/xxx_supplier_price_history`
- Create: `backend/src/modules/products/dto/supplier*.dto.ts`
- Create: `backend/src/modules/products/dto/stock-alert.dto.ts`
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/modules/products/products.controller.ts`
- Modify: `backend/src/modules/products/products.service.ts`
- Modify: `backend/src/modules/categories/categories.controller.ts`
- Modify: `backend/src/modules/categories/categories.service.ts`

### Frontend
- Create: `frontend/src/app/dashboard/articulos/components/dashboard-cards/*.tsx`
- Create: `frontend/src/app/dashboard/articulos/components/suppliers-management-modal.tsx`
- Create: `frontend/src/app/dashboard/articulos/components/categories-management-modal.tsx`
- Modify: `frontend/src/app/dashboard/articulos/page.tsx`
- Modify: `frontend/src/hooks/use-suppliers.ts` (crear)
- Modify: `frontend/src/hooks/use-categories.ts`

## Success Criteria

- [ ] 4 cards visibles en grid responsive (desktop 4, tablet 2, mobile 1)
- [ ] Card 1: Contador artículos actualiza en tiempo real, botones funcionales
- [ ] Card 2: Modal gestión proveedores completo (CRUD + price trends + ver artículos)
- [ ] Card 3: Modal gestión categorías jerárquico (árbol + CRUD + reordenar)
- [ ] Card 4: Alertas de stock funcionan, click filtra tabla
- [ ] Badges de precio: 🔴↑ (subió), 🟢↓ (bajó), ⚪ (sin cambios)
- [ ] No errores TypeScript
- [ ] Tests unitarios pasan (backend)
- [ ] Tests E2E pasan (frontend)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Endpoints Suppliers incompletos | Medium | High | Implementar CRUD completo en Fase 1 |
| Historico precios no existe | High | High | Crear tabla SupplierPriceHistory en migration |
| Performance modals con muchos registros | Medium | Low | Implementar paginación en Fase 3 |
| Validación ciclos jerarquía categorías | Low | Medium | Usar lógica existente useCategoryTree |

## Notes

- Decisiones por defecto tomadas por usuario:
  - Card 4: Alertas de Stock (aceptado)
  - Histórico precios: Crear tabla SupplierPriceHistory
  - Eliminar proveedores: No permitir si tiene productos
  - Icon picker: Iconos Lucide predefinidos (sin librerías extra)
- PDR referencia: `docs/pdr-articulos-cards-dashboard.md`