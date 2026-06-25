# Sistema de Alertas y Notificaciones

## Resumen

Sistema inteligente de detección y notificación de eventos críticos en la gestión de cocina. Genera alertas automáticas basadas en umbrales configurables, proporciona recomendaciones accionables y permite la gestión del ciclo de vida de las alertas.

## Arquitectura del Sistema

### Componentes

```
Alert System
├── Detection Engine
│   ├── Threshold monitoring
│   ├── Pattern recognition
│   ├── Anomaly detection
│   └── Real-time analysis
├── Alert Generation
│   ├── Alert creation
│   ├── Severity assignment
│   ├── Message composition
│   └── Recommendation generation
├── Notification Delivery
│   ├── In-app notifications
│   ├── Email notifications
│   ├── Push notifications
│   └── Webhook integrations
├── Alert Management
│   ├── Alert resolution
│   ├── Alert dismissal
│   ├── Escalation rules
│   └── History tracking
└── Configuration
    ├── Threshold settings
    ├── Notification preferences
    ├── User roles
    └── Escalation policies
```

## Flujo de Generación de Alertas

```
1. Monitor Continuo
   ├── Revisar métricas en tiempo real
   ├── Comparar con umbrales
   ├── Detectar patrones anómalos
   └── Analizar tendencias

2. Detección de Evento
   ├── Umbral excedido
   ├── Tendencia negativa
   ├── Fallo en proveedor
   └── Stock bajo

3. Creación de Alerta
   ├── Asignar tipo
   ├── Determinar severidad
   ├── Componer mensaje
   └── Generar recomendación

4. Entrega
   ├── Notificar usuarios relevantes
   ├── Registrar en base de datos
   ├── Seguir reglas de escalado
   └── Actualizar dashboard

5. Gestión
   ├── Resolver alertas
   ├── Descartar alertas
   ├── Escalar si no resuelto
   └── Archivar histórico
```

## Tipos de Alertas

### 1. Cost Spike (COST_SPIKE)

**Descripción:** Aumento repentino y significativo en costes

**Umbrales:**
```typescript
interface CostSpikeThreshold {
  percentageIncrease: number;      // Porcentaje de aumento
  absoluteIncrease: number;        // Aumento en valor monetario
  timeWindow: number;              // Ventana de tiempo (minutos)
}

const costSpikeThresholds: CostSpikeThreshold = {
  percentageIncrease: 15,          // 15% de aumento
  absoluteIncrease: 1000,          // €1000 de aumento
  timeWindow: 60,                  // En 1 hora
};
```

**Detección:**
```typescript
async function detectCostSpike(tenantId: string): Promise<boolean> {
  const currentCost = await calculateTotalCost(tenantId, TimePeriod.TODAY);
  const previousCost = await calculateTotalCost(tenantId, TimePeriod.WEEK);
  const averageDailyCost = previousCost / 7;

  const percentageIncrease = ((currentCost - averageDailyCost) / averageDailyCost) * 100;
  const absoluteIncrease = currentCost - averageDailyCost;

  return (
    percentageIncrease >= costSpikeThresholds.percentageIncrease ||
    absoluteIncrease >= costSpikeThresholds.absoluteIncrease
  );
}
```

**Recomendación:**
```
- Revisar pedidos recientes
- Verificar actualizaciones de precios
- Contactar proveedores afectados
- Considerar ajuste de precios de venta
```

---

### 2. Margin Drop (MARGIN_DROP)

**Descripción:** Caída significativa en márgenes

**Umbrales:**
```typescript
interface MarginDropThreshold {
  grossMarginDrop: number;         // Caída de margen bruto (%)
  netMarginDrop: number;           // Caída de margen neto (%)
  consecutiveDays: number;         // Días consecutivos
}

const marginDropThresholds: MarginDropThreshold = {
  grossMarginDrop: 10,             // 10% de caída
  netMarginDrop: 5,                // 5% de caída
  consecutiveDays: 3,              // 3 días consecutivos
};
```

