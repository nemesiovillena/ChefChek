# Warehouse Management System

## Overview

The warehouse management system provides comprehensive control over inventory, stock movements, physical inventories, and automated alerts. It tracks the complete flow of products from receiving to consumption, including quality control, stock verification, and discrepancy analysis.

## Architecture

### Core Components

```
Warehouse Management System
├── Warehouse Management
│   ├── Warehouse CRUD
│   ├── Zone Configuration
│   └── Capacity Monitoring
├── Stock Movements
│   ├── Stock Entries (Receipts)
│   ├── Stock Exits (Issues)
│   └── Movement History
├── Inventory Control
│   ├── Physical Inventories
│   ├── Theoretical vs Real Comparison
│   └── Discrepancy Analysis
└── Alert System
    ├── Low Stock Alerts
    ├── Expiration Alerts
    └── Discrepancy Notifications
```

## Warehouse Types

### Warehouse Categories

| Type ID      | Type Name      | Description                        | Typical Products               |
|--------------|----------------|------------------------------------|---------------------------------|
| MAIN         | Principal      | Main storage facility            | General inventory               |
| KITCHEN      | Kitchen        | On-site kitchen storage           | Ready-to-use ingredients        |
| COLD_STORAGE | Cold Storage   | Refrigerated & frozen storage     | Perishable items                 |
| DRY_STORAGE  | Dry Storage    | Ambient temperature storage       | Dry goods, non-perishables      |
| SPECIAL      | Special        | Specialized storage requirements  | Hazardous materials, chemicals  |

### Warehouse Capacity Management

```typescript
interface WarehouseCapacity {
  warehouseId: string;
  totalCapacity: number;
  currentUsage: number;
  usagePercentage: number;
  zones: {
    zoneId: string;
    zoneName: string;
    capacity: number;
    currentUsage: number;
    availableSpace: number;
  }[];
}
```

**Usage Thresholds:**
- < 70%: Normal (green)
- 70-90%: Warning (yellow)
- > 90%: Critical (red)

## Stock Entry Management

### Receiving Workflow

```
1. Purchase Order Arrival
   ├── Supplier delivers goods
   ├── Invoice verification
   └── Initial documentation

2. Quality Inspection
   ├── Visual inspection
   ├── Temperature check
   ├── Package integrity
   └── Expiration date verification

3. Entry Verification
   ├── Compare received vs ordered
   ├── Record actual quantities
   ├── Note any discrepancies
   └── Pass/fail quality check

4. Stock Processing
   ├── Update inventory
   ├── Create stock movement record
   ├── Assign to storage zone
   └── Generate receipt confirmation
```

### Entry Data Structure

```typescript
interface StockEntry {
  id: string;
  tenantId: string;
  warehouseId: string;
  entryNumber: string;                    // Format: ENT-1717142400000-abc123
  supplierId: string;
  supplierName: string;
  invoiceNumber?: string;
  receivedDate: Date;
  receivedBy: string;
  status: EntryStatus;
  items: StockEntryItem[];
  subtotal: number;
  taxes: number;
  shippingCost: number;
  total: number;
  notes?: string;
}

interface StockEntryItem {
  id: string;
  entryId: string;
  productId: string;
  productName: string;
  lotNumber?: string;
  expirationDate?: Date;
  receivedQuantity: number;
  verifiedQuantity?: number;
  unit: string;
  unitPrice: number;
  totalCost: number;
  qualityCheck: QualityCheck;
  notes?: string;
}
```

### Quality Control Checklist

**Per Item:**
- [ ] Visual inspection (damage, discoloration)
- [ ] Temperature verification (if applicable)
- [ ] Package integrity (sealed, intact)
- [ ] Expiration date check (within acceptable range)
- [ ] Quantity verification (matches invoice)
- [ ] Document completeness (labels, certificates)

**Quality Check Results:**

