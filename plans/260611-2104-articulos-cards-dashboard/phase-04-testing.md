---
phase: 4
title: "Testing"
status: pending
priority: P3
effort: "4-6h"
dependencies: [1, 2, 3]
---

# Phase 4: Testing & Quality Assurance

## Overview

Validar implementación completa de cards dashboard con tests unitarios (backend), tests E2E (frontend), testing responsive, accessibility checks, y pruebas manuales de flujo completo.

## Requirements

### Functional
- Todos los tests unitarios backend pasan (Suppliers, Stock Alerts, Categories)
- Tests E2E frontend pasan (navegación, interacción, filtros)
- Validar responsive design (mobile, tablet, desktop)
- Validar accesibilidad (keyboard navigation, screen readers)
- Pruebas manuales de flujo completo

### Non-functional
- Performance: cards cargan < 500ms, modals abren < 200ms
- No errores TypeScript en build
- No warnings de ESLint
- Code coverage > 80% para nuevos endpoints

## Architecture

```
Testing Pyramid:
       /\
      /E2E\     - 5 tests (Playwright)
     /------\
    /  Frontend \ - 10 tests (Vitest + React Testing Library)
   /------------\
  /  Backend    \ - 13 tests unitarios
 /----------------\
```

## Related Code Files

### Create
- `backend/src/modules/products/products.controller.spec.ts` (agregar tests suppliers)
- `backend/src/modules/categories/categories.controller.spec.ts` (agregar tests extras)
- `frontend/src/app/dashboard/articulos/__tests__/dashboard-cards.test.tsx`
- `frontend/src/app/dashboard/articulos/__tests__/suppliers-modal.test.tsx`
- `frontend/src/app/dashboard/articulos/__tests__/categories-modal.test.tsx`

### Modify
- `backend/src/modules/products/` (tests existentes)
- `frontend/src/app/dashboard/articulos/` (agregar tests)

## Implementation Steps

### Step 1: Backend Unit Tests - Suppliers CRUD (2h)

1. Agregar tests en `backend/src/modules/products/products.controller.spec.ts`:

