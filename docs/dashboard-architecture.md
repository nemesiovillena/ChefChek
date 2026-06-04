# Arquitectura del Dashboard Interactivo

## Resumen

Panel de control moderno y en tiempo real que proporciona métricas clave, análisis de costes, salud financiera, alertas automáticas e ingeniería de menús. Diseñado para tomar decisiones informadas en cocinas profesionales.

## Arquitectura del Sistema

### Componentes

```
Dashboard System
├── KPI Metrics Module
│   ├── Total cost tracking
│   ├── Margin percentage calculation
│   ├── Food cost percentage
│   ├── Inventory value
│   ├── Waste percentage
│   ├── Labor cost percentage
│   ├── Revenue per cover
│   └── Coverage ratio
├── Financial Health Module
│   ├── Gross margin analysis
│   ├── Net margin analysis
│   ├── Cost trend tracking
│   ├── Health status evaluation
│   └── Benchmarking
├── Alerts Module
│   ├── Cost spike detection
│   ├── Margin drop alerts
│   ├── Stock level warnings
│   ├── Waste high alerts
│   ├── Supplier issue detection
│   └── Recipe cost change alerts
├── Supplier Cost Evolution Module
│   ├── Monthly cost calculation
│   ├── Trend analysis
│   ├── Cost comparison
│   └── Performance ranking
└── Menu Engineering Module
    ├── Stars analysis (high popularity, high profit)
    ├── Plowhorses analysis (high profit, low popularity)
    ├── Puzzles analysis (high popularity, low profit)
    ├── Dogs analysis (low popularity, low profit)
    └── Actionable recommendations
```

## Flujo de Datos

```
1. Data Collection
   ├── Real-time metrics from recipes, menus, and inventory
   ├── Historical data from orders and purchases
   ├── Supplier cost updates from OCR system
   └── Waste logs from production module

2. Data Processing
   ├── Calculate KPIs
   ├── Analyze trends
   ├── Compare with benchmarks
   └── Generate alerts

3. Dashboard Rendering
   ├── Multi-step UI with modules
   ├── Interactive charts and graphs
   ├── Real-time updates
   └── Export functionality

4. User Actions
   ├── Filter by time period
   ├── Generate automated alerts
   ├── Resolve/dismiss alerts
   └── Configure dashboard widgets
```

## Sistema de Métricas KPI

### Tipos de Métricas

```typescript
enum KPIMetricType {
  TOTAL_COST = 'TOTAL_COST',              // Costo total de alimentos
  MARGIN_PERCENTAGE = 'MARGIN_PERCENTAGE', // Porcentaje de margen
  FOOD_COST_PERCENTAGE = 'FOOD_COST_PERCENTAGE', // Porcentaje de coste de alimentos
  INVENTORY_VALUE = 'INVENTORY_VALUE',   // Valor total del inventario
  WASTE_PERCENTAGE = 'WASTE_PERCENTAGE', // Porcentaje de desperdicio
  LABOR_COST_PERCENTAGE = 'LABOR_COST_PERCENTAGE', // Porcentaje de coste laboral
  REVENUE_PER_COVER = 'REVENUE_PER_COVER', // Ingresos por cubierto
  COVERAGE_RATIO = 'COVERAGE_RATIO',     // Ratio de cobertura
}
```

### Cálculo de Métricas

