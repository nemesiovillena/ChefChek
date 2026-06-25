---
phase: 2
title: "Frontend Cards"
status: pending
priority: P2
effort: "4-6h"
dependencies: [1]
---

# Phase 2: Frontend Cards Components

## Overview

Crear 4 componentes de cards informativas: Articles Summary, Suppliers Summary, Categories Summary, Stock Alerts. Integrar en página Artículos con layout grid responsive.

## Requirements

### Functional
- 4 cards en grid responsive (4 cols desktop, 2 tablet, 1 mobile)
- Card 1: Contador artículos + botón "Añadir artículo" + botón "Añadir desde albarán"
- Card 2: Contador proveedores activos + botón "Gestionar proveedores"
- Card 3: Contador categorías + botón "Gestionar categorías"
- Card 4: Contador alertas stock (rojo: agotados, amarillo: bajo) + click filtra tabla
- Contadores actualizan en tiempo real (TanStack Query refetch automático)
- Click en cards relevantes abre modals o filtra vista

### Non-functional
- Performance: carga inicial < 500ms
- Responsive: breakpoint sm (640px), lg (1024px)
- Consistencia: estilo shadcn/ui, colores del sistema
- Accessibility: keyboard navigation, aria labels

## Architecture

```
frontend/src/app/dashboard/articulos/
├── page.tsx (modificar: añadir DashboardCardsSection antes de toolbar)
└── components/
    └── dashboard-cards/
        ├── articles-summary-card.tsx
        ├── suppliers-summary-card.tsx
        ├── categories-summary-card.tsx
        └── stock-alerts-card.tsx

frontend/src/hooks/
└── use-suppliers.ts (crear nuevo)
```

Data flow:
```
DashboardCardsSection
├── useProducts() → contador artículos
├── useSuppliers() → contador proveedores + endpoint stats
├── useCategories() → contador categorías
└── useStockAlerts() → contadores stock bajo/agotado
```

## Related Code Files

### Create
- `frontend/src/app/dashboard/articulos/components/dashboard-cards/articles-summary-card.tsx`
- `frontend/src/app/dashboard/articulos/components/dashboard-cards/suppliers-summary-card.tsx`
- `frontend/src/app/dashboard/articulos/components/dashboard-cards/categories-summary-card.tsx`
- `frontend/src/app/dashboard/articulos/components/dashboard-cards/stock-alerts-card.tsx`
- `frontend/src/hooks/use-suppliers.ts`
- `frontend/src/hooks/use-stock-alerts.ts`

### Modify
- `frontend/src/app/dashboard/articulos/page.tsx`

## Implementation Steps

### Step 1: Create useSuppliers Hook (1h)

1. Crear `frontend/src/hooks/use-suppliers.ts`:
```typescript
import { useQuery } from '@tanstack/react-query';

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  // ... otros campos
}

export function useSuppliers(options?: { isActive?: boolean }) {
  return useQuery<Supplier[]>({
    queryKey: ['suppliers', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.isActive !== undefined) params.append('isActive', String(options.isActive));

      const res = await fetch(`/api/v1/products/suppliers?${params}`);
      if (!res.ok) throw new Error('Failed to fetch suppliers');
      return res.json();
    }
  });
}

export function useSuppliersStats() {
  return useQuery<{ count: number }>({
    queryKey: ['suppliers', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/v1/products/suppliers/stats/active-count');
      if (!res.ok) throw new Error('Failed to fetch suppliers stats');
      return res.json();
    }
  });
}
```

### Step 2: Create useStockAlerts Hook (30m)

1. Crear `frontend/src/hooks/use-stock-alerts.ts`:
```typescript
import { useQuery } from '@tanstack/react-query';

export interface StockAlertSummary {
  total: number;
  low: number;
  empty: number;
}

export function useStockAlerts() {
  return useQuery<StockAlertSummary>({
    queryKey: ['stock-alerts'],
    queryFn: async () => {
      const res = await fetch('/api/v1/products/stock-status/count');
      if (!res.ok) throw new Error('Failed to fetch stock alerts');
      return res.json();
    }
  });
}
```