| Result  | Action                                                                 |
|---------|-------------------------------------------------------------------------|
| PASS    | Process to stock, no issues                                          |
| FAIL    | Reject item, return to supplier, document reason                       |
| PENDING | Quarantine for further inspection, document concerns                      |

### Entry Status Flow

```
PENDING → RECEIVED → VERIFIED → PROCESSED
  ↓          ↓          ↓           ↓
Created   Goods      Quality     Stock
          arrived   checked      updated
```

## Stock Exit Management

### Exit Workflow

```
1. Stock Request
   ├── Production needs identified
   ├── Material requisition created
   └── Stock availability checked

2. Approval Process
   ├── Manager reviews request
   ├── Approve or reject
   └── Notify requester

3. Picking & Packing
   ├── Locate items in warehouse
   ├── Verify quantities
   ├── Update picked quantities
   └── Package for delivery

4. Stock Processing
   ├── Deduct from inventory
   ├── Create stock movement record
   ├── Update theoretical stock
   └── Generate exit documentation
```

### Exit Data Structure

```typescript
interface StockExit {
  id: string;
  tenantId: string;
  warehouseId: string;
  exitNumber: string;                     // Format: EXIT-1717142400000-abc123
  exitType: ExitType;
  destinationId?: string;
  requestedDate: Date;
  requestedBy: string;
  approvedBy?: string;
  status: ExitStatus;
  items: StockExitItem[];
}

interface StockExitItem {
  id: string;
  exitId: string;
  productId: string;
  productName: string;
  lotNumber?: string;
  requestedQuantity: number;
  pickedQuantity?: number;
  unit: string;
  zoneId: string;
  location?: string;
  notes?: string;
}
```

### Exit Types

| Type ID   | Type Name   | Description                              | Documentation Required |
|-----------|-------------|------------------------------------------|-------------------------|
| PRODUCTION| Production  | Materials for food production           | Production order reference |
| TRANSFER  | Transfer    | Moving between warehouses/locations      | Transfer authorization   |
| WASTE     | Waste       | Discarded or spoiled items               | Waste report             |
| RETURN    | Return      | Returns to suppliers                     | RMA authorization       |

### Exit Status Flow

```
PENDING → APPROVED → PICKED → PROCESSED
  ↓         ↓          ↓         ↓
Created   Manager    Items     Stock
          approved   selected   deducted
```

## Physical Inventory Management

### Inventory Types

| Type ID  | Type Name   | Description                              | Frequency          |
|----------|-------------|------------------------------------------|--------------------|
| FULL     | Complete    | Count all items in warehouse             | Annually or quarterly |
| PARTIAL  | Partial     | Count specific products or categories    | Monthly or weekly   |
| CYCLIC   | Cyclic      | Rotate through products over time         | Ongoing             |

### Inventory Process

```
1. Planning
   ├── Select inventory type
   ├── Choose products to count
   ├── Schedule date and time
   └── Assign team

2. Counting
   ├── Load theoretical quantities
   ├── Count physical quantities
   ├── Record lot numbers and locations
   └── Note any discrepancies

3. Comparison
   ├── Compare theoretical vs physical
   ├── Calculate differences
   ├── Identify discrepancy reasons
   └── Generate discrepancy report

4. Review & Adjustment
   ├── Manager review of discrepancies
   ├── Approve or adjust counts
   ├── Update stock if necessary
   └── Document decisions

5. Reporting
   ├── Generate inventory summary
   ├── Calculate accuracy rate
   ├── Identify trends
   └── Update inventory procedures
```

### Inventory Data Structure