```typescript
interface KPICalculation {
  totalCost: number;
  totalRevenue: number;
  foodCost: number;
  laborCost: number;
  inventoryValue: number;
  wasteValue: number;
  totalCovers: number;
}

function calculateKPIMetrics(data: KPICalculation): Record<KPIMetricType, number> {
  return {
    [KPIMetricType.TOTAL_COST]: data.totalCost,
    [KPIMetricType.MARGIN_PERCENTAGE]: calculateMargin(data.totalRevenue, data.totalCost),
    [KPIMetricType.FOOD_COST_PERCENTAGE]: calculateFoodCostPercentage(data.totalRevenue, data.foodCost),
    [KPIMetricType.INVENTORY_VALUE]: data.inventoryValue,
    [KPIMetricType.WASTE_PERCENTAGE]: calculateWastePercentage(data.totalCost, data.wasteValue),
    [KPIMetricType.LABOR_COST_PERCENTAGE]: calculateLaborCostPercentage(data.totalRevenue, data.laborCost),
    [KPIMetricType.REVENUE_PER_COVER]: calculateRevenuePerCover(data.totalRevenue, data.totalCovers),
    [KPIMetricType.COVERAGE_RATIO]: calculateCoverageRatio(data.totalCost, data.inventoryValue),
  };
}

function calculateMargin(revenue: number, cost: number): number {
  if (revenue === 0) return 0;
  return ((revenue - cost) / revenue) * 100;
}

function calculateFoodCostPercentage(revenue: number, foodCost: number): number {
  if (revenue === 0) return 0;
  return (foodCost / revenue) * 100;
}

function calculateWastePercentage(totalCost: number, wasteValue: number): number {
  if (totalCost === 0) return 0;
  return (wasteValue / totalCost) * 100;
}

function calculateLaborCostPercentage(revenue: number, laborCost: number): number {
  if (revenue === 0) return 0;
  return (laborCost / revenue) * 100;
}

function calculateRevenuePerCover(revenue: number, covers: number): number {
  if (covers === 0) return 0;
  return revenue / covers;
}

function calculateCoverageRatio(cost: number, inventory: number): number {
  if (inventory === 0) return 0;
  return (inventory / cost) * 100;
}
```

### Comparación de Períodos

```typescript
interface MetricComparison {
  currentPeriod: KPIMetricDto[];
  previousPeriod: KPIMetricDto[];
  trend: 'UP' | 'DOWN' | 'STABLE';
  changePercentage: number;
}

function compareMetrics(
  current: KPIMetricDto[],
  previous: KPIMetricDto[]
): MetricComparison[] {
  return current.map((currentMetric) => {
    const previousMetric = previous.find((p) => p.type === currentMetric.type);
    const change = previousMetric
      ? ((currentMetric.value - previousMetric.value) / previousMetric.value) * 100
      : 0;

    return {
      currentPeriod: currentMetric,
      previousPeriod: previousMetric,
      trend: change > 5 ? 'UP' : change < -5 ? 'DOWN' : 'STABLE',
      changePercentage: change,
    };
  });
}
```

## Salud de Márgenes Financieros

### Evaluación de Salud

```typescript
interface FinancialMarginHealth {
  grossMargin: number;
  netMargin: number;
  foodCostPercentage: number;
  healthStatus: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'CRITICAL';
}

function evaluateMarginHealth(
  grossMargin: number,
  netMargin: number,
  foodCostPercentage: number
): FinancialMarginHealth {
  let healthStatus: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'CRITICAL';

  if (grossMargin >= 70 && netMargin >= 20 && foodCostPercentage <= 30) {
    healthStatus = 'EXCELLENT';
  } else if (grossMargin >= 60 && netMargin >= 15 && foodCostPercentage <= 35) {
    healthStatus = 'GOOD';
  } else if (grossMargin >= 50 && netMargin >= 10 && foodCostPercentage <= 40) {
    healthStatus = 'WARNING';
  } else {
    healthStatus = 'CRITICAL';
  }

  return {
    grossMargin,
    netMargin,
    foodCostPercentage,
    healthStatus,
  };
}
```

### Umbrales de Referencia

```typescript
const HEALTH_THRESHOLDS = {
  grossMargin: {
    excellent: 70,
    good: 60,
    warning: 50,
  },
  netMargin: {
    excellent: 20,
    good: 15,
    warning: 10,
  },
  foodCostPercentage: {
    excellent: 30,
    good: 35,
    warning: 40,
  },
};
```

## Sistema de Alertas

### Tipos de Alertas

```typescript
enum AlertType {
  COST_SPIKE = 'COST_SPIKE',           // Aumento repentino de costes
  MARGIN_DROP = 'MARGIN_DROP',         // Caída de márgenes
  STOCK_LOW = 'STOCK_LOW',             // Stock bajo
  WASTE_HIGH = 'WASTE_HIGH',           // Desperdicio alto
  SUPPLIER_ISSUE = 'SUPPLIER_ISSUE',   // Problemas con proveedor
  RECIPE_COST_CHANGE = 'RECIPE_COST_CHANGE', // Cambio en coste de receta
}
```

### Niveles de Severidad

```typescript
enum AlertSeverity {
  INFO = 'INFO',           // Informativo
  WARNING = 'WARNING',     // Advertencia
  ERROR = 'ERROR',         // Error
  CRITICAL = 'CRITICAL',   // Crítico
}
```

