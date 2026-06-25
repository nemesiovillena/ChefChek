---
phase: 1
title: "Backend"
status: pending
priority: P1
effort: "8-10h"
dependencies: []
---

# Phase 1: Backend APIs & Database

## Overview

Implementar endpoints REST para Suppliers CRUD, funcionalidades extra de Categories, Stock Alerts API, y migración de base de datos para historico de precios.

## Requirements

### Functional
- Endpoints CRUD completos para Suppliers (crear, listar, obtener, actualizar, eliminar)
- Endpoints extra: productos de proveedor, tendencia de precios, contador activos
- Endpoints extra Categories: contador productos, reordenar
- Endpoints Stock Alerts: contadores, filtros
- Validaciones: no eliminar proveedor con productos, ciclos en jerarquía
- Histórico de precios para badges de tendencia

### Non-functional
- Performance: queries < 200ms para endpoints de listado
- Seguridad: AuthGuard + TenantGuard en todos endpoints
- Validación: DTOs con class-validator

## Architecture

```
backend/src/modules/products/
├── products.controller.ts (agregar endpoints suppliers)
├── products.service.ts (agregar lógica suppliers, stock alerts)
├── dto/
│   ├── create-supplier.dto.ts
│   ├── update-supplier.dto.ts
│   ├── supplier-response.dto.ts
│   ├── price-trend.dto.ts
│   └── stock-alert-summary.dto.ts
└── services/
    └── supplier-price-trend.service.ts (nuevo)

backend/src/modules/categories/
├── categories.controller.ts (agregar endpoints extras)
└── categories.service.ts (agregar lógica extra)

backend/prisma/
├── schema.prisma (agregar SupplierPriceHistory)
└── migrations/ (crear migration)
```

## Related Code Files

### Create
- `backend/prisma/migrations/xxx_supplier_price_history/migration.sql`
- `backend/src/modules/products/dto/create-supplier.dto.ts`
- `backend/src/modules/products/dto/update-supplier.dto.ts`
- `backend/src/modules/products/dto/supplier-response.dto.ts`
- `backend/src/modules/products/dto/price-trend.dto.ts`
- `backend/src/modules/products/dto/stock-alert-summary.dto.ts`
- `backend/src/modules/products/services/supplier-price-trend.service.ts`

### Modify
- `backend/prisma/schema.prisma`
- `backend/src/modules/products/products.controller.ts`
- `backend/src/modules/products/products.service.ts`
- `backend/src/modules/categories/categories.controller.ts`
- `backend/src/modules/categories/categories.service.ts`

## Implementation Steps

### Step 1: Database Migration - SupplierPriceHistory (1h)

1. Agregar modelo `SupplierPriceHistory` a `prisma/schema.prisma`:
```prisma
model SupplierPriceHistory {
  id          String   @id @default(cuid())
  tenantId    String
  supplierId  String
  averagePrice Float
  recordDate  DateTime @default(now())

  supplier Supplier @relation(fields: [supplierId], references: [id], onDelete: Cascade)
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([supplierId])
  @@index([tenantId])
  @@index([recordDate])
}
```

2. Agregar relación a `Supplier` model:
```prisma
model Supplier {
  // ... existing fields
  priceHistory SupplierPriceHistory[]
}
```

3. Crear migration: `npx prisma migrate dev --name supplier_price_history`
4. Generar client: `npx prisma generate`

### Step 2: Suppliers DTOs (1h)

1. Crear `dto/create-supplier.dto.ts` con campos:
   - name (required)
   - contactPerson, email, phone, website
   - averageDeliveryTime, reliabilityScore
   - priceTier (enum: LOW, MEDIUM, HIGH)
   - preferredStatus (enum: PREFERRED, ALTERNATIVE, EXCLUDED)
   - orderMethods (array: EMAIL, PHONE, WEB)
   - isActive (default: true)

2. Crear `dto/update-supplier.dto.ts` (todos campos opcionales)

3. Crear `dto/supplier-response.dto.ts` con campos de Supplier

4. Crear `dto/price-trend.dto.ts`:
```typescript
export class PriceTrendDto {
  status: 'increased' | 'decreased' | 'stable';
  percentage: number;
  lastPrice: number;
  currentPrice: number;
}
```

5. Crear `dto/stock-alert-summary.dto.ts`:
```typescript
export class StockAlertSummaryDto {
  total: number;
  low: number;      // quantity <= minimumStock && quantity > 0
  empty: number;    // quantity <= 0
}
```

### Step 3: Suppliers CRUD Endpoints (3h)

1. `GET /v1/products/suppliers` - Listar todos los proveedores del tenant
   - Query params: `?isActive=true` (opcional, filtro)
   - @UseGuards(AuthGuard, TenantGuard)
   - Retorna array de SupplierResponseDto

2. `POST /v1/products/suppliers` - Crear proveedor
   - Body: CreateSupplierDto
   - @UseGuards(AuthGuard, TenantGuard)
   - Retorna SupplierResponseDto

3. `GET /v1/products/suppliers/:id` - Obtener proveedor por ID
   - Validar que pertenezca al tenant del usuario
   - Retorna SupplierResponseDto

4. `PUT /v1/products/suppliers/:id` - Actualizar proveedor
   - Body: UpdateSupplierDto
   - Validar tenant ownership
   - Retorna SupplierResponseDto

5. `DELETE /v1/products/suppliers/:id` - Eliminar proveedor
   - Validar tenant ownership
   - Validar que NO tenga productos asociados (throw error si sí)
   - Retorna success message