```typescript
interface PhysicalInventory {
  id: string;
  tenantId: string;
  warehouseId: string;
  inventoryNumber: string;             // Format: INV-1717142400000-abc123
  inventoryType: InventoryType;
  inventoryDate: Date;
  conductedBy: string;
  reviewedBy?: string;
  status: InventoryStatus;
  items: PhysicalInventoryItem[];
  summary: InventorySummary;
}

interface PhysicalInventoryItem {
  id: string;
  inventoryId: string;
  productId: string;
  productName: string;
  theoreticalQuantity: number;
  physicalQuantity: number;
  difference: number;
  unit: string;
  lotNumber?: string;
  location?: string;
  countedBy: string;
  countedAt: Date;
  notes?: string;
}

interface InventorySummary {
  totalItems: number;                    // Total items counted
  totalValue: number;                    // Total inventory value
  discrepancies: number;                  // Items with discrepancies
  totalDiscrepancyValue: number;        // Value of discrepancies
  accuracyRate: number;                  // Percentage accuracy
}
```

### Accuracy Calculation

```typescript
function calculateAccuracy(inventory: PhysicalInventory): number {
  const itemsWithNoDiscrepancy = inventory.items.filter(
    item => item.difference === 0
  ).length;
  const totalItems = inventory.items.length;

  return (itemsWithNoDiscrepancy / totalItems) * 100;
}

// Example:
// Total items: 100
// Items with discrepancies: 15
// Items without discrepancies: 85
// Accuracy rate: 85%
```

### Discrepancy Analysis

**Common Discrepancy Reasons:**

| Category      | Possible Causes                         | Mitigation                     |
|---------------|-----------------------------------------|--------------------------------|
| Theft/Loss    | Unrecorded usage, pilferage              | Access controls, cameras       |
| Calculation    | Math errors, rounding                   | Digital systems, double-check   |
| Documentation | Missing receipts, unrecorded entries    | Mandatory documentation         |
| Quality Issues | Damaged goods discarded without record   | Waste reporting procedure       |
| System Errors  | Data entry mistakes, software bugs        | Data validation, testing       |

**Discrepancy Value Calculation:**

```typescript
function calculateDiscrepancyValue(item: PhysicalInventoryItem): number {
  const productCost = item.product?.costPerUnit || 0;
  return Math.abs(item.difference) * productCost;
}
```

## Stock Alert System

### Alert Types

| Type ID        | Type Name       | Trigger Condition                                   | Severity      |
|----------------|----------------|----------------------------------------------------|--------------|
| LOW_STOCK      | Low Stock       | Current stock < minimum stock                       | WARNING      |
| OUT_OF_STOCK   | Out of Stock    | Current stock = 0                                   | CRITICAL     |
| EXPIRING_SOON  | Expiring Soon   | Expiration date within 7 days                         | WARNING      |
| EXPIRED        | Expired         | Expiration date passed                              | CRITICAL     |
| OVERSTOCK      | Overstock       | Current stock > 2x average usage                     | INFO         |

### Alert Severity Levels

| Severity  | Response Time                     | Action Required                           |
|----------|-----------------------------------|-------------------------------------------|
| INFO     | Monitor regularly                  | Review during normal planning               |
| WARNING  | Within 24-48 hours                  | Plan replenishment or disposal              |
| CRITICAL | Immediate action required           | Urgent replenishment or removal             |

### Alert Generation Algorithm