### Generación Automática de Alertas

```typescript
async function generateAutomatedAlerts(tenantId: string): Promise<ProfitLossAlertDto[]> {
  const alerts: ProfitLossAlertDto[] = [];
  const marginHealth = await getFinancialMarginHealth(tenantId);

  // Alert for critical margin health
  if (marginHealth.healthStatus === 'CRITICAL') {
    alerts.push(await createAlert({
      type: AlertType.MARGIN_DROP,
      severity: AlertSeverity.CRITICAL,
      message: 'Margen financiero en estado crítico',
      affectedMetrics: ['grossMargin', 'netMargin', 'foodCostPercentage'],
      recommendation: 'Revisar costes de alimentos y precios de venta inmediatamente',
      tenantId,
    }));
  }

  // Alert for high food cost
  if (marginHealth.foodCostPercentage > 35) {
    alerts.push(await createAlert({
      type: AlertType.COST_SPIKE,
      severity: AlertSeverity.ERROR,
      message: `Coste de alimentos alto: ${marginHealth.foodCostPercentage.toFixed(1)}%`,
      affectedMetrics: ['foodCostPercentage'],
      recommendation: 'Optimizar recetas y negociar con proveedores',
      tenantId,
    }));
  }

  return alerts;
}
```

## Evolución de Costes de Proveedores

### Cálculo de Costes Mensuales

```typescript
async function calculateSupplierMonthlyCost(
  supplierId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const orders = await getPurchaseOrders({
    supplierId,
    dateRange: { startDate, endDate },
  });

  return orders.reduce((total, order) => total + order.totalCost, 0);
}
```

### Análisis de Tendencias

```typescript
interface SupplierTrend {
  supplierId: string;
  supplierName: string;
  currentMonthCost: number;
  previousMonthCost: number;
  trend: number;
  trendDirection: 'UP' | 'DOWN' | 'STABLE';
}

function analyzeSupplierTrend(evolution: SupplierCostEvolutionDto[]): SupplierTrend[] {
  return evolution.map((supplier) => {
    const trendDirection = supplier.trend > 5 ? 'UP' : supplier.trend < -5 ? 'DOWN' : 'STABLE';

    return {
      supplierId: supplier.supplierId,
      supplierName: supplier.supplierName,
      currentMonthCost: supplier.monthlyCost,
      previousMonthCost: 0,
      trend: supplier.trend,
      trendDirection,
    };
  });
}
```

## Ingeniería de Menús

### Análisis de Clasificación

```typescript
interface MenuClassification {
  menuId: string;
  menuName: string;
  stars: string[];        // Alta popularidad, alta rentabilidad
  plowhorses: string[];  // Alta rentabilidad, baja popularidad
  puzzles: string[];     // Alta popularidad, baja rentabilidad
  dogs: string[];        // Baja popularidad, baja rentabilidad
  recommendations: string[];
}

async function analyzeMenu(menuId: string): Promise<MenuClassification> {
  const menu = await getMenu(menuId);
  const items = await getMenuItems(menuId);

  const stars: string[] = [];
  const plowhorses: string[] = [];
  const puzzles: string[] = [];
  const dogs: string[] = [];
  const recommendations: string[] = [];

  for (const item of items) {
    const popularity = await getItemPopularity(item.id);
    const profitability = await getItemProfitability(item.id);

    if (popularity > 70 && profitability > 70) {
      stars.push(item.name);
      recommendations.push(`Mantener y promover ${item.name} - Ítem estrella`);
    } else if (popularity > 70 && profitability < 50) {
      puzzles.push(item.name);
      recommendations.push(`Considerar aumentar precio de ${item.name} o reducir costes`);
    } else if (popularity < 50 && profitability > 70) {
      plowhorses.push(item.name);
      recommendations.push(`Promover ${item.name} en marketing - Alta rentabilidad pero baja popularidad`);
    } else {
      dogs.push(item.name);
      recommendations.push(`Evaluar si ${item.name} debe mantenerse en el menú`);
    }
  }

  return {
    menuId: menu.id,
    menuName: menu.name,
    stars,
    plowhorses,
    puzzles,
    dogs,
    recommendations,
  };
}
```

### Cálculo de Popularidad