```typescript
describe('Suppliers CRUD', () => {
  let supplierId: string;

  it('should create a new supplier', async () => {
    const createDto: CreateSupplierDto = {
      name: 'Test Supplier',
      contactPerson: 'John Doe',
      email: 'test@supplier.com',
      averageDeliveryTime: 3,
      reliabilityScore: 85,
      priceTier: 'MEDIUM',
      preferredStatus: 'ALTERNATIVE',
      orderMethods: ['EMAIL'],
      isActive: true
    };

    const response = await request(app.getHttpServer())
      .post('/v1/products/suppliers')
      .set('Authorization', `Bearer ${authToken}`)
      .send(createDto)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe(createDto.name);
    supplierId = response.body.id;
  });

  it('should list all suppliers for tenant', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/products/suppliers')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it('should get supplier by ID', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/products/suppliers/${supplierId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.id).toBe(supplierId);
  });

  it('should update supplier', async () => {
    const updateDto: UpdateSupplierDto = {
      name: 'Updated Supplier'
    };

    const response = await request(app.getHttpServer())
      .put(`/v1/products/suppliers/${supplierId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateDto)
      .expect(200);

    expect(response.body.name).toBe(updateDto.name);
  });

  it('should delete supplier', async () => {
    await request(app.getHttpServer())
      .delete(`/v1/products/suppliers/${supplierId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/v1/products/suppliers/${supplierId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
  });

  it('should not delete supplier with products', async () => {
    // Crear supplier con producto asociado
    const supplier = await prisma.supplier.create({
      data: { tenantId, name: 'Supplier with Products', isActive: true }
    });

    await prisma.product.create({
      data: {
        tenantId,
        name: 'Test Product',
        supplierId: supplier.id,
        purchaseUnit: 'kg',
        storageUnit: 'kg',
        recipeUnit: 'kg',
        purchasePrice: 10,
        netPrice: 10
      }
    });

    await request(app.getHttpServer())
      .delete(`/v1/products/suppliers/${supplier.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    // Cleanup
    await prisma.supplier.delete({ where: { id: supplier.id } });
  });
});
```

### Step 2: Backend Unit Tests - Stock Alerts & Extras (1h)

1. Agregar tests de stock alerts:

```typescript
describe('Stock Alerts', () => {
  it('should return stock alert summary', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/products/stock-status/count')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('low');
    expect(response.body).toHaveProperty('empty');
    expect(typeof response.body.total).toBe('number');
  });

  it('should filter products by stock status low', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/products?stockStatus=low')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const products = response.body.data || response.body;
    if (Array.isArray(products)) {
      products.forEach((product: any) => {
        expect(product.stocks).toBeDefined();
        expect(product.stocks[0]?.quantity).toBeLessThanOrEqual(product.stocks[0]?.minimumStock);
      });
    }
  });

  it('should filter products by stock status empty', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/products?stockStatus=empty')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const products = response.body.data || response.body;
    if (Array.isArray(products)) {
      products.forEach((product: any) => {
        expect(product.stocks[0]?.quantity).toBeLessThanOrEqual(0);
      });
    }
  });
});
```

2. Agregar tests de price trend:

```typescript
describe('Supplier Price Trend', () => {
  let supplierId: string;

  beforeAll(async () => {
    const supplier = await prisma.supplier.create({
      data: { tenantId, name: 'Trend Test Supplier', isActive: true }
    });
    supplierId = supplier.id;

    // Crear productos
    await prisma.product.createMany({
      data: [
        {
          tenantId,
          name: 'Product 1',
          supplierId,
          purchaseUnit: 'kg',
          storageUnit: 'kg',
          recipeUnit: 'kg',
          purchasePrice: 10,
          netPrice: 10
        },
        {
          tenantId,
          name: 'Product 2',
          supplierId,
          purchaseUnit: 'kg',
          storageUnit: 'kg',
          recipeUnit: 'kg',
          purchasePrice: 20,
          netPrice: 20
        }
      ]
    });
  });

  afterAll(async () => {
    await prisma.supplier.delete({ where: { id: supplierId } });
  });

  it('should calculate price trend - stable (first time)', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/products/suppliers/${supplierId}/price-trend`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('status', 'stable');
    expect(response.body.currentPrice).toBe(15); // (10 + 20) / 2
    expect(response.body.lastPrice).toBe(15);
  });

  it('should detect price increase', async () => {
    // Actualizar precios
    await prisma.product.updateMany({
      where: { supplierId },
      data: { purchasePrice: 20 } // Subir de 10,20 a 20,20 (avg: 15→20)
    });

    const response = await request(app.getHttpServer())
      .get(`/v1/products/suppliers/${supplierId}/price-trend`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.status).toBe('increased');
    expect(response.body.percentage).toBeCloseTo(33.33, 1);
  });
});
```

### Step 3: Frontend Component Tests - Cards (1h)

1. Crear `frontend/src/app/dashboard/articulos/__tests__/dashboard-cards.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArticlesSummaryCard, SuppliersSummaryCard, CategoriesSummaryCard, StockAlertsCard } from '../components/dashboard-cards';

const queryClient = new QueryClient();

describe('Dashboard Cards', () => {
  describe('ArticlesSummaryCard', () => {
    it('renders article count correctly', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <ArticlesSummaryCard
            articleCount={42}
            onCreateArticle={jest.fn()}
            onOpenAlbaranUpload={jest.fn()}
          />
        </QueryClientProvider>
      );

      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('Artículos totales')).toBeInTheDocument();
    });

    it('calls onCreateArticle when clicking add button', () => {
      const onCreateArticle = jest.fn();
      render(
        <QueryClientProvider client={queryClient}>
          <ArticlesSummaryCard
            articleCount={42}
            onCreateArticle={onCreateArticle}
            onOpenAlbaranUpload={jest.fn()}
          />
        </QueryClientProvider>
      );

      fireEvent.click(screen.getByText('Añadir'));
      expect(onCreateArticle).toHaveBeenCalledTimes(1);
    });

    it('calls onOpenAlbaranUpload when clicking albaran button', () => {
      const onOpenAlbaranUpload = jest.fn();
      render(
        <QueryClientProvider client={queryClient}>
          <ArticlesSummaryCard
            articleCount={42}
            onCreateArticle={jest.fn()}
            onOpenAlbaranUpload={onOpenAlbaranUpload}
          />
        </QueryClientProvider>
      );

      fireEvent.click(screen.getByText('Albarán'));
      expect(onOpenAlbaranUpload).toHaveBeenCalledTimes(1);
    });
  });

  describe('StockAlertsCard', () => {
    it('renders alert counts correctly', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <StockAlertsCard
            stockAlerts={{ low: 5, empty: 2 }}
            onViewAlerts={jest.fn()}
          />
        </QueryClientProvider>
      );

      expect(screen.getByText('7')).toBeInTheDocument(); // 5 + 2
      expect(screen.getByText('2')).toBeInTheDocument(); // empty
      expect(screen.getByText('5')).toBeInTheDocument(); // low
    });

    it('calls onViewAlerts when clicked', () => {
      const onViewAlerts = jest.fn();
      render(
        <QueryClientProvider client={queryClient}>
          <StockAlertsCard
            stockAlerts={{ low: 5, empty: 2 }}
            onViewAlerts={onViewAlerts}
          />
        </QueryClientProvider>
      );

      fireEvent.click(screen.getByText('Ver alertas'));
      expect(onViewAlerts).toHaveBeenCalledTimes(1);
    });
  });
});
```

### Step 4: Frontend E2E Tests - Playwright (1.5h)

1. Crear `frontend/e2e/articulos-cards.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Artículos Dashboard Cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/articulos');
    await page.waitForLoadState('networkidle');
  });

  test('should display all 4 cards', async ({ page }) => {
    // Check card elements are visible
    await expect(page.locator('text=Artículos totales')).toBeVisible();
    await expect(page.locator('text=Proveedores activos')).toBeVisible();
    await expect(page.locator('text=Categorías')).toBeVisible();
    await expect(page.locator('text=Alertas de stock')).toBeVisible();
  });

  test('should open suppliers modal when clicking suppliers card', async ({ page }) => {
    await page.click('text=Gestionar proveedores');
    await expect(page.locator('text=Gestión de Proveedores')).toBeVisible();
  });

  test('should open categories modal when clicking categories card', async ({ page }) => {
    await page.click('text=Gestionar categorías');
    await expect(page.locator('text=Gestión de Categorías')).toBeVisible();
  });

  test('should filter products by low stock when clicking stock alerts card', async ({ page }) => {
    await page.click('text=Ver alertas');
    // Check that stock filter is applied
    // This depends on implementation - adjust selector accordingly
    await expect(page.locator('[data-testid="stock-filter-low"]')).toBeVisible();
  });
});

test.describe('Suppliers Management Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/articulos');
    await page.click('text=Gestionar proveedores');
  });

  test('should create new supplier', async ({ page }) => {
    await page.click('text=Nuevo proveedor');
    await page.fill('input[name="name"]', 'Test Supplier');
    await page.click('text=Crear');
    await expect(page.locator('text=Test Supplier')).toBeVisible();
  });

  test('should delete supplier', async ({ page }) => {
    const supplierName = 'Supplier to Delete';
    await page.click('text=Nuevo proveedor');
    await page.fill('input[name="name"]', supplierName);
    await page.click('text=Crear');

    await page.click(`text=${supplierName} >> .. >> button:has-text("Eliminar")`);
    page.on('dialog', dialog => dialog.accept());
    await expect(page.locator(`text=${supplierName}`)).not.toBeVisible();
  });
});

test.describe('Categories Management Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/articulos');
    await page.click('text=Gestionar categorías');
  });

  test('should display category tree', async ({ page }) => {
    await expect(page.locator('text=Árbol')).toBeVisible();
  });

  test('should create new category', async ({ page }) => {
    await page.click('text=Nueva categoría');
    await page.fill('input[name="name"]', 'Test Category');
    await page.click('text=Crear');
    await expect(page.locator('text=Test Category')).toBeVisible();
  });
});
```

### Step 5: Manual Testing Checklist (30m)

1. **Cards Dashboard**:
   - [ ] Cards visible en desktop (4 columnas)
   - [ ] Cards visible en tablet (2 columnas)
   - [ ] Cards visible en móvil (1 columna)
   - [ ] Contadores se actualizan en tiempo real
   - [ ] Hover states funcionan

2. **Suppliers Management**:
   - [ ] Listado muestra todos los proveedores
   - [ ] Badges de precio correctos
   - [ ] Crear proveedor funciona
   - [ ] Editar proveedor funciona
   - [ ] Eliminar proveedor (sin productos) funciona
   - [ ] Eliminar proveedor (con productos) muestra error
   - [ ] Toggle activo funciona
   - [ ] Ver productos filtra tabla

3. **Categories Management**:
   - [ ] Árbol jerárquico se muestra
   - [ ] Solo categorías context="articles"
   - [ ] Crear categoría funciona
   - [ ] Editar categoría funciona
   - [ ] Eliminar categoría funciona
   - [ ] Icono y color se guardan

4. **Stock Alerts**:
   - [ ] Click filtra tabla por stock bajo
   - [ ] Contadores correctos
   - [ ] Tooltip funciona

### Step 6: Responsive Testing (30m)

1. Test en browser devtools:
   - **Mobile** (375px): 1 columna, botones touch-friendly
   - **Tablet** (768px): 2 columnas, modals full-screen
   - **Desktop** (1280px): 4 columnas, modals centrados

2. Verificar:
   - [ ] Cards no se rompen en mobile
   - [ ] Modals full-screen en mobile
   - [ ] Touch targets >= 44px
   - [ ] Texto legible en todos los tamaños

### Step 7: Accessibility Testing (30m)

1. Keyboard navigation:
   - [ ] Tab navega entre cards
   - [ ] Enter/Space activa botones
   - [ ] Escape cierra modals
   - [ ] Focus visible en elementos interactivos

2. Screen readers (verificar con VoiceOver/NVDA):
   - [ ] Cards tienen aria labels
   - [ ] Badges describen estado
   - [ ] Tablas tienen captions
   - [ ] Forms tienen labels

### Step 8: Performance Testing (30m)

1. Medir tiempos con DevTools:
   - [ ] Cards cargan < 500ms
   - [ ] Modals abren < 200ms
   - [ ] Filtros aplican < 300ms
   - [ ] TanStack Query cache funciona

2. Lighthouse:
   - [ ] Performance score > 90
   - [ ] Accessibility score > 90
   - [ ] Best Practices score > 90

### Step 9: Final Verification (30m)

1. TypeScript compilation:
   ```bash
   cd backend && npm run build
   cd frontend && npm run build
   ```

2. ESLint:
   ```bash
   cd backend && npm run lint
   cd frontend && npm run lint
   ```

3. All tests:
   ```bash
   cd backend && npm test
   cd frontend && npm test
   ```

4. Code coverage:
   ```bash
   cd backend && npm run test:cov
   # Verify coverage > 80% for new endpoints
   ```

## Success Criteria

- [ ] Todos los tests unitarios backend pasan (13 tests)
- [ ] Todos los tests E2E frontend pasan (5 tests)
- [ ] Tests manuales completados sin issues críticos
- [ ] Responsive design funciona en mobile/tablet/desktop
- [ ] Accessibility score > 90 en Lighthouse
- [ ] Performance score > 90 en Lighthouse
- [ ] No errores TypeScript en build
- [ ] No warnings de ESLint
- [ ] Code coverage > 80% para nuevos endpoints
- [ ] Flujo completo funciona (cards → modals → tablas)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tests E2E flaky | Medium | Low | Usar waitFor fixtures |
| Responsive no funciona | Low | Medium | Testar en múltiples devices |
| Performance baja | Low | Medium | Optimizar queries si necesario |

## Related Files in Other Phases

- Phase 1: Tests de unitarios backend
- Phase 2: Tests de componentes cards
- Phase 3: Tests de modals y forms