# Stock Alert System

## Overview

The stock alert system provides proactive notifications for inventory-related issues including low stock, out-of-stock situations, expiring products, and inventory discrepancies. Alerts are generated automatically based on configurable rules and can be acknowledged, tracked, and resolved.

## Alert Types

| Alert ID        | Alert Name     | Trigger Condition                          | Default Severity | Response Time          |
|-----------------|----------------|-------------------------------------------|-------------------|-------------------------|
| LOW_STOCK       | Low Stock      | Current stock < minimum stock            | WARNING          | 24-48 hours              |
| OUT_OF_STOCK    | Out of Stock   | Current stock = 0                          | CRITICAL         | Immediate                |
| EXPIRING_SOON   | Expiring Soon  | Expiration date ≤ 7 days                 | WARNING          | Within 7 days            |
| EXPIRED         | Expired        | Expiration date < today                   | CRITICAL         | Immediate removal       |
| OVERSTOCK       | Overstock      | Current stock > 2× average daily usage   | INFO             | Review within 30 days    |
| DISCREPANCY     | Discrepancy    | Inventory discrepancy detected             | WARNING/CRITICAL | Investigate immediately |
| HIGH_VALUE_DISCREPANCY | High Value Discrepancy | Discrepancy value > €500 | CRITICAL | Investigate immediately |

## Alert Severity Levels

### Severity Hierarchy

```
CRITICAL (Immediate Action Required)
├── OUT_OF_STOCK: Cannot fulfill orders
├── EXPIRED: Safety compliance issue
└── HIGH_VALUE_DISCREPANCY: Financial loss risk

WARNING (Prompt Action Required)
├── LOW_STOCK: Risk of stockout
├── EXPIRING_SOON: Waste risk
└── DISCREPANCY: Data accuracy issue

INFO (Monitor and Review)
└── OVERSTOCK: Optimization opportunity
```

### Response Time Guidelines

| Severity  | Initial Response | Resolution Target | Escalation Trigger          |
|-----------|------------------|-------------------|------------------------------|
| CRITICAL  | < 1 hour         | < 24 hours        | 4 hours without resolution    |
| WARNING   | < 4 hours         | < 7 days          | 24 hours without resolution   |
| INFO      | < 24 hours        | < 30 days         | 7 days without resolution     |

## Alert Generation Engine

### Generation Algorithm

```typescript
async function generateStockAlerts(tenantId: string): Promise<StockAlert[]> {
  const alerts: StockAlert[] = [];
  const today = new Date();

  // 1. Stock Level Alerts
  const stockAlerts = await generateStockLevelAlerts(tenantId);
  alerts.push(...stockAlerts);

  // 2. Expiration Alerts
  const expirationAlerts = await generateExpirationAlerts(tenantId, today);
  alerts.push(...expirationAlerts);

  // 3. Overstock Alerts
  const overstockAlerts = await generateOverstockAlerts(tenantId);
  alerts.push(...overstockAlerts);

  // 4. Discrepancy Alerts (from recent inventories)
  const discrepancyAlerts = await generateDiscrepancyAlerts(tenantId);
  alerts.push(...discrepancyAlerts);

  // 5. Filter out duplicates and existing acknowledged alerts
  const filteredAlerts = await filterAlerts(alerts);

  // 6. Save to database
  const savedAlerts = await Promise.all(
    filteredAlerts.map((alert) => createStockAlert(alert))
  );

  // 7. Send notifications
  await sendAlertNotifications(savedAlerts);

  return savedAlerts;
}
```

### Stock Level Alert Generation