6. `GET /v1/products/suppliers/stats/active-count` - Contador de proveedores activos
   - Retorna `{ count: number }`

### Step 4: Suppliers Extra Endpoints (2h)

1. `GET /v1/products/suppliers/:id/products` - Productos del proveedor
   - Query: `?page=1&limit=20`
   - Validar tenant ownership
   - Retorna paginated array de productos

2. `GET /v1/products/suppliers/:id/price-trend` - Tendencia de precio
   - Crear servicio `SupplierPriceTrendService.calculateTrend(supplierId)`
   - Lógica:
     ```typescript
     // Obtener productos del proveedor
     const products = await prisma.product.findMany({
       where: { supplierId },
       select: { purchasePrice: true, updatedAt: true }
     });

     if (products.length === 0) return { status: 'stable', ... };

     // Precio promedio actual
     const currentAvg = products.reduce((sum, p) => sum + p.purchasePrice, 0) / products.length;

     // Obtener último registro de historico
     const lastHistory = await prisma.supplierPriceHistory.findFirst({
       where: { supplierId },
       orderBy: { recordDate: 'desc' }
     });

     if (!lastHistory) {
       // Crear primer registro histórico
       await prisma.supplierPriceHistory.create({
         data: { tenantId, supplierId, averagePrice: currentAvg }
       });
       return { status: 'stable', percentage: 0, lastPrice: currentAvg, currentPrice: currentAvg };
     }

     // Calcular diferencia
     const diff = ((currentAvg - lastHistory.averagePrice) / lastHistory.averagePrice) * 100;

     // Crear nuevo registro histórico si es significativo (cada 24h o > 5% cambio)
     const shouldRecord = Date.now() - lastHistory.recordDate.getTime() > 86400000 || Math.abs(diff) > 5;

     if (shouldRecord) {
       await prisma.supplierPriceHistory.create({
         data: { tenantId, supplierId, averagePrice: currentAvg }
       });
     }

     return {
       status: diff > 0 ? 'increased' : diff < 0 ? 'decreased' : 'stable',
       percentage: Math.abs(diff),
       lastPrice: lastHistory.averagePrice,
       currentPrice: currentAvg
     };
     ```

### Step 5: Stock Alerts Endpoints (1h)

1. `GET /v1/products/stock-status/count` - Resumen alertas stock
   - Validar tenant scope
   - Query: Agrupar por stockStatus
   - Retorna StockAlertSummaryDto:
     ```typescript
     const products = await prisma.product.findMany({
       where: { tenantId, isActive: true },
       include: { stocks: { take: 1 } }
     });

     let low = 0, empty = 0;
     products.forEach(p => {
       const qty = p.stocks[0]?.quantity ?? 0;
       const min = p.stocks[0]?.minimumStock ?? 0;
       if (qty <= 0) empty++;
       else if (qty <= min) low++;
     });

     return { total: products.length, low, empty };
     ```

2. `GET /v1/products?stockStatus=low` - Filtrar productos por stock bajo/agotado
   - Query param `stockStatus`: "low" (low + empty), "empty" (empty only)
   - Integrar con query existente de `GET /v1/products`
   - Agregar filtro en `findMany`:

```typescript
const where: Prisma.ProductWhereInput = { tenantId, isActive: true };

if (stockStatus === 'low') {
  where.stocks = {
    some: {
      OR: [
        { quantity: { lte: 0 } },
        { AND: [
            { quantity: { gt: 0 } },
            { quantity: { lte: prisma.raw('"minimumStock"') } }
        ]}
      ]
    }
  };
}
```

### Step 6: Categories Extra Endpoints (1h)

1. `GET /v1/products/categories/:id/product-count` - Contador de productos en categoría
   - Incluir subcategorías recursivamente
   - Query productos con categoryId o categoryId en descendientes
   - Retorna `{ count: number }`

2. `POST /v1/products/categories/reorder` - Reordenar categorías
   - Body: `{ updates: Array<{ id: string, sortOrder: number, parentId?: string }> }`
   - Validar ciclos en jerarquía (no ancestro como descendiente)
   - Transaction: actualizar sortOrder en batch
   - Retorna success message

3. `PATCH /v1/products/categories/:id/toggle-active` - Toggle estado activo
   - Alternar `isActive` boolean
   - Retorna updated Category

### Step 7: Unit Tests (1h)

1. Testear endpoints Suppliers CRUD (5 tests)
2. Testear price trend calculation (3 tests)
3. Testear stock alerts count (2 tests)
4. Testear categorías extra (3 tests)
5. Testear validaciones (no eliminar proveedor con productos, ciclos jerarquía)

## Success Criteria

- [ ] Tabla SupplierPriceHistory creada en DB
- [ ] Endpoints Suppliers CRUD funcionando (testeados)
- [ ] Endpoint price-trend calcula y guarda historico
- [ ] Endpoints stock-alerts retornan contadores correctos
- [ ] Endpoints categories extras funcionando
- [ ] Validaciones aplicadas (no eliminar proveedor con productos)
- [ ] Todos los tests unitarios pasan
- [ ] API docs generadas (Swagger/OpenAPI)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Migration falla en prod | Low | High | Testar en staging primero |
| Price trend query lento | Medium | Medium | Indexar supplierId + recordDate |
| Validación ciclos compleja | Low | Medium | Usar algoritmo DFS para detectar |

## Related Files in Other Phases

- Phase 2: Cards usan endpoints de contadores
- Phase 3: Modals usan endpoints CRUD y extras