**Detección:**
```typescript
async function detectMarginDrop(tenantId: string): Promise<boolean> {
  const currentMarginHealth = await getFinancialMarginHealth(tenantId);
  const previousMarginHealth = await getPreviousMarginHealth(tenantId, 7); // 7 días atrás

  const grossMarginDrop = previousMarginHealth.grossMargin - currentMarginHealth.grossMargin;
  const netMarginDrop = previousMarginHealth.netMargin - currentMarginHealth.netMargin;

  const consecutiveDays = await countConsecutiveMarginDrops(tenantId);

  return (
    grossMarginDrop >= marginDropThresholds.grossMarginDrop ||
    netMarginDrop >= marginDropThresholds.netMarginDrop ||
    consecutiveDays >= marginDropThresholds.consecutiveDays
  );
}

async function countConsecutiveMarginDrops(tenantId: string): Promise<number> {
  const marginHistory = await getMarginHistory(tenantId, 30); // Últimos 30 días
  
  let consecutiveDays = 0;
  for (let i = marginHistory.length - 1; i >= 0; i--) {
    if (marginHistory[i].trend === 'DOWN') {
      consecutiveDays++;
    } else {
      break;
    }
  }

  return consecutiveDays;
}
```

**Recomendación:**
```
- Analizar causas de la caída
- Revisar costes de proveedores
- Optimizar recetas y porciones
- Considerar aumento de precios
- Reducir desperdicios
```

---

### 3. Stock Low (STOCK_LOW)

**Descripción:** Nivel de stock bajo para productos críticos

**Umbrales:**
```typescript
interface StockLowThreshold {
  minQuantity: number;             // Cantidad mínima
  minDays: number;                 // Días de stock mínimo
  criticalProducts: string[];      // Productos críticos
}

const stockLowThresholds: StockLowThreshold = {
  minQuantity: 10,                 // 10 unidades
  minDays: 3,                      // 3 días de stock
  criticalProducts: ['principal', 'frequent'], // Etiquetas de productos críticos
};
```

**Detección:**
```typescript
async function detectStockLow(tenantId: string): Promise<ProfitLossAlertDto[]> {
  const alerts: ProfitLossAlertDto[] = [];
  const inventory = await getInventory(tenantId);
  
  for (const item of inventory) {
    const product = await getProduct(item.productId);
    const dailyUsage = await calculateDailyUsage(item.productId, 30);
    const daysOfStock = dailyUsage > 0 ? item.quantity / dailyUsage : Infinity;

    const isCriticalProduct = product.tags?.some(tag =>
      stockLowThresholds.criticalProducts.includes(tag)
    );

    if (item.quantity <= stockLowThresholds.minQuantity || 
        daysOfStock <= stockLowThresholds.minDays) {
      
      const severity = isCriticalProduct ? AlertSeverity.CRITICAL : AlertSeverity.WARNING;
      
      const alert = await createAlert({
        type: AlertType.STOCK_LOW,
        severity,
        message: `Stock bajo: ${product.name} (${item.quantity.toFixed(2)} ${item.unit}, ${daysOfStock.toFixed(1)} días)`,
        affectedMetrics: [`inventory_${item.productId}`],
        recommendation: isCriticalProduct 
          ? 'Reabastecer inmediatamente - Producto crítico'
          : 'Considerar reponer en próxima orden',
        tenantId,
      });
      
      alerts.push(alert);
    }
  }

  return alerts;
}

async function calculateDailyUsage(productId: string, days: number): Promise<number> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const usageLogs = await getUsageLogs(productId, startDate, endDate);
  
  const totalUsage = usageLogs.reduce((sum, log) => sum + log.quantity, 0);
  
  return totalUsage / days;
}
```

**Recomendación:**
```
- Generar orden de compra
- Contactar proveedor
- Ajustar proyecciones de uso
- Considerar sustitutos
```