```typescript
async function generateStockAlerts(tenantId: string): Promise<StockAlert[]> {
  const alerts: StockAlert[] = [];

  // 1. Check low stock alerts
  const products = await getProducts(tenantId);
  for (const product of products) {
    const stock = product.stock?.quantity || 0;
    const minStock = product.minimumStock || 0;

    if (stock < minStock && stock > 0) {
      alerts.push({
        tenantId,
        productId: product.id,
        productName: product.name,
        alertType: AlertType.LOW_STOCK,
        severity: AlertSeverity.WARNING,
        message: `Producto ${product.name} bajo stock mínimo (${stock}/${minStock})`,
        currentStock: stock,
        minimumStock: minStock,
      });
    }

    if (stock === 0) {
      alerts.push({
        tenantId,
        productId: product.id,
        productName: product.name,
        alertType: AlertType.OUT_OF_STOCK,
        severity: AlertSeverity.CRITICAL,
        message: `Producto ${product.name} sin stock`,
        currentStock: stock,
      });
    }
  }

  // 2. Check expiration alerts
  const stockMovements = await getStockMovements(tenantId);
  const today = new Date();
  const expiringSoonThreshold = new Date();
  expiringSoonThreshold.setDate(today.getDate() + 7);

  for (const movement of stockMovements) {
    if (movement.expirationDate) {
      const expirationDate = new Date(movement.expirationDate);
      const daysUntilExpiration = Math.floor(
        (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilExpiration < 0) {
        alerts.push({
          tenantId: movement.product?.tenantId,
          productId: movement.productId,
          productName: movement.product?.name,
          alertType: AlertType.EXPIRED,
          severity: AlertSeverity.CRITICAL,
          message: `Producto ${movement.product?.name} caducado`,
          expirationDate: movement.expirationDate,
          daysUntilExpiration,
        });
      } else if (daysUntilExpiration <= 7) {
        alerts.push({
          tenantId: movement.product?.tenantId,
          productId: movement.productId,
          productName: movement.product?.name,
          alertType: AlertType.EXPIRING_SOON,
          severity: AlertSeverity.WARNING,
          message: `Producto ${movement.product?.name} caduca en ${daysUntilExpiration} días`,
          expirationDate: movement.expirationDate,
          daysUntilExpiration,
        });
      }
    }
  }

  return alerts;
}
```

### Alert Data Structure

```typescript
interface StockAlert {
  id: string;
  tenantId: string;
  productId: string;
  productName: string;
  warehouseId?: string;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  currentStock: number;
  minimumStock?: number;
  expirationDate?: Date;
  daysUntilExpiration?: number;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
}
```

## API Endpoints

### Warehouse Management
```http
GET /api/v1/warehouses?tenantId={tenantId} - List warehouses (ADMIN/USER/VIEWER)
GET /api/v1/warehouses/:id - Get warehouse (ADMIN/USER/VIEWER)
POST /api/v1/warehouses - Create warehouse (ADMIN)
PUT /api/v1/warehouses/:id - Update warehouse (ADMIN)
DELETE /api/v1/warehouses/:id - Deactivate warehouse (ADMIN)
GET /api/v1/warehouses/:id/zones - Get warehouse zones (ADMIN/USER/VIEWER)
POST /api/v1/warehouses/:id/zones - Create zone (ADMIN)
```

### Stock Entries
```http
POST /api/v1/warehouses/entries - Create entry (ADMIN/USER)
GET /api/v1/warehouses/entries?warehouseId={id} - List entries (ADMIN/USER/VIEWER)
GET /api/v1/warehouses/entries/:id - Get entry (ADMIN/USER/VIEWER)
PUT /api/v1/warehouses/entries/:id/verify - Verify entry (ADMIN/USER)
PUT /api/v1/warehouses/entries/:id/process - Process entry (ADMIN/USER)
```

### Stock Exits
```http
POST /api/v1/warehouses/exits - Create exit (ADMIN/USER)
GET /api/v1/warehouses/exits?warehouseId={id} - List exits (ADMIN/USER/VIEWER)
GET /api/v1/warehouses/exits/:id - Get exit (ADMIN/USER/VIEWER)
PUT /api/v1/warehouses/exits/:id/approve - Approve exit (ADMIN)
PUT /api/v1/warehouses/exits/:id/items/:itemId/pick - Pick item (ADMIN/USER)
PUT /api/v1/warehouses/exits/:id/process - Process exit (ADMIN/USER)
```