```typescript
async function generateStockLevelAlerts(
  tenantId: string
): Promise<Partial<StockAlert>[]> {
  const alerts: Partial<StockAlert>[] = [];
  const products = await getProducts(tenantId);

  for (const product of products) {
    const stock = product.stock?.quantity || 0;
    const minStock = product.minimumStock || 0;
    const avgDailyUsage = product.stock?.averageDailyUsage || 0;

    // Out of Stock
    if (stock === 0) {
      alerts.push({
        tenantId,
        productId: product.id,
        productName: product.name,
        warehouseId: product.primaryWarehouseId,
        alertType: AlertType.OUT_OF_STOCK,
        severity: AlertSeverity.CRITICAL,
        message: `Producto ${product.name} sin stock disponible`,
        currentStock: 0,
        minimumStock: minStock,
        daysUntilStockout: avgDailyUsage > 0 ? 0 : null,
      });
    }
    // Low Stock
    else if (stock < minStock) {
      const stockRatio = stock / minStock;
      const daysUntilStockout =
        avgDailyUsage > 0 ? Math.floor(stock / avgDailyUsage) : null;

      alerts.push({
        tenantId,
        productId: product.id,
        productName: product.name,
        warehouseId: product.primaryWarehouseId,
        alertType: AlertType.LOW_STOCK,
        severity:
          daysUntilStockout !== null && daysUntilStockout <= 3
            ? AlertSeverity.CRITICAL
            : AlertSeverity.WARNING,
        message: `Producto ${product.name} bajo stock mínimo (${stock}/${minStock})`,
        currentStock: stock,
        minimumStock: minStock,
        stockRatio,
        daysUntilStockout,
      });
    }
  }

  return alerts;
}
```

### Expiration Alert Generation

```typescript
async function generateExpirationAlerts(
  tenantId: string,
  today: Date
): Promise<Partial<StockAlert>[]> {
  const alerts: Partial<StockAlert>[] = [];

  // Get all stock movements with expiration dates
  const stockMovements = await prisma.stockMovement.findMany({
    where: {
      movementType: 'ENTRY',
      expirationDate: {
        not: null,
      },
    },
    include: {
      product: true,
    },
    orderBy: {
      expirationDate: 'asc',
    },
  });

  for (const movement of stockMovements) {
    if (!movement.expirationDate) continue;

    const expirationDate = new Date(movement.expirationDate);
    const daysUntilExpiration = Math.floor(
      (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Expired
    if (daysUntilExpiration < 0) {
      alerts.push({
        tenantId: movement.product?.tenantId,
        productId: movement.productId,
        productName: movement.product?.name,
        alertType: AlertType.EXPIRED,
        severity: AlertSeverity.CRITICAL,
        message: `Producto ${movement.product?.name} caducó`,
        currentStock: movement.quantity,
        expirationDate: movement.expirationDate,
        daysUntilExpiration,
        lotNumber: movement.lotNumber,
        valueAtRisk: movement.totalCost,
      });
    }
    // Expiring Soon
    else if (daysUntilExpiration <= 7) {
      const severity =
        daysUntilExpiration <= 1
          ? AlertSeverity.CRITICAL
          : daysUntilExpiration <= 3
          ? AlertSeverity.WARNING
          : AlertSeverity.INFO;

      alerts.push({
        tenantId: movement.product?.tenantId,
        productId: movement.productId,
        productName: movement.product?.name,
        alertType: AlertType.EXPIRING_SOON,
        severity,
        message: `Producto ${movement.product?.name} caduca en ${daysUntilExpiration} día${daysUntilExpiration !== 1 ? 's' : ''}`,
        currentStock: movement.quantity,
        expirationDate: movement.expirationDate,
        daysUntilExpiration,
        lotNumber: movement.lotNumber,
        valueAtRisk: movement.totalCost,
      });
    }
  }

  return alerts;
}
```

### Overstock Alert Generation

```typescript
async function generateOverstockAlerts(
  tenantId: string
): Promise<Partial<StockAlert>[]> {
  const alerts: Partial<StockAlert>[] = [];
  const products = await getProducts(tenantId);

  for (const product of products) {
    const stock = product.stock?.quantity || 0;
    const avgDailyUsage = product.stock?.averageDailyUsage || 0;
    const costPerUnit = product.costPerUnit || 0;

    if (avgDailyUsage === 0) continue;

    const daysOfStock = stock / avgDailyUsage;
    const overstockThreshold = 60; // 60 days supply

    if (daysOfStock > overstockThreshold) {
      alerts.push({
        tenantId,
        productId: product.id,
        productName: product.name,
        warehouseId: product.primaryWarehouseId,
        alertType: AlertType.OVERSTOCK,
        severity: AlertSeverity.INFO,
        message: `Producto ${product.name} con exceso de stock (${daysOfStock.toFixed(0)} días)`,
        currentStock: stock,
        averageDailyUsage: avgDailyUsage,
        daysOfStock,
        overstockAmount: stock - (avgDailyUsage * 30), // 30 days supply
        valueAtRisk: (stock - avgDailyUsage * 30) * costPerUnit,
      });
    }
  }

  return alerts;
}
```