### Step 3: Articles Summary Card (1h)

1. Crear `components/dashboard-cards/articles-summary-card.tsx`:
```typescript
import { Plus, FileUp, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  articleCount: number;
  onCreateArticle: () => void;
  onOpenAlbaranUpload: () => void;
}

export function ArticlesSummaryCard({ articleCount, onCreateArticle, onOpenAlbaranUpload }: Props) {
  return (
    <div className="bg-white border rounded-lg p-6 hover:shadow-md transition">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Package className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Artículos totales</p>
            <p className="text-3xl font-bold text-gray-900">{articleCount}</p>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={onOpenAlbaranUpload}>
          <FileUp className="h-4 w-4" />
          Albarán
        </Button>
        <Button size="sm" className="flex-1 gap-2" onClick={onCreateArticle}>
          <Plus className="h-4 w-4" />
          Añadir
        </Button>
      </div>
    </div>
  );
}
```

### Step 4: Suppliers Summary Card (1h)

1. Crear `components/dashboard-cards/suppliers-summary-card.tsx`:
```typescript
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  supplierCount: number;
  onManageSuppliers: () => void;
}

export function SuppliersSummaryCard({ supplierCount, onManageSuppliers }: Props) {
  return (
    <div className="bg-white border rounded-lg p-6 hover:shadow-md transition cursor-pointer" onClick={onManageSuppliers}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Proveedores activos</p>
            <p className="text-3xl font-bold text-gray-900">{supplierCount}</p>
          </div>
        </div>
      </div>
      <Button variant="outline" size="sm" className="w-full gap-2">
        <Users className="h-4 w-4" />
        Gestionar proveedores
      </Button>
    </div>
  );
}
```

### Step 5: Categories Summary Card (1h)

1. Crear `components/dashboard-cards/categories-summary-card.tsx`:
```typescript
import { FolderTree } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  categoryCount: number;
  onManageCategories: () => void;
}

export function CategoriesSummaryCard({ categoryCount, onManageCategories }: Props) {
  return (
    <div className="bg-white border rounded-lg p-6 hover:shadow-md transition cursor-pointer" onClick={onManageCategories}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <FolderTree className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Categorías</p>
            <p className="text-3xl font-bold text-gray-900">{categoryCount}</p>
          </div>
        </div>
      </div>
      <Button variant="outline" size="sm" className="w-full gap-2">
        <FolderTree className="h-4 w-4" />
        Gestionar categorías
      </Button>
    </div>
  );
}
```

### Step 6: Stock Alerts Card (1h)

1. Crear `components/dashboard-cards/stock-alerts-card.tsx`:
```typescript
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  stockAlerts: { low: number; empty: number };
  onViewAlerts: () => void;
}

export function StockAlertsCard({ stockAlerts, onViewAlerts }: Props) {
  const total = stockAlerts.low + stockAlerts.empty;
  const hasAlerts = total > 0;

  return (
    <div
      className={`bg-white border rounded-lg p-6 hover:shadow-md transition cursor-pointer ${
        hasAlerts ? 'border-red-200' : ''
      }`}
      onClick={onViewAlerts}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${hasAlerts ? 'bg-red-100' : 'bg-gray-100'}`}>
            <AlertTriangle className={`h-6 w-6 ${hasAlerts ? 'text-red-600' : 'text-gray-600'}`} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Alertas de stock</p>
            <p className={`text-3xl font-bold ${hasAlerts ? 'text-red-600' : 'text-gray-900'}`}>
              {total}
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            Agotados
          </span>
          <span className="font-medium text-red-600">{stockAlerts.empty}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full" />
            Bajo stock
          </span>
          <span className="font-medium text-yellow-600">{stockAlerts.low}</span>
        </div>
      </div>
      <Button variant="outline" size="sm" className="w-full gap-2 mt-4">
        <TrendingDown className="h-4 w-4" />
        Ver alertas
      </Button>
    </div>
  );
}
```

### Step 7: Integrate Cards into Artículos Page (1h)

1. Modificar `frontend/src/app/dashboard/articulos/page.tsx`:

```typescript
// Importar hooks y componentes
import { useSuppliersStats } from '@/hooks/use-suppliers';
import { useStockAlerts } from '@/hooks/use-stock-alerts';
import { ArticlesSummaryCard } from './components/dashboard-cards/articles-summary-card';
import { SuppliersSummaryCard } from './components/dashboard-cards/suppliers-summary-card';
import { CategoriesSummaryCard } from './components/dashboard-cards/categories-summary-card';
import { StockAlertsCard } from './components/dashboard-cards/stock-alerts-card';

