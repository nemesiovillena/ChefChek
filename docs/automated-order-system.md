# Automated Order System

## Overview

The automated order system intelligently analyzes inventory, historical consumption, and projected needs to generate optimized purchase orders. It classifies items by supplier and conservation zone, applies safety factors and optimization rules, and streamlines the procurement process.

## Architecture

### Core Components

```
Automated Order System
├── Requirements Calculation Engine
│   ├── Inventory Analysis
│   ├── Historical Consumption Tracking
│   ├── Safety Factor Application
│   └── Urgency Classification
├── Classification System
│   ├── By Supplier
│   ├── By Conservation Zone
│   ├── By Category
│   └── By Urgency
├── Order Generation
│   ├── Template Creation
│   ├── Optimization Rules
│   └── Cost Calculation
└── Order Management
    ├── Approval Workflow
    ├── Sending/Tracking
    └── Export Functionality
```

## Requirements Calculation

### Data Sources

1. **Current Inventory**: Real-time stock levels from inventory system
2. **Historical Consumption**: Average daily usage from recipe production
3. **Minimum Stock Levels**: Configured thresholds per product
4. **Scheduled Events**: Future production batches and events
5. **Supplier Data**: Delivery times, reliability scores, pricing tiers

### Calculation Algorithm

```typescript
async calculateOrderRequirements(tenantId, options) {
  requirements = []

  for each product:
    currentStock = getCurrentStock(productId)
    minStock = product.minimumStock
    avgDailyConsumption = calculateAverageConsumption(productId, period)
    projectedConsumption = avgDailyConsumption * lookaheadDays

    baseRequirement = max(0, minStock - currentStock)
    projectedRequirement = baseRequirement + projectedConsumption
    safetyFactor = getSafetyFactor(product)
    adjustedRequirement = projectedRequirement * safetyFactor

    packageSize = product.packageSize || 1
    suggestedQuantity = ceil(adjustedRequirement / packageSize) * packageSize

    urgency = calculateUrgency(currentStock, minStock, projectedConsumption)

    requirements.push({
      productId,
      currentStock,
      minimumStock,
      projectedConsumption,
      requiredQuantity: adjustedRequirement,
      suggestedQuantity,
      urgency,
      supplierId: product.primarySupplierId,
      conservationZone: product.conservationZone,
      estimatedCost: product.costPerUnit * suggestedQuantity
    })

  return optimizeOrderQuantities(requirements)
}
```

### Safety Factors

Safety factors protect against supply chain uncertainties:

| Product Category | Conservation Zone | Base Factor | Max Factor |
|------------------|-------------------|-------------|------------|
| PERISHABLE       | FROZEN            | 1.20        | 1.50       |
| PERISHABLE       | REFRIGERATED      | 1.30        | 1.60       |
| DRY_GOODS        | DRY_GOODS         | 1.10        | 1.30       |
| NON_PERISHABLE   | AMBIENT           | 1.05        | 1.10       |

**Supplier Reliability Adjustment**:
```typescript
reliabilityAdjustment = (1 - supplierReliability) * 0.3
finalFactor = min(maxFactor, baseFactor + reliabilityAdjustment)
```

### Urgency Classification

| Urgency Level | Condition                           | Response Time |
|---------------|-------------------------------------|---------------|
| CRITICAL      | Stock = 0 OR Stock Ratio < 0.25     | Immediate     |
| HIGH          | Stock Ratio < 0.5 OR Projected > Stock | Within 24h   |
| MEDIUM        | Stock Ratio < 0.75                  | Within 72h   |
| LOW           | Stock Ratio >= 0.75                 | Within 7 days|

## Classification System

### By Supplier

Orders grouped by primary supplier with internal sorting by urgency:

```typescript
async classifyBySupplier(requirements) {
  supplierOrders = new Map()

  for requirement in requirements:
    supplierOrders[requirement.supplierId].push(requirement)

  for each supplier:
    sort by urgency (CRITICAL > HIGH > MEDIUM > LOW)

  return supplierOrders
}
```

**Benefits**:
- Reduced shipping costs (consolidated orders)
- Leverage volume discounts
- Simplified supplier relationship management
- Batch processing of similar products

### By Conservation Zone

Orders organized by storage requirements:

```typescript
zonePriority = {
  FROZEN: 1,
  REFRIGERATED: 2,
  DRY_GOODS: 3,
  AMBIENT: 4,
  SPECIAL: 5
}
```

**Zone Definitions**:
- **FROZEN**: -18°C (Long-term frozen storage)
- **REFRIGERATED**: 4°C (Perishable short-term storage)
- **DRY_GOODS**: 15-20°C (Pantry items, grains, spices)
- **AMBIENT**: 20-25°C (Non-perishable goods)
- **SPECIAL**: Custom requirements (chemicals, specialized equipment)

### By Category

Products grouped by type for easier review:

- **MEAT**: Beef, pork, poultry, game
- **SEAFOOD**: Fish, shellfish, crustaceans
- **DAIRY**: Milk, cheese, yogurt, butter
- **PRODUCE**: Fruits, vegetables, herbs
- **DRY_GOODS**: Grains, spices, canned goods
- **BEVERAGES**: Alcoholic, non-alcoholic drinks
- **PACKAGING**: Containers, disposables