## Alert Configuration

### Threshold Configuration

```typescript
interface AlertThresholds {
  lowStock: {
    enabled: boolean;
    thresholdPercentage: number;      // % of minimum stock to trigger
    daysUntilStockoutCritical: number;  // Days to upgrade to critical
  };
  expiration: {
    enabled: boolean;
    expiringSoonDays: number;          // Days ahead to warn
    urgentDays: number;                // Days to escalate to critical
  };
  overstock: {
    enabled: boolean;
    daysOfStockThreshold: number;    // Days of supply to trigger
  };
  discrepancy: {
    enabled: boolean;
    percentageThreshold: number;     // % discrepancy to trigger
    valueThreshold: number;            // Value threshold (€)
  };
}
```

### Default Configuration

```typescript
const defaultAlertThresholds: AlertThresholds = {
  lowStock: {
    enabled: true,
    thresholdPercentage: 0.9,        // Alert at 90% of minimum stock
    daysUntilStockoutCritical: 3,      // Critical if < 3 days supply
  },
  expiration: {
    enabled: true,
    expiringSoonDays: 7,             // Warn 7 days before
    urgentDays: 1,                    // Critical 1 day before
  },
  overstock: {
    enabled: true,
    daysOfStockThreshold: 60,       // Alert if > 60 days supply
  },
  discrepancy: {
    enabled: true,
    percentageThreshold: 0.05,      // Alert if > 5% discrepancy
    valueThreshold: 100,             // Alert if > €100 discrepancy
  },
};
```

## Alert Notification System

### Notification Channels

```typescript
interface NotificationChannel {
  type: 'EMAIL' | 'SMS' | 'PUSH' | 'WEBHOOK' | 'IN_APP';
  enabled: boolean;
  recipients: string[];
  severityFilter: AlertSeverity[];
  template: string;
}

interface NotificationTemplate {
  channel: string;
  severity: AlertSeverity;
  subject: string;
  body: string;
  variables: string[];
}
```

### Notification Templates

**Email Template - Critical Alert:**

```typescript
{
  channel: 'EMAIL',
  severity: 'CRITICAL',
  subject: '🚨 CRITICAL: {{alertType}} - {{productName}}',
  body: `
    {{message}}

    Detalles:
    - Producto: {{productName}}
    - Stock Actual: {{currentStock}}
    - Fecha del Alerta: {{alertDate}}

    Acción Inmediata Requerida: {{actionRequired}}

    ChefChek Inventory System
  `,
  variables: ['alertType', 'productName', 'message', 'currentStock', 'alertDate', 'actionRequired']
}
```

**SMS Template - Critical Alert:**

```typescript
{
  channel: 'SMS',
  severity: 'CRITICAL',
  body: 'CRITICAL: {{alertType}} - {{productName}}. {{actionRequired}}. ChefChek.',
  variables: ['alertType', 'productName', 'actionRequired'],
  maxLength: 160
}
```

### Notification Sending

```typescript
async function sendAlertNotifications(alerts: StockAlert[]): Promise<void> {
  for (const alert of alerts) {
    const channels = await getEnabledNotificationChannels(alert.severity);

    for (const channel of channels) {
      await sendNotification(channel, alert);
    }
  }
}

async function sendNotification(
  channel: NotificationChannel,
  alert: StockAlert
): Promise<void> {
  const template = await getNotificationTemplate(channel.type, alert.severity);

  const message = replaceTemplateVariables(template.body, {
    ...alert,
    alertDate: new Date(alert.createdAt).toLocaleString(),
    actionRequired: getActionRequired(alert),
  });

  switch (channel.type) {
    case 'EMAIL':
      await sendEmail(channel.recipients, template.subject, message);
      break;
    case 'SMS':
      await sendSMS(channel.recipients, message);
      break;
    case 'PUSH':
      await sendPushNotification(channel.recipients, alert);
      break;
    case 'WEBHOOK':
      await sendWebhook(channel.recipients, alert);
      break;
    case 'IN_APP':
      // Handled by frontend via WebSocket
      break;
  }
}
```

## Alert Acknowledgment Workflow

### Acknowledgment Process