---

### 4. Waste High (WASTE_HIGH)

**Descripción:** Porcentaje de desperdicio excesivo

**Umbrales:**
```typescript
interface WasteHighThreshold {
  wastePercentage: number;          // Porcentaje de desperdicio
  wasteValue: number;               // Valor de desperdicio
  consecutiveDays: number;          // Días consecutivos
}

const wasteHighThresholds: WasteHighThreshold = {
  wastePercentage: 5,               // 5% de desperdicio
  wasteValue: 500,                  // €500 de desperdicio
  consecutiveDays: 2,               // 2 días consecutivos
};
```

**Detección:**
```typescript
async function detectWasteHigh(tenantId: string): Promise<boolean> {
  const wastePercentage = await calculateWastePercentage(tenantId, TimePeriod.WEEK);
  const wasteValue = await calculateWasteValue(tenantId, TimePeriod.WEEK);
  const consecutiveDays = await countConsecutiveHighWasteDays(tenantId);

  return (
    wastePercentage >= wasteHighThresholds.wastePercentage ||
    wasteValue >= wasteHighThresholds.wasteValue ||
    consecutiveDays >= wasteHighThresholds.consecutiveDays
  );
}

async function countConsecutiveHighWasteDays(tenantId: string): Promise<number> {
  const wasteHistory = await getWasteHistory(tenantId, 30); // Últimos 30 días
  
  let consecutiveDays = 0;
  for (let i = wasteHistory.length - 1; i >= 0; i--) {
    if (wasteHistory[i].percentage >= wasteHighThresholds.wastePercentage) {
      consecutiveDays++;
    } else {
      break;
    }
  }

  return consecutiveDays;
}
```

**Recomendación:**
```
- Analizar causas del desperdicio
- Revisar técnicas de preparación
- Optimizar porciones
- Capacitar al personal
- Implementar control de porciones
```

---

### 5. Supplier Issue (SUPPLIER_ISSUE)

**Descripción:** Problemas con proveedor (entregas faltantes, retrasos, calidad)

**Umbrales:**
```typescript
interface SupplierIssueThreshold {
  delayedDeliveries: number;        // Entregas retrasadas
  missingItems: number;            // Ítems faltantes
  qualityIssues: number;           // Problemas de calidad
}

const supplierIssueThresholds: SupplierIssueThreshold = {
  delayedDeliveries: 3,            // 3 entregas retrasadas
  missingItems: 5,                 // 5 ítems faltantes
  qualityIssues: 2,                // 2 problemas de calidad
};
```

**Detección:**
```typescript
async function detectSupplierIssue(tenantId: string): Promise<ProfitLossAlertDto[]> {
  const alerts: ProfitLossAlertDto[] = [];
  const suppliers = await getSuppliers(tenantId);
  
  for (const supplier of suppliers) {
    const issues = await getSupplierIssues(supplier.id, TimePeriod.MONTH);
    
    const delayedDeliveries = issues.filter(i => i.type === 'DELAYED_DELIVERY').length;
    const missingItems = issues.filter(i => i.type === 'MISSING_ITEM').length;
    const qualityIssues = issues.filter(i => i.type === 'QUALITY').length;

    if (
      delayedDeliveries >= supplierIssueThresholds.delayedDeliveries ||
      missingItems >= supplierIssueThresholds.missingItems ||
      qualityIssues >= supplierIssueThresholds.qualityIssues
    ) {
      const alert = await createAlert({
        type: AlertType.SUPPLIER_ISSUE,
        severity: AlertSeverity.ERROR,
        message: `Problemas con proveedor ${supplier.name}: ${delayedDeliveries} entregas retrasadas, ${missingItems} ítems faltantes`,
        affectedMetrics: [`supplier_${supplier.id}`],
        recommendation: 'Contactar proveedor y considerar alternativas',
        tenantId,
      });
      
      alerts.push(alert);
    }
  }

  return alerts;
}
```