## Optimization Rules

### Rule Engine

Rules applied in priority order (0 = highest):

| ID   | Name                       | Condition                          | Action                                      | Priority |
|------|----------------------------|-----------------------------------|---------------------------------------------|----------|
| 004  | Urgencia de entrega        | urgency = CRITICAL                | Mark as priority delivery                    | 0        |
| 001  | Orden mínima por proveedor | suggestedQuantity < 50           | Round up to minimum order quantity (50)     | 1        |
| 002  | Descuento por volumen      | suggestedQuantity >= 100          | Apply 10% bulk discount                     | 2        |
| 003  | Pedido consolidado         | zone = REFRIGERATED AND qty < 30  | Consolidate to minimum (30) for efficiency  | 3        |

### Optimization Flow

```
1. Apply Rule 004: Critical items marked urgent
   ↓
2. Apply Rule 001: Small orders bumped to minimum
   ↓
3. Apply Rule 002: Volume discounts applied
   ↓
4. Apply Rule 003: Zone consolidation applied
   ↓
5. Filter out items below threshold (< 1 unit)
   ↓
6. Sort by cost-benefit ratio (consumption/cost)
```

## Order Generation

### Template Structure

```typescript
interface PurchaseOrderTemplate {
  id: string
  supplierId: string
  supplierName: string
  orderNumber: string
  generationDate: Date
  estimatedDelivery?: Date
  contactInfo: {
    email?: string
    phone?: string
    website?: string
  }
  orderItems: TemplateItem[]
  subtotal: number
  taxes: number      // 21% VAT (Spain)
  shippingCost: number  // Flat rate €15
  total: number
  notes: string
  format: 'PDF' | 'EMAIL' | 'EXCEL'
}
```

### Cost Calculation

```
Subtotal = Σ(item.adjustedQuantity × item.unitPrice)
Taxes = Subtotal × 0.21
Shipping = €15 (or supplier-specific rate)
Total = Subtotal + Taxes + Shipping
```

### Order Number Format

```
ORD-{timestamp}-{random}
Example: ORD-1717142400000-abc123
```

## Order Lifecycle

```
DRAFT → REVIEW → APPROVED → SENT → RECEIVED
  ↓         ↓         ↓        ↓
  │         │         │        └── Inventory updated
  │         │         └─── Mark as sent, track delivery
  │         └─── Manager approval
  └─── Initial creation with items
```

### State Transitions

| From      | To        | Trigger                              | Required Action              |
|-----------|-----------|--------------------------------------|------------------------------|
| DRAFT     | REVIEW    | Manager review request               | Manager review               |
| REVIEW    | APPROVED  | Manager approval                     | Approver signature          |
| APPROVED  | SENT      | Send to supplier                     | Send confirmation email     |
| SENT      | RECEIVED  | Goods received, verified             | Quality check, stock update |
| DRAFT     | CANCELLED | Cancel before sending               | Reason recording            |
| REVIEW    | DRAFT     | Return for revision                 | Revision notes              |

## Integration Points

### Inventory System

- Reads current stock levels
- Reserves stock on order creation
- Updates stock on order receipt
- Alerts on low stock thresholds

### Recipe System

- Calculates historical consumption from recipe production
- Projects future consumption from scheduled batches
- Returns ingredient breakdown for items

### Supplier System

- Retrieves supplier contact information
- Applies supplier-specific pricing tiers
- Tracks delivery performance metrics
- Maintains supplier reliability scores

### Production System

- Retrieves scheduled production batches
- Projects ingredient needs for batches
- Alerts on potential shortages for upcoming production

## API Endpoints

### Requirements Calculation

```http
POST /api/v1/orders/calculate-requirements
Body: {
  "tenantId": string,
  "historicalPeriod": number,  // Default: 7 days
  "lookaheadDays": number      // Default: 7 days
}
Response: OrderRequirement[]
```

### Order Management

```http
POST /api/v1/orders/generate
Body: {
  "tenantId": string,
  "supplierId": string,
  "urgency": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "scheduledDelivery?: Date,
  "items": CreateOrderItemDto[]
}
Response: AutomatedOrder

GET /api/v1/orders/:orderId
Response: AutomatedOrder

PUT /api/v1/orders/:orderId/items/:itemId
Body: { adjustedQuantity: number, notes?: string }
Response: OrderItem

POST /api/v1/orders/:orderId/approve
Body: { approvedBy: string }
Response: AutomatedOrder

POST /api/v1/orders/:orderId/send
Body: { sentBy: string, deliveryMethod?: string }
Response: AutomatedOrder
```

### Classification

```http
GET /api/v1/orders/classify/supplier?tenantId=xxx&historicalPeriod=7
Response: Map<string, OrderRequirement[]>

GET /api/v1/orders/classify/zone?tenantId=xxx
Response: Map<string, OrderRequirement[]>

GET /api/v1/orders/classify/category?tenantId=xxx
Response: Map<string, OrderRequirement[]>
```

