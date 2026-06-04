# Sprint 9: Hojas de Pedido Automatizadas - Reporte Inicial

## Estado del Proyecto
- **Fecha:** 2026-05-31
- **Estado:** Iniciando Sprint 9
- **Git:** Rama develop actualizada (commit f342b2b)
- **GitHub:** https://github.com/nemesiovillena/ChefChek
- **Sprint Anterior:** ✅ Sprint 8 COMPLETADO (Control de Producción)
- **Sprint Actual:** 🚀 Sprint 9 INICIANDO (Hojas de Pedido Automatizadas)

## Objetivos Sprint 9
**Meta:** Sistema de generación automática de pedidos basado en inventario y necesidades

### Backend (NestJS) - PENDIENTE
- [ ] Motor de cálculo de necesidades
- [ ] Clasificación por proveedor
- [ ] Clasificación por zona de conservación
- [ ] Generación de plantillas de compra
- [ ] Sistema de optimización

### Frontend - PENDIENTE
- [ ] Generador de pedidos
- [ ] Vista por proveedor
- [ ] Vista por zona de conservación
- [ ] Historial de pedidos
- [ ] Exportación de plantillas

### Documentación - PENDIENTE
- [ ] `docs/automated-order-system.md`
- [ ] `docs/supplier-classification.md`
- [ - `docs/conservation-zone-mapping.md`

## Sistema de Hojas de Pedido

### Concepto Principal

El sistema de hojas de pedido automatizadas analiza el inventario actual, calcula las necesidades de reposición basándose en consumos históricos, pedidos programados y stock mínimo, y genera pedidos organizados automáticamente por proveedor y zona de conservación.

### Flujo del Sistema

```
1. Análisis de Inventario
   ├── Stock actual
   ├── Consumo histórico (7-30 días)
   ├── Pedidos programados
   └── Stock mínimo configurado

2. Cálculo de Necesidades
   ├── Productos bajo stock mínimo
   ├── Proyección de consumo (tasa de uso)
   ├── Pedidos pendientes
   └── Ajuste por eventos programados

3. Clasificación
   ├── Por proveedor
   ├── Por zona de conservación
   ├── Por categoría de producto
   └── Por urgencia

4. Generación de Pedidos
   ├── Agrupación por proveedor
   ├── Optimización de cantidades
   ├── Aplicación de reglas de pedido
   └── Generación de plantillas

5. Revisión y Aprobación
   ├── Vista previa del pedido
   ├── Ajustes manuales
   ├── Aprobación del pedido
   └── Envío a proveedor

6. Seguimiento
   ├── Estado del pedido
   ├── Recepción programada
   ├── Alertas de retraso
   └── Actualización de inventario
```

## Estructura de Datos

### Necesidades de Pedido

```typescript
interface OrderRequirement {
  id: string;
  productId: string;
  productName: string;
  currentStock: number;
  minimumStock: number;
  projectedConsumption: number;        // en período
  requiredQuantity: number;
  suggestedQuantity: number;           // optimizado
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  supplierId: string;
  supplierName: string;
  conservationZone: string;
  category: string;
  unit: string;
  estimatedCost: number;
  lastOrderDate: Date;
  averageDailyConsumption: number;
}
```

### Pedido Automatizado

```typescript
interface AutomatedOrder {
  id: string;
  tenantId: string;
  supplierId: string;
  supplierName: string;
  orderNumber: string;
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'SENT' | 'RECEIVED' | 'CANCELLED';
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  scheduledDelivery?: Date;
  estimatedCost: number;
  createdAt: Date;
  createdBy: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  sentAt?: Date;
  receivedAt?: Date;
  items: OrderItem[];
}

interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  requestedQuantity: number;
  adjustedQuantity?: number;
  unit: string;
  unitPrice: number;
  totalCost: number;
  notes?: string;
  alternativeProducts?: string[];
}
```

### Clasificación por Proveedor

```typescript
interface SupplierClassification {
  supplierId: string;
  supplierName: string;
  categories: string[];
  conservationZones: string[];
  averageDeliveryTime: number;        // días
  reliabilityScore: number;            // 0-100
  priceTier: 'LOW' | 'MEDIUM' | 'HIGH';
  preferredStatus: 'PREFERRED' | 'ALTERNATIVE' | 'EMERGENCY';
  contactInfo: {
    email?: string;
    phone?: string;
    website?: string;
  };
  orderMethods: string[];
}
```

### Zonas de Conservación

```typescript
enum ConservationZone {
  FROZEN = 'FROZEN',                   // Congelado (-18°C)
  REFRIGERATED = 'REFRIGERATED',       // Refrigerado (4°C)
  DRY_GOODS = 'DRY_GOODS',             // Secos (15-20°C)
  AMBIENT = 'AMBIENT',                 // Ambiente (20-25°C)
  SPECIAL = 'SPECIAL',                 // Especiales (varios)
}
```

## Motor de Cálculo de Necesidades

### Algoritmo Principal

```typescript
async calculateOrderRequirements(
  tenantId: string,
  options: CalculationOptions
): Promise<OrderRequirement[]> {
  const requirements: OrderRequirement[] = [];

  // Step 1: Get current inventory
  const currentStock = await this.getCurrentStock(tenantId);

  // Step 2: Get minimum stock levels
  const minimumStock = await this.getMinimumStockLevels(tenantId);

  // Step 3: Get historical consumption data
  const historicalData = await this.getHistoricalConsumption(
    tenantId,
    options.historicalPeriod
  );

  // Step 4: Get scheduled events/orders
  const scheduledEvents = await this.getScheduledEvents(tenantId, options.lookaheadDays);

  // Step 5: Calculate requirements for each product
  const products = await this.prisma.product.findMany({
    where: { tenantId },
  });

  for (const product of products) {
    const requirement = await this.calculateProductRequirement(
      product,
      currentStock,
      minimumStock,
      historicalData,
      scheduledEvents
    );

    if (requirement.requiredQuantity > 0) {
      requirements.push(requirement);
    }
  }

  // Step 6: Apply optimization rules
  return this.optimizeOrderQuantities(requirements);
}

private async calculateProductRequirement(
  product: Product,
  currentStock: StockMap,
  minimumStock: StockMap,
  historicalData: HistoricalData,
  scheduledEvents: ScheduledEvent[]
): Promise<OrderRequirement> {
  const productId = product.id;

  // Current stock
  const stock = currentStock[productId] || 0;

  // Minimum stock requirement
  const minStock = minimumStock[productId] || 0;

  // Calculate average daily consumption
  const avgDailyConsumption = this.calculateAverageConsumption(
    productId,
    historicalData
  );

  // Calculate projected consumption for lookahead period
  const projectedConsumption = this.calculateProjectedConsumption(
    productId,
    scheduledEvents,
    avgDailyConsumption
  );

  // Calculate base requirement
  const baseRequirement = Math.max(0, minStock - stock);

  // Add projected consumption
  const projectedRequirement = baseRequirement + projectedConsumption;

  // Apply safety factor
  const safetyFactor = this.getSafetyFactor(product);
  const adjustedRequirement = projectedRequirement * safetyFactor;

  // Round to package size
  const packageSize = product.packageSize || 1;
  const suggestedQuantity = Math.ceil(adjustedRequirement / packageSize) * packageSize;

  // Calculate urgency
  const urgency = this.calculateUrgency(stock, minStock, projectedConsumption);

  return {
    id: `req-${productId}-${Date.now()}`,
    productId,
    productName: product.name,
    currentStock: stock,
    minimumStock: minStock,
    projectedConsumption,
    requiredQuantity: adjustedRequirement,
    suggestedQuantity,
    urgency,
    supplierId: product.primarySupplierId,
    supplierName: product.primarySupplier?.name || 'Sin proveedor asignado',
    conservationZone: product.conservationZone,
    category: product.category,
    unit: product.unit,
    estimatedCost: product.costPerUnit * suggestedQuantity,
    lastOrderDate: product.lastOrderDate,
    averageDailyConsumption: avgDailyConsumption,
  };
}

private calculateProjectedConsumption(
  productId: string,
  scheduledEvents: ScheduledEvent[],
  avgDailyConsumption: number
): number {
  let projected = 0;

  // Base daily projection
  const lookaheadDays = 7;
  projected += avgDailyConsumption * lookaheadDays;

  // Add consumption from scheduled events
  const eventsUsingProduct = scheduledEvents.filter(
    event => this.eventUsesProduct(event, productId)
  );

  for (const event of eventsUsingProduct) {
    projected += event.estimatedQuantity;
  }

  return projected;
}
```

### Factores de Seguridad

```typescript
interface SafetyFactorConfig {
  productCategory: string;
  conservationZone: string;
  supplierReliability: number;
  baseFactor: number;
  maxFactor: number;
}

const safetyFactors: SafetyFactorConfig[] = [
  {
    productCategory: 'PERISHABLE',
    conservationZone: 'FROZEN',
    supplierReliability: 0.9,
    baseFactor: 1.2,
    maxFactor: 1.5,
  },
  {
    productCategory: 'PERISHABLE',
    conservationZone: 'REFRIGERATED',
    supplierReliability: 0.9,
    baseFactor: 1.3,
    maxFactor: 1.6,
  },
  {
    productCategory: 'DRY_GOODS',
    conservationZone: 'DRY_GOODS',
    supplierReliability: 0.8,
    baseFactor: 1.1,
    maxFactor: 1.3,
  },
  {
    productCategory: 'NON_PERISHABLE',
    conservationZone: 'AMBIENT',
    supplierReliability: 0.9,
    baseFactor: 1.05,
    maxFactor: 1.1,
  },
];

private getSafetyFactor(product: Product): number {
  const config = safetyFactors.find(
    f =>
      f.productCategory === product.category &&
      f.conservationZone === product.conservationZone
  );

  if (!config) {
    return 1.1; // Default safety factor
  }

  // Adjust based on supplier reliability
  const reliabilityAdjustment = (1 - config.supplierReliability) * 0.3;

  return Math.min(config.maxFactor, config.baseFactor + reliabilityAdjustment);
}
```

## Sistema de Clasificación

### Por Proveedor

```typescript
async classifyBySupplier(
  requirements: OrderRequirement[]
): Promise<Map<string, OrderRequirement[]>> {
  const supplierOrders = new Map<string, OrderRequirement[]>();

  for (const requirement of requirements) {
    const supplierId = requirement.supplierId;

    if (!supplierOrders.has(supplierId)) {
      supplierOrders.set(supplierId, []);
    }

    supplierOrders.get(supplierId).push(requirement);
  }

  // Sort by urgency within each supplier
  for (const [supplierId, items] of supplierOrders.entries()) {
    const urgencyOrder = { LOW: 4, MEDIUM: 3, HIGH: 2, CRITICAL: 1 };
    items.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
  }

  return supplierOrders;
}
```

### Por Zona de Conservación

```typescript
async classifyByZone(
  requirements: OrderRequirement[]
): Promise<Map<ConservationZone, OrderRequirement[]>> {
  const zoneOrders = new Map<ConservationZone, OrderRequirement[]>();

  for (const requirement of requirements) {
    const zone = requirement.conservationZone as ConservationZone;

    if (!zoneOrders.has(zone)) {
      zoneOrders.set(zone, []);
    }

    zoneOrders.get(zone).push(requirement);
  }

  // Sort by conservation zone priority
  const zonePriority = {
    FROZEN: 1,
    REFRIGERATED: 2,
    DRY_GOODS: 3,
    AMBIENT: 4,
    SPECIAL: 5,
  };

  const zoneOrder = [...zoneOrders.entries()].sort(
    (a, b) => zonePriority[a[0]] - zonePriority[b[0]]
  );

  return new Map(zoneOrder);
}
```

### Por Categoría

```typescript
async classifyByCategory(
  requirements: OrderRequirement[]
): Promise<Map<string, OrderRequirement[]>> {
  const categoryOrders = new Map<string, OrderRequirement[]>();

  for (const requirement of requirements) {
    const category = requirement.category;

    if (!categoryOrders.has(category)) {
      categoryOrders.set(category, []);
    }

    categoryOrders.get(category).push(requirement);
  }

  return categoryOrders;
}
```

## Generación de Plantillas de Compra

### Estructura de Plantilla

```typescript
interface PurchaseOrderTemplate {
  id: string;
  supplierId: string;
  supplierName: string;
  orderNumber: string;
  generationDate: Date;
  estimatedDelivery?: Date;
  contactInfo: ContactInfo;
  orderItems: TemplateItem[];
  subtotal: number;
  taxes: number;
  shippingCost: number;
  total: number;
  notes: string;
  format: 'PDF' | 'EMAIL' | 'EXCEL';
}

interface TemplateItem {
  productId: string;
  productName: string;
  requestedQuantity: number;
  unit: string;
  unitPrice: number;
  totalCost: number;
  specifications?: string;
  alternativeProducts?: string[];
}
```

### Algoritmo de Optimización

```typescript
async optimizeOrderQuantities(
  requirements: OrderRequirement[]
): Promise<OrderRequirement[]> {
  // Apply optimization rules
  const optimized = requirements.map((req) => {
    const optimized = { ...req };

    // Rule 1: Round to package size
    const product = await this.getProduct(req.productId);
    if (product.packageSize) {
      const packages = Math.ceil(optimized.suggestedQuantity / product.packageSize);
      optimized.suggestedQuantity = packages * product.packageSize;
    }

    // Rule 2: Apply bulk discount thresholds
    if (optimized.suggestedQuantity >= product.bulkDiscountThreshold) {
      optimized.estimatedCost = optimized.estimatedCost * 0.95; // 5% discount
    }

    // Rule 3: Combine with low stock items from same supplier
    const relatedLowStock = await this.findRelatedLowStock(
      req.productId,
      req.supplierId
    );
    if (relatedLowStock.length > 0) {
      // Add related items to optimize shipping
      optimized.relatedItems = relatedLowStock.map(item => ({
        productId: item.productId,
        productName: item.productName,
        suggestedQuantity: item.suggestedQuantity,
        unit: item.unit,
      }));
    }

    return optimized;
  });

  // Rule 4: Remove items below minimum threshold
  const filtered = optimized.filter(req => req.suggestedQuantity >= req.minimumOrderQuantity || 1);

  // Rule 5: Sort by cost-benefit ratio
  return filtered.sort((a, b) => {
    const ratioA = a.projectedConsumption / a.estimatedCost;
    const ratioB = b.projectedConsumption / b.estimatedCost;
    return ratioB - ratioA; // Higher benefit per cost first
  });
}
```

## Sistema de Optimización

### Reglas de Pedido

```typescript
interface OrderRule {
  id: string;
  name: string;
  description: string;
  condition: (req: OrderRequirement) => boolean;
  action: (req: OrderRequirement) => OrderRequirement;
  priority: number;
}

const orderRules: OrderRule[] = [
  {
    id: 'rule-001',
    name: 'Orden mínima por proveedor',
    description: 'Agrupar pedidos pequeños por proveedor',
    condition: (req) => req.suggestedQuantity < 50,
    action: (req) => ({
      ...req,
      suggestedQuantity: 50, // Mínimo 50 unidades
      notes: 'Agrupado con otros productos del mismo proveedor',
    }),
    priority: 1,
  },
  {
    id: 'rule-002',
    name: 'Descuento por volumen',
    description: 'Aplicar descuentos por volumen grande',
    condition: (req) => req.suggestedQuantity >= 100,
    action: (req) => ({
      ...req,
      estimatedCost: req.estimatedCost * 0.9, // 10% descuento
      notes: 'Descuento por volumen aplicado',
    }),
    priority: 2,
  },
  {
    id: 'rule-003',
    name: 'Pedido consolidado',
    description: 'Consolidar pedidos de zonas cercanas',
    condition: (req) => req.conservationZone === 'REFRIGERATED' && req.suggestedQuantity < 30,
    action: (req) => ({
      ...req,
      suggestedQuantity: 30,
      notes: 'Consolidado con otros productos de refrigeración',
    }),
    priority: 3,
  },
  {
    id: 'rule-004',
    name: 'Urgencia de entrega',
    description: 'Priorizar productos urgentes',
    condition: (req) => req.urgency === 'CRITICAL',
    action: (req) => ({
      ...req,
      notes: 'Entrega prioritaria solicitada',
    }),
    priority: 0, // Highest priority
  },
];

async applyOrderRules(requirements: OrderRequirement[]): Promise<OrderRequirement[]> {
  for (const rule of orderRules) {
    for (let i = 0; i < requirements.length; i++) {
      if (rule.condition(requirements[i])) {
        requirements[i] = rule.action(requirements[i]);
      }
    }
  }

  return requirements;
}
```

## API Endpoints Propuestos

### Cálculo de Necesidades
- `POST /api/v1/orders/calculate-requirements` - Calcular necesidades (ADMIN/USER)
- `GET /api/v1/orders/requirements` - Listar necesidades (ADMIN/USER/VIEWER)

### Generación de Pedidos
- `POST /api/v1/orders/generate` - Generar pedido (ADMIN/USER)
- `GET /api/v1/orders/:orderId` - Obtener pedido (ADMIN/USER/VIEWER)
- `PUT /api/v1/orders/:orderId/items/:itemId` - Ajustar cantidad (ADMIN/USER)
- `POST /api/v1/orders/:orderId/approve` - Aprobar pedido (ADMIN/USER)
- `POST /api/v1/orders/:orderId/send` - Enviar pedido (ADMIN/USER)

### Seguimiento
- `GET /api/v1/orders/history` - Historial de pedidos (ADMIN/USER/VIEWER)
- `GET /api/v1/orders/by-supplier/:supplierId` - Por proveedor (ADMIN/USER/VIEWER)
- `GET /api/v1/orders/by-zone/:zone` - Por zona (ADMIN/USER/VIEWER)
- `GET /api/v1/orders/:orderId/status` - Estado del pedido (ADMIN/USER/VIEWER)

### Exportación
- `GET /api/v1/orders/:orderId/export/pdf` - Exportar PDF (ADMIN/USER/VIEWER)
- `GET /api/v1/orders/:orderId/export/excel` - Exportar Excel (ADMIN/USER/VIEWER)
- `GET /api/v1/orders/:orderId/export/email` - Enviar por email (ADMIN/USER)

## Rutas de Checking
`/Users/nemesioj/Documents/Trabajos offline/ChefChek/chefchek/plans/reports/`

---
**Estado:** 🚀 Iniciando implementación Sprint 9