**Recomendación:**
```
- Contactar proveedor
- Documentar incidencias
- Buscar proveedores alternativos
- Revisar contrato
- Considerar cambio de proveedor
```

---

### 6. Recipe Cost Change (RECIPE_COST_CHANGE)

**Descripción:** Cambio significativo en coste de receta

**Umbrales:**
```typescript
interface RecipeCostChangeThreshold {
  percentageChange: number;         // Porcentaje de cambio
  absoluteChange: number;           // Cambio en valor monetario
}

const recipeCostChangeThresholds: RecipeCostChangeThreshold = {
  percentageChange: 10,             // 10% de cambio
  absoluteChange: 2,                // €2 de cambio por porción
};
```

**Detección:**
```typescript
async function detectRecipeCostChange(tenantId: string): Promise<ProfitLossAlertDto[]> {
  const alerts: ProfitLossAlertDto[] = [];
  const recipes = await getRecipes(tenantId);
  
  for (const recipe of recipes) {
    const costHistory = await getRecipeCostHistory(recipe.id, 7); // Últimos 7 días
    
    if (costHistory.length < 2) continue;
    
    const currentCost = costHistory[costHistory.length - 1].totalCost;
    const previousCost = costHistory[0].totalCost;
    
    const percentageChange = Math.abs((currentCost - previousCost) / previousCost) * 100;
    const absoluteChange = Math.abs(currentCost - previousCost);

    if (
      percentageChange >= recipeCostChangeThresholds.percentageChange ||
      absoluteChange >= recipeCostChangeThresholds.absoluteChange
    ) {
      const direction = currentCost > previousCost ? 'aumento' : 'disminución';
      
      const alert = await createAlert({
        type: AlertType.RECIPE_COST_CHANGE,
        severity: AlertSeverity.WARNING,
        message: `${direction} de coste en receta ${recipe.name}: ${percentageChange.toFixed(1)}%`,
        affectedMetrics: [`recipe_${recipe.id}`],
        recommendation: currentCost > previousCost
          ? 'Revisar precios de venta o ingredientes'
          : 'Aprovechar reducción de costes',
        tenantId,
      });
      
      alerts.push(alert);
    }
  }

  return alerts;
}
```

**Recomendación:**
```
- Analizar ingredientes afectados
- Ajustar precios de venta
- Buscar alternativas
- Actualizar fichas técnicas
- Comunicar cambios al equipo
```

---

## Niveles de Severidad

### Jerarquía de Severidad

```typescript
enum AlertSeverity {
  INFO = 'INFO',           // Informativo - No requiere acción inmediata
  WARNING = 'WARNING',     // Advertencia - Requiere atención
  ERROR = 'ERROR',         // Error - Requiere acción
  CRITICAL = 'CRITICAL',   // Crítico - Requiere acción inmediata
}
```

### Asignación Automática de Severidad

