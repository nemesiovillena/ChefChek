# Inventory Control Architecture

## Overview

The inventory control architecture provides a comprehensive framework for managing stock levels, tracking movements, and ensuring data accuracy through physical inventory verification. This system integrates with orders, production, and alerts to maintain real-time inventory visibility.

## System Components

```
Inventory Control System
├── Inventory Model
│   ├── Theoretical Stock
│   ├── Physical Stock
│   └── Reserved Stock
├── Movement Tracking
│   ├── Stock Movements
│   ├── Movement History
│   └── Movement Analysis
├── Verification System
│   ├── Physical Inventories
│   ├── Discrepancy Detection
│   └── Adjustment Workflow
└── Analytics
    ├── Stock Turnover
    ├── Movement Trends
    └── Accuracy Metrics
```

## Data Model

### Core Inventory Model

```typescript
interface Stock {
  id: string;
  productId: string;
  tenantId: string;
  quantity: number;                     // Current quantity
  minimumStock: number;                 // Reorder point
  maximumStock: number;                 // Maximum capacity
  reservedQuantity: number;             // Quantity reserved for orders
  availableQuantity: number;            // quantity - reservedQuantity
  averageDailyUsage: number;            // Calculated from movements
  lastMovementDate: Date;
  lastCountDate: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

**Stock Calculations:**

```typescript
// Available quantity calculation
availableQuantity = quantity - reservedQuantity

// Reorder point calculation
reorderPoint = averageDailyUsage * leadTimeDays

// Safety stock calculation
safetyStock = (averageDailyUsage * leadTimeDays) * safetyFactor

// Maximum stock calculation
maximumStock = safetyStock + (economicOrderQuantity * 2)
```

### Stock Movement Model

```typescript
interface StockMovement {
  id: string;
  tenantId: string;
  productId: string;
  warehouseId: string;
  movementType: MovementType;
  entryId?: string;
  exitId?: string;
  quantity: number;
  unit: string;
  lotNumber?: string;
  expirationDate?: Date;
  zoneId?: string;
  location?: string;
  unitCost?: number;
  totalCost?: number;
  referenceNumber?: string;
  notes?: string;
  createdAt: Date;
  createdBy: string;
}

enum MovementType {
  ENTRY = 'ENTRY',              // Receiving goods
  EXIT = 'EXIT',                // Removing goods
  ADJUSTMENT = 'ADJUSTMENT',    // Manual adjustment
  TRANSFER = 'TRANSFER',        // Between warehouses
  WASTE = 'WASTE',              // Spoiled/discarded
  RETURN = 'RETURN',            // Returned to supplier
  PRODUCTION = 'PRODUCTION',    // Used in production
}
```

### Movement History Analysis

```typescript
interface MovementAnalytics {
  productId: string;
  productName: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalEntries: number;
  totalExits: number;
  netMovement: number;
  totalEntryValue: number;
  totalExitValue: number;
  averageDailyUsage: number;
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  lotTracking: {
    lotNumber: string;
    quantity: number;
    expirationDate?: Date;
    receivedDate: Date;
    status: 'ACTIVE' | 'EXPIRED' | 'CONSUMED';
  }[];
}
```

## Inventory Accuracy Management

### Accuracy Metrics

```typescript
interface InventoryAccuracyMetrics {
  tenantId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalProducts: number;
  productsCounted: number;
  overallAccuracy: number;
  categoryAccuracy: {
    category: string;
    accuracy: number;
    discrepancies: number;
  }[];
  trend: {
    date: Date;
    accuracy: number;
  }[];
  recommendations: string[];
}
```

### Accuracy Calculation

```typescript
function calculateOverallAccuracy(inventory: PhysicalInventory): number {
  const accurateItems = inventory.items.filter(
    item => item.difference === 0
  ).length;
  const totalItems = inventory.items.length;

  return (accurateItems / totalItems) * 100;
}