```
1. Alert Generated
   ├── Created in database
   ├── Status: UNACKNOWLEDGED
   └── Notifications sent

2. Alert Acknowledged
   ├── User acknowledges alert
   ├── Status changed to ACKNOWLEDGED
   ├── Acknowledged by and time recorded
   └── Notes can be added

3. Alert Resolution
   ├── Root cause identified
   ├── Actions taken
   ├── Status changed to RESOLVED
   ├── Resolution time recorded
   └── Lessons learned documented

4. Alert Archival
   ├── Alert marked as closed
   ├── Moved to historical records
   └── Data available for analysis
```

### Acknowledgment API

```typescript
interface AcknowledgeAlertDto {
  acknowledgedBy: string;
  actionTaken?: string;
  notes?: string;
  resolutionTargetDate?: Date;
}

async function acknowledgeAlert(
  alertId: string,
  dto: AcknowledgeAlertDto
): Promise<StockAlert> {
  const alert = await getStockAlert(alertId);

  if (alert.acknowledged) {
    throw new BadRequestException('Alert already acknowledged');
  }

  const updated = await prisma.stockAlert.update({
    where: { id: alertId },
    data: {
      acknowledged: true,
      acknowledgedBy: dto.acknowledgedBy,
      acknowledgedAt: new Date(),
      actionTaken: dto.actionTaken,
      notes: dto.notes,
      resolutionTargetDate: dto.resolutionTargetDate,
    },
  });

  // Stop further notifications for this alert
  await stopAlertNotifications(alertId);

  return updated;
}
```

## Alert Escalation

### Escalation Rules

```typescript
interface EscalationRule {
  alertType: AlertType;
  severity: AlertSeverity;
  timeSinceCreation: number;  // Hours
  escalationLevel: number;
  escalationTo: string[];
  notificationChannel: string;
  actionRequired: string;
}

const escalationRules: EscalationRule[] = [
  {
    alertType: AlertType.OUT_OF_STOCK,
    severity: AlertSeverity.CRITICAL,
    timeSinceCreation: 4,
    escalationLevel: 1,
    escalationTo: ['MANAGER', 'PROCUREMENT'],
    notificationChannel: 'SMS',
    actionRequired: 'Urgent replenishment required',
  },
  {
    alertType: AlertType.EXPIRED,
    severity: AlertSeverity.CRITICAL,
    timeSinceCreation: 2,
    escalationLevel: 1,
    escalationTo: ['MANAGER', 'CHEF'],
    notificationChannel: 'SMS',
    actionRequired: 'Immediate removal required',
  },
  {
    alertType: AlertType.LOW_STOCK,
    severity: AlertSeverity.CRITICAL,
    timeSinceCreation: 24,
    escalationLevel: 1,
    escalationTo: ['MANAGER', 'PROCUREMENT'],
    notificationChannel: 'EMAIL',
    actionRequired: 'Replenishment order pending',
  },
  {
    alertType: AlertType.LOW_STOCK,
    severity: AlertSeverity.WARNING,
    timeSinceCreation: 48,
    escalationLevel: 2,
    escalationTo: ['OWNER'],
    notificationChannel: 'EMAIL',
    actionRequired: 'Review purchasing strategy',
  },
];
```

### Escalation Processing

```typescript
async function processEscalations(tenantId: string): Promise<void> {
  const unacknowledgedAlerts = await prisma.stockAlert.findMany({
    where: {
      tenantId,
      acknowledged: false,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  const now = new Date();

  for (const alert of unacknowledgedAlerts) {
    const hoursSinceCreation =
      (now.getTime() - new Date(alert.createdAt).getTime()) / (1000 * 60 * 60);

    const applicableRules = escalationRules.filter(
      (rule) =>
        rule.alertType === alert.alertType &&
        rule.severity === alert.severity &&
        hoursSinceCreation >= rule.timeSinceCreation
    );

    if (applicableRules.length > 0) {
      // Sort by escalation level (highest first)
      applicableRules.sort((a, b) => b.escalationLevel - a.escalationLevel);
      const rule = applicableRules[0];

      // Escalate
      await escalateAlert(alert, rule);
    }
  }
}

async function escalateAlert(alert: StockAlert, rule: EscalationRule): Promise<void> {
  // Send escalated notification
  for (const recipient of rule.escalationTo) {
    await sendEscalationNotification(recipient, alert, rule);
  }

  // Log escalation
  await prisma.alertEscalation.create({
    data: {
      alertId: alert.id,
      escalatedBy: 'SYSTEM',
      escalatedAt: new Date(),
      escalationLevel: rule.escalationLevel,
      notificationChannel: rule.notificationChannel,
      recipients: rule.escalationTo,
      actionRequired: rule.actionRequired,
    },
  });
}
```