```typescript
async function getItemPopularity(itemId: string): Promise<number> {
  const salesData = await getItemSales(itemId, 30); // Last 30 days

  if (salesData.length === 0) return 0;

  const totalSales = salesData.reduce((sum, sale) => sum + sale.quantity, 0);
  const avgSales = totalSales / 30;

  const maxSales = 100; // Benchmark
  return Math.min((avgSales / maxSales) * 100, 100);
}
```

### Cálculo de Rentabilidad

```typescript
async function getItemProfitability(itemId: string): Promise<number> {
  const item = await getMenuItem(itemId);
  const recipe = await getRecipe(item.recipeId);

  const cost = recipe.totalCost || 0;
  const price = item.price || 0;

  if (price === 0) return 0;

  const margin = ((price - cost) / price) * 100;

  const targetMargin = 70; // Benchmark
  return Math.min((margin / targetMargin) * 100, 100);
}
```

## API Reference

### Obtener Métricas KPI

```http
GET /api/v1/dashboard/kpi-metrics?period={period}&type={type}
Authorization: Bearer {token}

Response 200:
{
  "id": "uuid",
  "type": "TOTAL_COST",
  "value": 15000.50,
  "previousValue": 14000.00,
  "changePercentage": 7.18,
  "date": "2026-05-31T10:30:00Z",
  "tenantId": "uuid-tenant-id",
  "createdAt": "2026-05-31T10:30:00Z",
  "updatedAt": "2026-05-31T10:30:00Z"
}
```

### Obtener Salud Financiera

```http
GET /api/v1/dashboard/financial-margin-health
Authorization: Bearer {token}

Response 200:
{
  "grossMargin": 65.5,
  "netMargin": 18.2,
  "foodCostPercentage": 32.5,
  "healthStatus": "GOOD",
  "date": "2026-05-31T10:30:00Z"
}
```

### Obtener Alertas Activas

```http
GET /api/v1/dashboard/alerts
Authorization: Bearer {token}

Response 200:
[
  {
    "id": "uuid",
    "type": "MARGIN_DROP",
    "severity": "WARNING",
    "message": "Margen financiero requiere atención",
    "affectedMetrics": ["grossMargin", "netMargin"],
    "recommendation": "Considerar ajustar precios o reducir costes",
    "tenantId": "uuid-tenant-id",
    "status": "ACTIVE",
    "createdAt": "2026-05-31T10:30:00Z"
  }
]
```

### Obtener Ingeniería de Menús

```http
GET /api/v1/dashboard/menu-engineering?menuId={menuId}
Authorization: Bearer {token}

Response 200:
[
  {
    "menuId": "uuid",
    "menuName": "Menú Primavera",
    "stars": ["Pasta Carbonara", "Tiramisú"],
    "plowhorses": ["Risotto Setas"],
    "puzzles": ["Pizza Margarita"],
    "dogs": ["Sopa del día"],
    "recommendations": [
      "Mantener y promover Pasta Carbonara - Ítem estrella",
      "Promover Risotto Setas en marketing - Alta rentabilidad pero baja popularidad"
    ],
    "date": "2026-05-31T10:30:00Z"
  }
]
```

## Checklist de Implementación

### KPI Metrics ✅
- [x] 8 tipos de métricas
- [x] Cálculo de métricas
- [x] Comparación de períodos
- [x] Tendencias y cambios
- [x] Filtrado por tiempo

### Financial Health ✅
- [x] Cálculo de márgenes
- [x] Evaluación de salud
- [x] Umbrales de referencia
- [x] Estados de salud
- [x] Recomendaciones

### Alerts ✅
- [x] 6 tipos de alertas
- [x] 4 niveles de severidad
- [x] Generación automática
- [x] Resolución y descarte
- [x] Recomendaciones

### Supplier Cost Evolution ✅
- [x] Cálculo de costes mensuales
- [x] Análisis de tendencias
- [x] Comparación de proveedores
- [x] Ranking por coste
- [x] Detección de aumentos

### Menu Engineering ✅
- [x] Análisis de clasificación
- [x] 4 categorías (Stars, Plowhorses, Puzzles, Dogs)
- [x] Cálculo de popularidad
- [x] Cálculo de rentabilidad
- [x] Recomendaciones accionables

---

**Versión:** 1.0.0
**Última actualización:** 2026-05-31
**Estado:** ✅ Implementado
**Sprint:** 14 - Dashboard Interactivo