### History & Tracking

```http
GET /api/v1/orders/history?tenantId=xxx
Response: AutomatedOrder[]

GET /api/v1/orders/by-supplier/:supplierId
Response: AutomatedOrder[]

GET /api/v1/orders/by-zone/:zone
Response: AutomatedOrder[]

GET /api/v1/orders/:orderId/status
Response: { orderId, status, urgency, scheduledDelivery, sentAt, receivedAt }
```

### Export

```http
GET /api/v1/orders/:orderId/export/PDF
Response: PurchaseOrderTemplate

GET /api/v1/orders/:orderId/export/EXCEL
Response: PurchaseOrderTemplate

POST /api/v1/orders/:orderId/export/email
Body: { format: "PDF" | "EXCEL", recipientEmail?: string }
Response: { template, message }
```

## Performance Considerations

### Caching Strategy

- **Requirements Cache**: Cache calculations for 5 minutes per tenant
- **Historical Data**: Pre-aggregate consumption data daily
- **Supplier Classifications**: Cache per supplier, invalidate on supplier update
- **Zone Mappings**: Static configuration, load on startup

### Optimization

- **Parallel Calculation**: Process products in parallel batches
- **Lazy Loading**: Only load product details when needed
- **Batch Updates**: Group database updates for efficiency
- **Index Strategy**: Index on (tenantId, productId), (supplierId, status)

### Scalability

- **Large Product Catalogs**: Paginate requirements calculation
- **High Order Volume**: Queue export generation asynchronously
- **Multi-tenant Isolation**: Separate database queries per tenant

## Security Considerations

### Access Control

- **calculate-requirements**: ADMIN, USER
- **generate**: ADMIN, USER
- **approve**: ADMIN, USER
- **send**: ADMIN, USER
- **history/view**: ADMIN, USER, VIEWER
- **export**: ADMIN, USER, VIEWER

### Data Protection

- Supplier contact information redacted for VIEWER role
- Cost information protected for non-admin users
- Order history retention: 2 years
- Audit log of all state transitions

## Monitoring & Alerting

### Key Metrics

- **Order Processing Time**: < 2 seconds per tenant
- **Calculation Accuracy**: < 5% variance from actual consumption
- **Order Fulfillment Rate**: > 95%
- **Supplier Response Time**: Track and flag delays

### Alerts

- **Critical Stock**: Real-time alert on CRITICAL urgency items
- **Order Overdue**: Alert when SENT > estimated delivery date + 3 days
- **Cost Spike**: Alert when order total > 50% above historical average
- **Supplier Issues**: Alert when supplier reliability drops below 70%

## Future Enhancements

1. **AI-Powered Demand Forecasting**: Machine learning models for seasonal patterns
2. **Multi-Objective Optimization**: Balance cost, freshness, and storage constraints
3. **Dynamic Pricing**: Integration with supplier real-time pricing APIs
4. **Predictive Analytics**: Predict stockouts before they occur
5. **Automated Reordering**: Fully autonomous low-risk item reordering
6. **Supplier Portal**: Direct integration with supplier ordering systems
7. **Mobile App**: On-the-go order approval and tracking
8. **Blockchain Tracking**: Immutable order history and verification

## Appendix: Example Calculations

### Example 1: Perishable Item

**Product**: Fresh Salmon
- Current Stock: 5 kg
- Minimum Stock: 20 kg
- Avg Daily Consumption: 3 kg
- Lookahead: 7 days
- Package Size: 2 kg
- Cost per Unit: €12/kg
- Supplier Reliability: 0.85

**Calculation**:
```
baseRequirement = max(0, 20 - 5) = 15 kg
projectedConsumption = 3 × 7 = 21 kg
projectedRequirement = 15 + 21 = 36 kg
safetyFactor = min(1.6, 1.3 + (1 - 0.85) × 0.3) = 1.345
adjustedRequirement = 36 × 1.345 = 48.42 kg
suggestedQuantity = ceil(48.42 / 2) × 2 = 50 kg
estimatedCost = 50 × 12 = €600
urgency = CRITICAL (5/20 < 0.25)
```

### Example 2: Dry Goods Item

**Product**: Rice (Basmati)
- Current Stock: 25 kg
- Minimum Stock: 50 kg
- Avg Daily Consumption: 2 kg
- Lookahead: 7 days
- Package Size: 5 kg
- Cost per Unit: €3/kg
- Supplier Reliability: 0.92

**Calculation**:
```
baseRequirement = max(0, 50 - 25) = 25 kg
projectedConsumption = 2 × 7 = 14 kg
projectedRequirement = 25 + 14 = 39 kg
safetyFactor = min(1.3, 1.1 + (1 - 0.92) × 0.3) = 1.124
adjustedRequirement = 39 × 1.124 = 43.84 kg
suggestedQuantity = ceil(43.84 / 5) × 5 = 45 kg
estimatedCost = 45 × 3 = €135
urgency = MEDIUM (25/50 < 0.75)
```

---

**Version**: 1.0.0
**Last Updated**: 2026-05-31
**Status**: ✅ Implemented