function calculateCategoryAccuracy(items: PhysicalInventoryItem[]): {
  category: string;
  accuracy: number;
  discrepancies: number;
}[] {
  const categoryGroups = items.reduce((acc, item) => {
    const category = item.product?.category || 'UNCATEGORIZED';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, PhysicalInventoryItem[]>);

  return Object.entries(categoryGroups).map(([category, items]) => {
    const accurate = items.filter(i => i.difference === 0).length;
    return {
      category,
      accuracy: (accurate / items.length) * 100,
      discrepancies: items.length - accurate,
    };
  });
}
```

### Discrepancy Classification

| Discrepancy Range | Classification | Action Required                            |
|--------------------|-----------------|---------------------------------------------|
| 0%                 | Perfect         | No action                                   |
| 1-5%               | Acceptable       | Monitor trends                              |
| 6-10%              | Needs Attention | Investigate causes                            |
| 11-20%             | Significant      | Implement corrective measures               |
| > 20%              | Critical        | Immediate review and process improvement |

## FIFO (First-In, First-Out) Implementation

### FIFO Tracking

```typescript
interface FIFOQueue {
  productId: string;
  lots: {
    lotNumber: string;
    quantity: number;
    receivedDate: Date;
    expirationDate?: Date;
    unitCost: number;
  }[];
}

function getNextLotForConsumption(productId: string, quantity: number): {
  lotNumber: string;
  availableQuantity: number;
  unitCost: number;
}[] {
  const stockMovement = await getStockMovements(productId, 'ENTRY');
  const activeLots = stockMovement
    .filter(m => m.quantity > 0)
    .sort((a, b) => {
      // Sort by expiration date first, then by received date
      const aExp = a.expirationDate || new Date('2099-12-31');
      const bExp = b.expirationDate || new Date('2099-12-31');
      if (aExp.getTime() !== bExp.getTime()) {
        return aExp.getTime() - bExp.getTime();
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

  let remainingQuantity = quantity;
  const selectedLots = [];

  for (const lot of activeLots) {
    if (remainingQuantity <= 0) break;

    const availableQuantity = Math.min(lot.quantity, remainingQuantity);
    selectedLots.push({
      lotNumber: lot.lotNumber,
      availableQuantity,
      unitCost: lot.unitCost || 0,
    });

    remainingQuantity -= availableQuantity;
  }

  return selectedLots;
}
```

### FIFO Enforcement

**Stock Exit Processing:**

```typescript
async function processStockExit(exit: StockExit): Promise<void> {
  for (const item of exit.items) {
    const selectedLots = getNextLotForConsumption(
      item.productId,
      item.requestedQuantity
    );

    // Record which lots were used
    for (const lot of selectedLots) {
      await updateLotUsage(lot.lotNumber, lot.availableQuantity);
    }

    // Update stock
    await updateStock(item.productId, -item.requestedQuantity);
  }
}
```

## Reserved Stock Management

### Reservation System

```typescript
interface StockReservation {
  id: string;
  productId: string;
  stockId: string;
  referenceType: 'ORDER' | 'PRODUCTION' | 'TRANSFER';
  referenceId: string;
  referenceNumber: string;
  reservedQuantity: number;
  reservedDate: Date;
  expiryDate: Date;                   // When reservation expires
  status: 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'CANCELLED';
  notes?: string;
}
```

### Reservation Flow

```
1. Reservation Request
   ├── Identify required quantity
   ├── Check available stock (quantity - reserved)
   ├── Validate availability
   └── Create reservation record

2. Stock Commitment
   ├── Lock reserved quantity
   ├── Deduct from available
   └── Update stock reserved quantity

3. Consumption/Expiry
   ├── Mark reservation as consumed
   ├── Release reserved quantity
   └── Update stock available quantity

4. Expiry Handling (if not consumed)
   ├── Mark reservation as expired
   ├── Release reserved quantity
   └── Notify of expired reservation
```

**Reservation Logic:**

```typescript
async function reserveStock(
  productId: string,
  quantity: number,
  referenceType: string,
  referenceId: string,
  expiryHours: number = 24
): Promise<StockReservation> {
  const stock = await getStock(productId);
  const availableQuantity = stock.quantity - stock.reservedQuantity;

  if (availableQuantity < quantity) {
    throw new BadRequestException(
      `Insufficient available stock. Requested: ${quantity}, Available: ${availableQuantity}`
    );
  }

  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + expiryHours);

  const reservation = await createStockReservation({
    productId,
    stockId: stock.id,
    referenceType,
    referenceId,
    reservedQuantity: quantity,
    reservedDate: new Date(),
    expiryDate,
    status: 'ACTIVE',
  });

  // Update stock reserved quantity
  await updateStockReserved(productId, quantity);

  return reservation;
}

async function consumeReservation(reservationId: string): Promise<void> {
  const reservation = await getStockReservation(reservationId);

  if (reservation.status !== 'ACTIVE') {
    throw new BadRequestException('Reservation is not active');
  }

  // Mark as consumed
  await updateReservationStatus(reservationId, 'CONSUMED');

  // Release reserved quantity from stock
  await updateStockReserved(reservation.productId, -reservation.reservedQuantity);

  // Deduct actual stock
  await updateStock(reservation.productId, -reservation.reservedQuantity);
}
```

## Real-Time Stock Updates

### Update Mechanism

```typescript
interface StockUpdate {
  productId: string;
  warehouseId: string;
  quantity: number;
  movementType: MovementType;
  referenceId?: string;
  unit: string;
  lotNumber?: string;
  unitCost?: number;
  triggeredBy: string;
  timestamp: Date;
}

async function processStockUpdate(update: StockUpdate): Promise<void> {
  // 1. Update stock quantity
  const stock = await getStock(update.productId);
  const newQuantity = stock.quantity + update.quantity;
  
  await updateStockQuantity(update.productId, newQuantity);

  // 2. Create movement record
  await createStockMovement({
    tenantId: stock.tenantId,
    productId: update.productId,
    warehouseId: update.warehouseId,
    movementType: update.movementType,
    quantity: update.quantity,
    unit: update.unit,
    lotNumber: update.lotNumber,
    unitCost: update.unitCost,
    referenceNumber: update.referenceId,
    notes: update.notes,
    createdBy: update.triggeredBy,
  });

  // 3. Check stock alerts
  if (newQuantity <= stock.minimumStock) {
    await generateStockAlert({
      productId: update.productId,
      alertType: newQuantity === 0 ? AlertType.OUT_OF_STOCK : AlertType.LOW_STOCK,
      severity: newQuantity === 0 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
    });
  }

  // 4. Notify subscribers
  await notifyStockSubscribers(update.productId, {
    productId: update.productId,
    previousQuantity: stock.quantity,
    newQuantity: newQuantity,
    movementType: update.movementType,
  });
}
```

### Event-Driven Architecture

```
Stock Update Event
    ↓
[WebSocket Notification]
    ├→ Frontend clients (real-time dashboards)
    └→ Mobile app (notifications)

[Background Processing]
    ├→ Update cached values
    ├→ Check triggers
    └→ Generate reports

[External Integrations]
    ├→ Order system (reorder triggers)
    ├→ Production system (availability)
    └→ Supplier system (performance tracking)
```

## Stock Movement Analysis

### Usage Patterns

```typescript
interface UsagePattern {
  productId: string;
  pattern: 'CONSISTENT' | 'SEASONAL' | 'SPIKED' | 'DECLINING';
  metrics: {
    averageDailyUsage: number;
    standardDeviation: number;
    coefficientOfVariation: number;
    peakUsageDay: string;
    lowUsageDay: string;
    seasonalTrend: 'INCREASING' | 'DECREASING' | 'FLAT';
  };
  recommendations: string[];
}

async function analyzeUsagePattern(
  productId: string,
  period: number = 90
): Promise<UsagePattern> {
  const movements = await getStockMovements(productId, 'EXIT', period);
  const dailyUsage = calculateDailyUsage(movements);

  const average = calculateMean(dailyUsage);
  const stdDev = calculateStandardDeviation(dailyUsage, average);
  const cv = (stdDev / average) * 100;

  let pattern: string;
  const recommendations: string[] = [];

  if (cv < 20) {
    pattern = 'CONSISTENT';
    recommendations.push('Maintain current inventory levels');
  } else if (cv < 40) {
    pattern = 'SEASONAL';
    recommendations.push('Consider seasonal stock adjustments');
  } else if (cv < 60) {
    pattern = 'SPIKED';
    recommendations.push('Implement safety stock buffers');
  } else {
    pattern = 'DECLINING';
    recommendations.push('Review product relevance');
    recommendations.push('Reduce stock levels gradually');
  }

  return {
    productId,
    pattern,
    metrics: {
      averageDailyUsage: average,
      standardDeviation: stdDev,
      coefficientOfVariation: cv,
      peakUsageDay: findPeakUsageDay(dailyUsage),
      lowUsageDay: findLowUsageDay(dailyUsage),
      seasonalTrend: analyzeSeasonalTrend(dailyUsage),
    },
    recommendations,
  };
}
```

### Turnover Analysis

```typescript
interface TurnoverMetrics {
  productId: string;
  productName: string;
  turnoverRate: number;                 // Times inventory turned over per year
  daysInventoryOutstanding: number;     // Average days stock lasts
  annualUsage: number;
  averageInventory: number;
  category: string;
  classification: 'FAST' | 'MEDIUM' | 'SLOW' | 'DEAD';
}

async function calculateTurnoverMetrics(
  productId: string,
  period: number = 365
): Promise<TurnoverMetrics> {
  const stock = await getStock(productId);
  const movements = await getStockMovements(productId, 'EXIT', period);

  const totalCostOfGoodsSold = movements.reduce((sum, m) => {
    return sum + (m.totalCost || 0);
  }, 0);

  const averageInventoryValue = stock.quantity * (stock.product?.costPerUnit || 0);

  const turnoverRate = averageInventoryValue > 0
    ? totalCostOfGoodsSold / averageInventoryValue
    : 0;

  const daysInventoryOutstanding = turnoverRate > 0
    ? 365 / turnoverRate
    : Infinity;

  let classification: string;
  if (daysInventoryOutstanding < 30) {
    classification = 'FAST';
  } else if (daysInventoryOutstanding < 90) {
    classification = 'MEDIUM';
  } else if (daysInventoryOutstanding < 180) {
    classification = 'SLOW';
  } else {
    classification = 'DEAD';
  }

  return {
    productId,
    productName: stock.product?.name || 'Unknown',
    turnoverRate,
    daysInventoryOutstanding,
    annualUsage: movements.reduce((sum, m) => sum + m.quantity, 0),
    averageInventory: stock.quantity,
    category: stock.product?.category || 'UNCATEGORIZED',
    classification,
  };
}
```

**Turnover Classification Guidelines:**

| Classification | Days in Stock | Action                                           |
|----------------|----------------|-------------------------------------------------|
| FAST           | < 30           | Excellent, maintain levels                     |
| MEDIUM         | 30-90          | Good, monitor regularly                       |
| SLOW           | 90-180         | Review ordering frequency                      |
| DEAD           | > 180          | Consider discontinuation, reduce stock heavily |

## Batch Tracking Implementation

### Lot Number System

```typescript
interface Lot {
  lotNumber: string;
  productId: string;
  supplierId: string;
  supplierBatchNumber?: string;
  manufacturedDate: Date;
  expirationDate: Date;
  receivedDate: Date;
  initialQuantity: number;
  remainingQuantity: number;
  unit: string;
  location?: string;
  zoneId: string;
  qualityCheck?: QualityCheck;
  notes?: string;
}
```

### Lot-Based Stock Tracking

```typescript
async function getStockByLot(productId: string): Promise<Lot[]> {
  const movements = await getStockMovements(productId, 'ENTRY');

  const lots = new Map<string, Lot>();

  for (const movement of movements) {
    if (movement.lotNumber) {
      if (!lots.has(movement.lotNumber)) {
        lots.set(movement.lotNumber, {
          lotNumber: movement.lotNumber,
          productId,
          supplierId: movement.supplierId,
          manufacturedDate: movement.manufacturedDate,
          expirationDate: movement.expirationDate,
          receivedDate: movement.createdAt,
          initialQuantity: movement.quantity,
          remainingQuantity: movement.quantity,
          unit: movement.unit,
          location: movement.location,
          zoneId: movement.zoneId,
        });
      }
    }
  }

  // Deduct exits from lots (FIFO)
  const exits = await getStockMovements(productId, 'EXIT');
  let remainingToDeduct = exits.reduce((sum, e) => sum + e.quantity, 0);

  for (const [lotNumber, lot] of lots.entries()) {
    if (remainingToDeduct <= 0) break;

    const deduction = Math.min(lot.remainingQuantity, remainingToDeduct);
    lot.remainingQuantity = lot.remainingQuantity - deduction;
    remainingToDeduct -= deduction;
  }

  return Array.from(lots.values()).sort((a, b) =>
    (a.expirationDate?.getTime() || Infinity) -
    (b.expirationDate?.getTime() || Infinity)
  );
}
```

### Expiration Tracking

```typescript
interface ExpirationReport {
  productId: string;
  productName: string;
  lots: {
    lotNumber: string;
    remainingQuantity: number;
    expirationDate: Date;
    daysUntilExpiration: number;
    status: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
    value: number;
  }[];
  totalValue: number;
  atRiskValue: number;
  expiredValue: number;
}

async function generateExpirationReport(
  productId: string,
  daysThreshold: number = 30
): Promise<ExpirationReport> {
  const lots = await getStockByLot(productId);
  const today = new Date();

  const report = lots.map((lot) => {
    const daysUntilExpiration = Math.floor(
      (lot.expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    let status: string;
    if (daysUntilExpiration < 0) {
      status = 'EXPIRED';
    } else if (daysUntilExpiration <= daysThreshold) {
      status = 'EXPIRING_SOON';
    } else {
      status = 'VALID';
    }

    const product = await getProduct(productId);
    const value = lot.remainingQuantity * (product?.costPerUnit || 0);

    return {
      lotNumber: lot.lotNumber,
      remainingQuantity: lot.remainingQuantity,
      expirationDate: lot.expirationDate,
      daysUntilExpiration,
      status,
      value,
    };
  });

  const totalValue = report.reduce((sum, lot) => sum + lot.value, 0);
  const atRiskValue = report
    .filter(lot => lot.status === 'EXPIRING_SOON')
    .reduce((sum, lot) => sum + lot.value, 0);
  const expiredValue = report
    .filter(lot => lot.status === 'EXPIRED')
    .reduce((sum, lot) => sum + lot.value, 0);

  return {
    productId,
    productName: (await getProduct(productId)).name,
    lots: report,
    totalValue,
    atRiskValue,
    expiredValue,
  };
}
```

## Database Schema

```sql
CREATE TABLE Stock (
  id VARCHAR(36) PRIMARY KEY,
  productId VARCHAR(36) NOT NULL UNIQUE,
  tenantId VARCHAR(36) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  minimumStock DECIMAL(10, 2) DEFAULT 0,
  maximumStock DECIMAL(10, 2) DEFAULT 0,
  reservedQuantity DECIMAL(10, 2) DEFAULT 0,
  averageDailyUsage DECIMAL(10, 4) DEFAULT 0,
  lastMovementDate TIMESTAMP,
  lastCountDate TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (productId) REFERENCES Product(id),
  FOREIGN KEY (tenantId) REFERENCES Tenant(id),
  INDEX idx_product_id (productId),
  INDEX idx_tenant_id (tenantId),
  INDEX idx_quantity (quantity),
  INDEX idx_minimum_stock (minimumStock)
);

CREATE TABLE StockMovement (
  id VARCHAR(36) PRIMARY KEY,
  tenantId VARCHAR(36) NOT NULL,
  productId VARCHAR(36) NOT NULL,
  warehouseId VARCHAR(36) NOT NULL,
  movementType VARCHAR(20) NOT NULL,
  entryId VARCHAR(36),
  exitId VARCHAR(36),
  quantity DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  lotNumber VARCHAR(100),
  expirationDate DATE,
  zoneId VARCHAR(36),
  location VARCHAR(255),
  unitCost DECIMAL(10, 2),
  totalCost DECIMAL(10, 2),
  referenceNumber VARCHAR(100),
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  createdBy VARCHAR(100) NOT NULL,
  
  FOREIGN KEY (tenantId) REFERENCES Tenant(id),
  FOREIGN KEY (productId) REFERENCES Product(id),
  FOREIGN KEY (warehouseId) REFERENCES Warehouse(id),
  FOREIGN KEY (entryId) REFERENCES StockEntry(id),
  FOREIGN KEY (exitId) REFERENCES StockExit(id),
  FOREIGN KEY (zoneId) REFERENCES WarehouseZone(id),
  INDEX idx_tenant_product (tenantId, productId),
  INDEX idx_warehouse_id (warehouseId),
  INDEX idx_movement_type (movementType),
  INDEX idx_created_at (createdAt),
  INDEX idx_expiration_date (expirationDate)
);

CREATE TABLE StockReservation (
  id VARCHAR(36) PRIMARY KEY,
  productId VARCHAR(36) NOT NULL,
  stockId VARCHAR(36) NOT NULL,
  referenceType VARCHAR(20) NOT NULL,
  referenceId VARCHAR(36) NOT NULL,
  referenceNumber VARCHAR(100) NOT NULL,
  reservedQuantity DECIMAL(10, 2) NOT NULL,
  reservedDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiryDate TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (productId) REFERENCES Product(id),
  FOREIGN KEY (stockId) REFERENCES Stock(id),
  INDEX idx_product_id (productId),
  INDEX idx_status (status),
  INDEX idx_expiry_date (expiryDate),
  INDEX idx_reference (referenceType, referenceId)
);
```

## Best Practices

### For Inventory Managers

1. **Regular Cyclic Counts**: Implement rotating inventory counts
2. **Monitor Trends**: Track usage patterns and adjust levels
3. **Maintain FIFO**: Always use oldest stock first
4. **Review Alerts**: Check and address alerts daily
5. **Train Staff**: Ensure proper procedures are followed

### For System Administrators

1. **Performance Monitoring**: Track slow queries and optimize
2. **Data Integrity**: Regular backups and validation
3. **Alert Configuration**: Ensure alerts are working correctly
4. **User Training**: Provide comprehensive training
5. **Process Improvement**: Continuously refine procedures

## Troubleshooting

### Common Issues

**Issue: Stock discrepancies between systems**
- Solution: Compare movement histories, identify missing records, reconcile

**Issue: Incorrect FIFO calculation**
- Solution: Verify lot numbers are recorded correctly, check expiration dates

**Issue: Reservations not releasing**
- Solution: Check expiry dates, manually expire if necessary

**Issue: Alerts not triggering**
- Solution: Verify alert generation job is running, check thresholds

---

**Version**: 1.0.0
**Last Updated**: 2026-05-31
**Status**: ✅ Implemented