### Physical Inventories
```http
POST /api/v1/warehouses/inventories - Create inventory (ADMIN/USER)
GET /api/v1/warehouses/inventories?warehouseId={id} - List inventories (ADMIN/USER/VIEWER)
GET /api/v1/warehouses/inventories/:id - Get inventory (ADMIN/USER/VIEWER)
PUT /api/v1/warehouses/inventories/:id/items/:itemId/count - Count item (ADMIN/USER)
PUT /api/v1/warehouses/inventories/:id/complete - Complete inventory (ADMIN/USER)
GET /api/v1/warehouses/inventories/:id/comparison - Get comparison (ADMIN/USER/VIEWER)
```

### Stock Alerts
```http
GET /api/v1/warehouses/alerts?tenantId={tenantId} - List alerts (ADMIN/USER/VIEWER)
GET /api/v1/warehouses/alerts/unacknowledged?tenantId={tenantId} - Unacknowledged (ADMIN/USER/VIEWER)
POST /api/v1/warehouses/alerts/generate - Generate alerts (ADMIN/USER)
PUT /api/v1/warehouses/alerts/:id/acknowledge - Acknowledge alert (ADMIN/USER)
```

## Performance Considerations

### Caching Strategy

- **Warehouse Configurations**: Cache for 1 hour
- **Current Stock**: Cache for 5 minutes per product
- **Alert Generation**: Run every 15 minutes via cron
- **Inventory Summaries**: Calculate on-demand, cache for 30 minutes

### Bulk Operations

- **Stock Entries**: Process items in batches of 100
- **Stock Exits**: Validate stock availability before approval
- **Inventory Counting**: Allow partial updates, don't block UI
- **Alert Generation**: Async processing with queue

### Database Indexing

```sql
-- Critical indexes
CREATE INDEX idx_stock_entries_warehouse ON StockEntry(warehouseId, receivedDate);
CREATE INDEX idx_stock_exits_warehouse ON StockExit(warehouseId, requestedDate);
CREATE INDEX idx_stock_movements_product ON StockMovement(productId);
CREATE INDEX idx_stock_alerts_tenant_acknowledged ON StockAlert(tenantId, acknowledged);
CREATE INDEX idx_physical_inventories_warehouse ON PhysicalInventory(warehouseId, inventoryDate);
```

## Security Considerations

### Access Control

| Operation           | Roles                   |
|---------------------|-------------------------|
| View warehouses      | ADMIN, USER, VIEWER     |
| Create warehouse     | ADMIN                   |
| Manage entries/exits | ADMIN, USER             |
| Conduct inventory     | ADMIN, USER             |
| View alerts           | ADMIN, USER, VIEWER     |
| Acknowledge alerts   | ADMIN, USER             |

### Audit Trail

All stock movements are logged:
- Entry/Exit creation
- Stock updates
- Quality checks
- Inventory adjustments
- Alert acknowledgments

## Best Practices

### For Receiving Staff

1. **Verify all documentation**: Invoice, delivery note, packing list
2. **Check quality first**: Before quantity verification
3. **Record discrepancies**: Note any differences immediately
4. **Follow FIFO**: Place new stock behind existing
5. **Label everything**: Product name, lot number, expiration date

### For Warehouse Managers

1. **Regular inventories**: Schedule cyclic inventories
2. **Monitor capacity**: Don't exceed 90% capacity
3. **Track trends**: Identify patterns in discrepancies
4. **Train staff**: Ensure proper procedures are followed
5. **Review alerts**: Check and address daily

### For IT System Administrators

1. **Monitor performance**: Track slow queries
2. **Regular backups**: Daily backups of inventory data
3. **Security patches**: Keep systems updated
4. **Alert configuration**: Ensure alerts are working
5. **User training**: Train staff on system usage

## Integration Points

### With Order System

- Stock entries update from purchase orders
- Stock exits for production orders
- Automated low stock triggers reorders

### With Production System

- Stock exits linked to production batches
- Material requirements auto-generated
- Usage tracking per production

### With Supplier System

- Supplier performance based on entry quality
- Returns tracked per supplier
- Supplier ratings updated automatically

---

**Version**: 1.0.0
**Last Updated**: 2026-05-31
**Status**: ✅ Implemented