// En el componente:
export default function ArticulosPage() {
  // ... existing hooks
  const { data: suppliersStats } = useSuppliersStats();
  const { data: stockAlerts } = useStockAlerts();

  // ... existing state

  // Handlers para cards
  const handleManageSuppliers = () => {
    // TODO: Abrir modal de gestión de proveedores (Phase 3)
    console.log('Open suppliers modal');
  };

  const handleManageCategories = () => {
    // TODO: Abrir modal de gestión de categorías (Phase 3)
    console.log('Open categories modal');
  };

  const handleViewAlerts = () => {
    // Filtrar tabla por stock bajo
    setStockFilter('all'); // Reset first
    setTimeout(() => setStockFilter('low'), 0);
  };

  // ... rest of component

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Page header - EXISTENTE */}
      <div className="bg-white border-b">
        {/* ... existing header */}
      </div>

      {/* NUEVO: Dashboard Cards Section */}
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ArticlesSummaryCard
            articleCount={products.length}
            onCreateArticle={handleCreate}
            onOpenAlbaranUpload={() => setShowAlbaranDrawer(true)}
          />
          <SuppliersSummaryCard
            supplierCount={suppliersStats?.count ?? 0}
            onManageSuppliers={handleManageSuppliers}
          />
          <CategoriesSummaryCard
            categoryCount={allCategories.length}
            onManageCategories={handleManageCategories}
          />
          <StockAlertsCard
            stockAlerts={stockAlerts ?? { low: 0, empty: 0 }}
            onViewAlerts={handleViewAlerts}
          />
        </div>
      </div>

      {/* Toolbar: search + filters - EXISTENTE */}
      <div className="max-w-[1400px] mx-auto px-6 pt-4">
        {/* ... existing toolbar */}
      </div>

      {/* ... rest of existing UI */}
    </div>
  );
}
```

### Step 8: Testing Cards (30m)

1. Verificar contadores correctos:
   - Articles: coincide con filteredProducts.length
   - Suppliers: coincide con useSuppliersStats
   - Categories: coincide con allCategories.length
   - Stock Alerts: coincide con cantidad de productos qty <= min o qty <= 0

2. Verificar clicks:
   - "Añadir artículo" abre drawer existente
   - "Añadir desde albarán" abre drawer existente
   - "Gestionar proveedores" log de pending (preparado para Phase 3)
   - "Gestionar categorías" log de pending (preparado para Phase 3)
   - "Ver alertas" filtra tabla por stock bajo

3. Verificar responsive:
   - Desktop (>=1024px): 4 columnas
   - Tablet (640-1023px): 2 columnas
   - Mobile (<640px): 1 columna

4. Verificar hover states:
   - Cards tienen shadow-md en hover
   - Buttons funcionan en hover

## Success Criteria

- [ ] 4 cards visibles en grid responsive correcto
- [ ] Contadores se actualizan en tiempo real (TanStack Query)
- [ ] Click en botones funciona correctamente
- [ ] Click en cards clickable abre handlers correctos
- [ ] "Ver alertas" filtra tabla por stock bajo
- [ ] No errores TypeScript
- [ ] Loading states mostrados mientras cargan datos
- [ ] Error states manejados si falla API

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Contadores desincronizados | Low | Medium | Refetch automático de TanStack Query |
| Click handlers no implementados | Medium | Low | Logs para Phase 3 preparados |
| Responsive no funciona | Low | Low | Testar breakpoints en browser devtools |

## Related Files in Other Phases

- Phase 1: Endpoints de contadores (products, suppliers, stock alerts)
- Phase 3: Modals de gestión (proveedores, categorías)