```typescript
function assignAlertSeverity(
  alertType: AlertType,
  metrics: Record<string, number>
): AlertSeverity {
  switch (alertType) {
    case AlertType.COST_SPIKE:
      if (metrics.percentageIncrease > 30) return AlertSeverity.CRITICAL;
      if (metrics.percentageIncrease > 20) return AlertSeverity.ERROR;
      if (metrics.percentageIncrease > 10) return AlertSeverity.WARNING;
      return AlertSeverity.INFO;

    case AlertType.MARGIN_DROP:
      if (metrics.netMargin < 5) return AlertSeverity.CRITICAL;
      if (metrics.netMargin < 10) return AlertSeverity.ERROR;
      if (metrics.netMargin < 15) return AlertSeverity.WARNING;
      return AlertSeverity.INFO;

    case AlertType.STOCK_LOW:
      if (metrics.daysOfStock < 1) return AlertSeverity.CRITICAL;
      if (metrics.daysOfStock < 3) return AlertSeverity.ERROR;
      if (metrics.daysOfStock < 7) return AlertSeverity.WARNING;
      return AlertSeverity.INFO;

    case AlertType.WASTE_HIGH:
      if (metrics.wastePercentage > 10) return AlertSeverity.CRITICAL;
      if (metrics.wastePercentage > 7) return AlertSeverity.ERROR;
      if (metrics.wastePercentage > 5) return AlertSeverity.WARNING;
      return AlertSeverity.INFO;

    case AlertType.SUPPLIER_ISSUE:
      if (metrics.delayedDeliveries > 5) return AlertSeverity.CRITICAL;
      if (metrics.delayedDeliveries > 3) return AlertSeverity.ERROR;
      if (metrics.delayedDeliveries > 1) return AlertSeverity.WARNING;
      return AlertSeverity.INFO;

    case AlertType.RECIPE_COST_CHANGE:
      if (metrics.percentageChange > 30) return AlertSeverity.CRITICAL;
      if (metrics.percentageChange > 20) return AlertSeverity.ERROR;
      if (metrics.percentageChange > 10) return AlertSeverity.WARNING;
      return AlertSeverity.INFO;

    default:
      return AlertSeverity.INFO;
  }
}
```

---

## Generación de Recomendaciones

```typescript
interface RecommendationConfig {
  alertType: AlertType;
  severity: AlertSeverity;
  metrics: Record<string, number>;
}

function generateRecommendation(config: RecommendationConfig): string {
  const { alertType, severity, metrics } = config;

  const recommendations: Record<string, string[]> = {
    [AlertType.COST_SPIKE]: [
      'Revisar pedidos recientes',
      'Verificar actualizaciones de precios',
      'Contactar proveedores afectados',
      'Considerar ajuste de precios de venta',
    ],
    [AlertType.MARGIN_DROP]: [
      'Analizar causas de la caída',
      'Revisar costes de proveedores',
      'Optimizar recetas y porciones',
      'Considerar aumento de precios',
      'Reducir desperdicios',
    ],
    [AlertType.STOCK_LOW]: [
      'Generar orden de compra',
      'Contactar proveedor',
      'Ajustar proyecciones de uso',
      'Considerar sustitutos',
    ],
    [AlertType.WASTE_HIGH]: [
      'Analizar causas del desperdicio',
      'Revisar técnicas de preparación',
      'Optimizar porciones',
      'Capacitar al personal',
      'Implementar control de porciones',
    ],
    [AlertType.SUPPLIER_ISSUE]: [
      'Contactar proveedor',
      'Documentar incidencias',
      'Buscar proveedores alternativos',
      'Revisar contrato',
      'Considerar cambio de proveedor',
    ],
    [AlertType.RECIPE_COST_CHANGE]: [
      'Analizar ingredientes afectados',
      'Ajustar precios de venta',
      'Buscar alternativas',
      'Actualizar fichas técnicas',
      'Comunicar cambios al equipo',
    ],
  };

  const typeRecommendations = recommendations[alertType] || [];

  // Prioritize based on severity
  if (severity === AlertSeverity.CRITICAL) {
    return `URGENTE: ${typeRecommendations[0]} - Requiere acción inmediata`;
  }

  return typeRecommendations.slice(0, 2).join(' - ');
}
```

---

## Ciclo de Vida de Alertas

### Estados de Alerta

```typescript
enum AlertStatus {
  ACTIVE = 'ACTIVE',         // Alerta activa, no resuelta
  RESOLVED = 'RESOLVED',     // Alerta resuelta
  DISMISSED = 'DISMISSED',   // Alerta descartada
}

interface AlertLifecycle {
  status: AlertStatus;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNote?: string;
}
```

### Gestión de Estados