## Alert Analytics

### Alert Metrics

```typescript
interface AlertMetrics {
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalAlerts: number;
  bySeverity: {
    CRITICAL: number;
    WARNING: number;
    INFO: number;
  };
  byType: {
    [key: string]: number;
  };
  acknowledgedCount: number;
  unacknowledgedCount: number;
  acknowledgmentRate: number;
  averageAcknowledgmentTime: number;  // Hours
  averageResolutionTime: number;      // Hours
  topProducts: {
    productId: string;
    productName: string;
    alertCount: number;
  }[];
  trends: {
    date: Date;
    count: number;
    severity: string;
  }[];
}
```

### Metrics Calculation

```typescript
async function calculateAlertMetrics(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<AlertMetrics> {
  const alerts = await prisma.stockAlert.findMany({
    where: {
      tenantId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const totalAlerts = alerts.length;

  const bySeverity = {
    CRITICAL: alerts.filter((a) => a.severity === 'CRITICAL').length,
    WARNING: alerts.filter((a) => a.severity === 'WARNING').length,
    INFO: alerts.filter((a) => a.severity === 'INFO').length,
  };

  const byType = alerts.reduce((acc, alert) => {
    acc[alert.alertType] = (acc[alert.alertType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const acknowledgedCount = alerts.filter((a) => a.acknowledged).length;
  const acknowledgmentRate =
    totalAlerts > 0 ? (acknowledgedCount / totalAlerts) * 100 : 0;

  const acknowledgedAlerts = alerts.filter((a) => a.acknowledged);
  const avgAckTime =
    acknowledgedAlerts.length > 0
      ? acknowledgedAlerts.reduce((sum, alert) => {
          const ackTime = alert.acknowledgedAt
            ? new Date(alert.acknowledgedAt).getTime()
            : Date.now();
          const createTime = new Date(alert.createdAt).getTime();
          return sum + (ackTime - createTime);
        }, 0) / acknowledgedAlerts.length / (1000 * 60 * 60)
      : 0;

  // Top products by alert count
  const productAlertCounts = alerts.reduce((acc, alert) => {
    acc[alert.productId] = (acc[alert.productId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topProducts = Object.entries(productAlertCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([productId, count]) => ({
      productId,
      productName: alerts.find((a) => a.productId === productId)?.productName || 'Unknown',
      alertCount: count,
    }));

  // Daily trend
  const dailyTrends = await generateDailyTrends(alerts, startDate, endDate);

  return {
    period: { startDate, endDate },
    totalAlerts,
    bySeverity,
    byType,
    acknowledgedCount,
    unacknowledgedCount: totalAlerts - acknowledgedCount,
    acknowledgmentRate,
    averageAcknowledgmentTime: avgAckTime,
    averageResolutionTime: null, // Would need resolvedAt tracking
    topProducts,
    trends: dailyTrends,
  };
}
```

## Best Practices

### For System Administrators

1. **Configure thresholds appropriately**: Set based on business needs
2. **Monitor alert volume**: Too many alerts cause alert fatigue
3. **Regular review**: Adjust alert rules quarterly
4. **Test notifications**: Ensure all channels work correctly
5. **Maintain templates**: Keep notification messages clear and actionable

### For Warehouse Managers

1. **Acknowledge alerts promptly**: Don't let critical alerts linger
2. **Document resolutions**: Track what was done to resolve each alert
3. **Analyze trends**: Look for patterns and root causes
4. **Update procedures**: Prevent recurring alerts
5. **Train staff**: Ensure everyone understands alert significance

### For Procurement Teams

1. **Respond to low stock alerts**: Reorder before stockout
2. **Review overstock alerts**: Optimize inventory levels
3. **Track supplier performance**: Alert quality affects alert volume
4. **Plan for seasonality**: Anticipate seasonal demand changes
5. **Maintain safety stocks**: Ensure buffers for critical items

---

**Version**: 1.0.0
**Last Updated**: 2026-05-31
**Status**: ✅ Implemented