```typescript
async function resolveAlert(
  alertId: string,
  tenantId: string,
  userId: string,
  note?: string
): Promise<ProfitLossAlertDto> {
  const alert = await this.alertRepository.findOne({
    where: { id: alertId, tenantId, status: AlertStatus.ACTIVE },
  });

  if (!alert) {
    throw new NotFoundException(`Alert ${alertId} not found or already resolved`);
  }

  alert.status = AlertStatus.RESOLVED;
  alert.resolvedAt = new Date();
  alert.resolvedBy = userId;
  alert.resolutionNote = note;

  await this.alertRepository.save(alert);

  return {
    id: alert.id,
    type: alert.type,
    severity: alert.severity,
    message: alert.message,
    affectedMetrics: alert.affectedMetrics,
    recommendation: alert.recommendation,
    tenantId: alert.tenantId,
    status: alert.status,
    createdAt: alert.createdAt,
    resolvedAt: alert.resolvedAt,
  };
}

async function dismissAlert(
  alertId: string,
  tenantId: string,
  userId: string,
  note?: string
): Promise<ProfitLossAlertDto> {
  const alert = await this.alertRepository.findOne({
    where: { id: alertId, tenantId, status: AlertStatus.ACTIVE },
  });

  if (!alert) {
    throw new NotFoundException(`Alert ${alertId} not found or already resolved`);
  }

  alert.status = AlertStatus.DISMISSED;
  alert.resolvedAt = new Date();
  alert.resolvedBy = userId;
  alert.resolutionNote = note;

  await this.alertRepository.save(alert);

  return {
    id: alert.id,
    type: alert.type,
    severity: alert.severity,
    message: alert.message,
    affectedMetrics: alert.affectedMetrics,
    recommendation: alert.recommendation,
    tenantId: alert.tenantId,
    status: alert.status,
    createdAt: alert.createdAt,
    resolvedAt: alert.resolvedAt,
  };
}
```

---

## API Reference

### Crear Alerta

```http
POST /api/v1/dashboard/alerts
Authorization: Bearer {token}

{
  "type": "MARGIN_DROP",
  "severity": "WARNING",
  "message": "Margen financiero requiere atención",
  "affectedMetrics": ["grossMargin", "netMargin"],
  "recommendation": "Considerar ajustar precios o reducir costes",
  "tenantId": "uuid-tenant-id",
  "userId": "uuid-user-id"
}

Response 201:
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

### Resolver Alerta

```http
PUT /api/v1/dashboard/alerts/{id}/resolve
Authorization: Bearer {token}

{
  "userId": "uuid-user-id",
  "note": "Margen mejorado después de optimizar recetas"
}

Response 200:
{
  "id": "uuid",
  "type": "MARGIN_DROP",
  "severity": "WARNING",
  "message": "Margen financiero requiere atención",
  "affectedMetrics": ["grossMargin", "netMargin"],
  "recommendation": "Considerar ajustar precios o reducir costes",
  "tenantId": "uuid-tenant-id",
  "status": "RESOLVED",
  "createdAt": "2026-05-31T10:30:00Z",
  "resolvedAt": "2026-05-31T11:00:00Z"
}
```

### Generar Alertas Automáticas

```http
POST /api/v1/dashboard/alerts/generate
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

---

## Checklist de Implementación

### Tipos de Alertas ✅
- [x] 6 tipos de alertas
- [x] Umbrales configurables
- [x] Detección automática
- [x] Mensajes descriptivos
- [x] Recomendaciones accionables

### Severidad ✅
- [x] 4 niveles de severidad
- [x] Asignación automática
- [x] Visualización diferenciada
- [x] Priorización de acciones

### Gestión ✅
- [x] Resolución de alertas
- [x] Descarte de alertas
- [x] Notas de resolución
- [x] Tracking de usuario

### Notificaciones ✅
- [x] Notificaciones in-app
- [x] Notificaciones por email
- [x] Notificaciones push
- [x] Webhooks integrados

---

**Versión:** 1.0.0
**Última actualización:** 2026-05-31
**Estado:** ✅ Implementado
**Sprint:** 14 - Dashboard Interactivo