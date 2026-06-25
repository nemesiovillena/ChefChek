# Supplier Classification System

## Overview

The supplier classification system organizes suppliers based on product categories, conservation zones, delivery performance, pricing tiers, and preferred status. This classification enables optimized order consolidation, better negotiation leverage, and improved supply chain reliability.

## Supplier Categories

### By Product Type

Suppliers are categorized by the types of products they supply:

| Category ID  | Category Name       | Subcategories                                 |
|--------------|---------------------|-----------------------------------------------|
| MEAT         | Meats               | Beef, Pork, Poultry, Game, Processed Meats   |
| SEAFOOD      | Seafood             | Fish, Shellfish, Crustaceans, Frozen          |
| DAIRY        | Dairy Products      | Milk, Cheese, Yogurt, Butter, Cream           |
| PRODUCE      | Fresh Produce       | Fruits, Vegetables, Herbs, Exotic             |
| DRY_GOODS    | Dry Goods           | Grains, Spices, Oils, Canned Goods, Nuts      |
| BEVERAGES    | Beverages          | Alcoholic, Non-Alcoholic, Soft Drinks, Coffee |
| PACKAGING    | Packaging Materials | Containers, Disposables, Labels, Boxes        |
| EQUIPMENT    | Kitchen Equipment   | Cookware, Utensils, Small Appliances         |

### Multi-Category Suppliers

Suppliers can span multiple categories:
- **Generalist**: 4+ categories (e.g., Sysco, Metro)
- **Specialist**: 1-2 categories (e.g., local meat wholesaler, specialty bakery)
- **Niche**: Single category (e.g., truffle importer, olive oil producer)

## Conservation Zones

Suppliers are mapped to the conservation zones they serve:

| Zone ID     | Zone Name        | Temperature | Products                              | Suppliers            |
|-------------|------------------|-------------|---------------------------------------|----------------------|
| FROZEN      | Frozen Storage   | -18°C       | Frozen meats, seafood, vegetables     | Cold chain specialists |
| REFRIGERATED| Refrigerated     | 4°C         | Fresh meats, dairy, produce           | Daily delivery vendors |
| DRY_GOODS   | Dry Goods        | 15-20°C     | Grains, spices, canned goods          | Warehouse distributors |
| AMBIENT     | Ambient          | 20-25°C     | Non-perishables, packaging, equipment | General suppliers   |
| SPECIAL     | Special          | Variable    | Hazardous materials, pharmaceuticals   | Licensed vendors    |

### Zone Priority for Order Consolidation

```
1. FROZEN (highest - strict temperature control)
2. REFRIGERATED (perishable, shorter shelf life)
3. DRY_GOODS (shelf-stable but quality-sensitive)
4. AMBIENT (non-perishable)
5. SPECIAL (specialized handling)
```

## Delivery Performance Metrics

### Tracked Metrics

| Metric                      | Description                                      | Weight in Score |
|-----------------------------|--------------------------------------------------|-----------------|
| On-time Delivery Rate       | % of orders delivered on or before deadline      | 30%             |
| Order Accuracy              | % of orders delivered without errors            | 25%             |
| Product Quality             | Average quality rating (1-5)                     | 20%             |
| Communication Responsiveness| Response time to queries (hours)                 | 15%             |
| Competitive Pricing         | Price relative to market average                 | 10%             |

### Reliability Score Calculation

```typescript
function calculateReliabilityScore(supplierMetrics: SupplierMetrics): number {
  const weights = {
    onTimeDelivery: 0.30,
    orderAccuracy: 0.25,
    productQuality: 0.20,
    responsiveness: 0.15,
    pricing: 0.10
  }

  const scores = {
    onTimeDelivery: supplierMetrics.onTimeRate * 100,
    orderAccuracy: supplierMetrics.accuracyRate * 100,
    productQuality: supplierMetrics.qualityRating * 20,
    responsiveness: max(0, 100 - (supplierMetrics.avgResponseHours / 24 * 100)),
    pricing: max(0, 100 - ((supplierMetrics.priceMarkup - 0.1) * 500))
  }

  return (
    weights.onTimeDelivery * scores.onTimeDelivery +
    weights.orderAccuracy * scores.orderAccuracy +
    weights.productQuality * scores.productQuality +
    weights.responsiveness * scores.responsiveness +
    weights.pricing * scores.pricing
  )
}
```

### Reliability Score Tiers

| Score Range | Tier         | Implications                                   |
|-------------|--------------|------------------------------------------------|
| 90-100      | EXCELLENT    | Primary supplier, highest priority            |
| 80-89       | GOOD         | Reliable, preferred for most orders           |
| 70-79       | ACCEPTABLE   | Backup supplier, monitor closely              |
| 60-69       | NEEDS IMPROVEMENT | Review relationship, seek alternatives    |
| < 60        | UNACCEPTABLE  | Deprioritize, replace if possible             |

## Pricing Tiers

### Tier Classification

| Tier ID    | Tier Name       | Price Level | Typical Suppliers                     | Order Strategy                     |
|------------|-----------------|-------------|---------------------------------------|------------------------------------|
| LOW        | Budget          | Below market  | Large distributors, wholesale clubs   | Bulk orders, non-critical items    |
| MEDIUM     | Competitive     | Market rate  | Most suppliers                        | Regular orders, standard items     |
| HIGH       | Premium         | Above market  | Specialty, organic, artisan suppliers | High-value, quality-sensitive items |

### Price Tier Determination

```typescript
function determinePriceTier(supplier: Supplier): PriceTier {
  const avgMarketPrice = getMarketAveragePrice(supplier.category)
  const supplierMarkup = (supplier.avgPrice - avgMarketPrice) / avgMarketPrice

  if (supplierMarkup < -0.05) return PriceTier.LOW       // 5% below market
  if (supplierMarkup <= 0.10) return PriceTier.MEDIUM    // Within ±10%
  return PriceTier.HIGH                                      // >10% above market
}
```

## Preferred Status

### Status Levels

| Status ID   | Status Name   | Usage Guidelines                               | % of Orders  |
|-------------|---------------|------------------------------------------------|--------------|
| PREFERRED   | Preferred     | Primary supplier, use whenever possible       | 60-80%       |
| ALTERNATIVE | Alternative   | Backup supplier, use when preferred unavailable | 15-30%       |
| EMERGENCY   | Emergency     | Last resort, use only when necessary          | 0-5%         |

### Status Assignment Rules

```typescript
function determinePreferredStatus(supplier: Supplier): PreferredStatus {
  // Preferred: High reliability, competitive pricing, good communication
  if (
    supplier.reliabilityScore >= 80 &&
    supplier.priceTier !== PriceTier.HIGH &&
    supplier.avgResponseHours < 24
  ) {
    return PreferredStatus.PREFERRED
  }

  // Alternative: Decent reliability, acceptable pricing
  if (
    supplier.reliabilityScore >= 70 &&
    supplier.priceTier !== PriceTier.HIGH
  ) {
    return PreferredStatus.ALTERNATIVE
  }

  // Emergency: Low reliability, high prices, or poor communication
  return PreferredStatus.EMERGENCY
}
```

### Order Distribution Strategy

```
60% PREFERRED suppliers → Regular bulk orders
30% ALTERNATIVE suppliers → Risk diversification
10% EMERGENCY suppliers → Critical backup only
```

## Contact Information Structure

```typescript
interface SupplierContactInfo {
  // Primary Contact
  email?: string          // Primary business email
  phone?: string          // Primary phone number
  website?: string        // Company website
  
  // Secondary Contact (optional)
  secondaryEmail?: string
  secondaryPhone?: string
  
  // Communication Preferences
  preferredContactMethod: 'EMAIL' | 'PHONE' | 'WEB_PORTAL'
  workingHours: {
    start: string         // "09:00"
    end: string           // "18:00"
    timezone: string      // "Europe/Madrid"
  }
  
  // Emergency Contact
  emergencyContact?: {
    name: string
    phone: string
    email: string
  }
  
  // Order Channels
  orderMethods: string[]  // ['EMAIL', 'WEB_PORTAL', 'PHONE', 'FAX']
}
```

## Order Methods

### Supported Methods

| Method ID     | Method Name      | Description                              | Benefits                          | Drawbacks                          |
|---------------|------------------|------------------------------------------|-----------------------------------|------------------------------------|
| EMAIL         | Email Order      | Send order as PDF/Excel via email        | Simple, record-keeping, flexible  | Manual processing, slower response |
| WEB_PORTAL    | Web Portal       | Order through supplier website           | Real-time inventory, automation   | Learning curve, dependency        |
| EDI           | EDI Integration  | Electronic Data Interchange              | Fully automated, real-time        | Complex setup, maintenance        |
| PHONE         | Phone Call       | Order via phone call                     | Personal service, clarification   | No record, human error risk       |
| FAX           | Fax              | Order via fax machine                    | Legal record, familiar            | Outdated, manual processing       |

### Method Selection Matrix

```
┌─────────────────────┬──────────┬──────────┬──────────┬──────────┐
│ Volume              │ High     │ Medium   │ Low      │ Critical │
├─────────────────────┼──────────┼──────────┼──────────┼──────────┤
│ Large Supplier      │ EDI      │ WEB      │ EMAIL    │ PHONE    │
│ Medium Supplier     │ WEB      │ EMAIL    │ EMAIL    │ PHONE    │
│ Small Supplier      │ EMAIL    │ EMAIL    │ PHONE    │ PHONE    │
│ Emergency Order     │ PHONE    │ PHONE    │ PHONE    │ PHONE    │
└─────────────────────┴──────────┴──────────┴──────────┴──────────┘
```

## Supplier Performance Tracking

### Performance Dashboard

**Key Metrics Display**:
- Overall Reliability Score (0-100)
- On-time Delivery Rate (%)
- Average Response Time (hours)
- Total Orders (YTD)
- Total Spend (YTD)
- Price Comparison vs. Market (%)

### Trend Analysis

**30-Day Trends**:
- Delivery reliability trend (up/down/stable)
- Pricing trend (increasing/stable/decreasing)
- Quality rating trend
- Response time improvement/degradation

### Alert Conditions

Alerts triggered when:
- On-time delivery rate drops below 80%
- Average response time exceeds 48 hours
- Product quality rating falls below 3.5
- Price increases >15% vs. market average
- Three consecutive late deliveries

## Supplier Relationship Management

### Supplier Scorecard

```typescript
interface SupplierScorecard {
  supplierId: string
  supplierName: string
  
  // Performance Metrics
  reliabilityScore: number
  onTimeDeliveryRate: number
  orderAccuracyRate: number
  qualityRating: number
  avgResponseHours: number
  
  // Volume Metrics
  totalOrders: number
  totalSpend: number
  avgOrderValue: number
  
  // Comparison
  priceVsMarket: number
  rankAmongSuppliers: number
  totalSuppliersInCategory: number
  
  // Status
  preferredStatus: PreferredStatus
  priceTier: PriceTier
  
  // Trends
  last90DaysTrend: 'IMPROVING' | 'STABLE' | 'DECLINING'
  
  // Recommendations
  recommendedActions: string[]
}
```

### Quarterly Review Process

1. **Data Collection** (Week 1)
   - Pull all performance metrics
   - Gather internal feedback
   - Survey supplier satisfaction

2. **Analysis** (Week 2)
   - Calculate updated scores
   - Identify trends and patterns
   - Flag issues and opportunities

3. **Review Meeting** (Week 3)
   - Present findings to supplier
   - Discuss improvement areas
   - Negotiate better terms if applicable

4. **Action Plan** (Week 4)
   - Document agreed actions
   - Set KPIs for next quarter
   - Update supplier classification

## Supplier Database Schema

```sql
CREATE TABLE Supplier (
  id VARCHAR(36) PRIMARY KEY,
  tenantId VARCHAR(36) NOT NULL,
  
  -- Basic Information
  name VARCHAR(255) NOT NULL,
  taxId VARCHAR(50),
  businessType VARCHAR(100),
  
  -- Contact Information
  email VARCHAR(255),
  phone VARCHAR(50),
  secondaryEmail VARCHAR(255),
  secondaryPhone VARCHAR(50),
  website VARCHAR(255),
  preferredContactMethod VARCHAR(20),
  
  -- Performance Metrics
  reliabilityScore DECIMAL(5,2) DEFAULT 75,
  onTimeDeliveryRate DECIMAL(5,2) DEFAULT 85,
  orderAccuracyRate DECIMAL(5,2) DEFAULT 90,
  qualityRating DECIMAL(3,2) DEFAULT 4.0,
  avgResponseHours DECIMAL(5,2) DEFAULT 12,
  
  -- Classification
  priceTier VARCHAR(10) DEFAULT 'MEDIUM',
  preferredStatus VARCHAR(15) DEFAULT 'ALTERNATIVE',
  averageDeliveryTime INT DEFAULT 3,
  
  -- Product Coverage
  categories JSONB,              -- Array of category strings
  conservationZones JSONB,       -- Array of zone strings
  
  -- Order Methods
  orderMethods JSONB,            -- Array of method strings
  
  -- Pricing
  avgPriceMarkup DECIMAL(5,4),
  
  -- Working Hours
  workingHoursStart VARCHAR(5) DEFAULT '09:00',
  workingHoursEnd VARCHAR(5) DEFAULT '18:00',
  timezone VARCHAR(50) DEFAULT 'Europe/Madrid',
  
  -- Emergency Contact
  emergencyContactName VARCHAR(255),
  emergencyContactPhone VARCHAR(50),
  emergencyContactEmail VARCHAR(255),
  
  -- Metadata
  active BOOLEAN DEFAULT true,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (tenantId) REFERENCES Tenant(id),
  INDEX idx_tenant_id (tenantId),
  INDEX idx_price_tier (priceTier),
  INDEX idx_preferred_status (preferredStatus),
  INDEX idx_reliability_score (reliabilityScore)
);

CREATE TABLE SupplierProduct (
  id VARCHAR(36) PRIMARY KEY,
  supplierId VARCHAR(36) NOT NULL,
  productId VARCHAR(36) NOT NULL,
  
  -- Product Details from Supplier
  supplierProductCode VARCHAR(100),
  supplierProductName VARCHAR(255),
  unitPrice DECIMAL(10,2),
  minOrderQuantity INT,
  packageSize DECIMAL(10,2),
  
  -- Availability
  available BOOLEAN DEFAULT true,
  leadTimeDays INT,
  
  -- Classification
  isPrimarySupplier BOOLEAN DEFAULT false,
  
  -- Metadata
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (supplierId) REFERENCES Supplier(id),
  FOREIGN KEY (productId) REFERENCES Product(id),
  UNIQUE (supplierId, productId),
  INDEX idx_supplier_id (supplierId),
  INDEX idx_product_id (productId),
  INDEX idx_is_primary (isPrimarySupplier)
);
```

## Integration with Order System

### Automatic Supplier Selection

```typescript
async selectSupplierForOrder(productId: string, urgency: Urgency): Promise<string> {
  const product = await getProduct(productId)
  const supplierProducts = await getSupplierProducts(productId)
  
  // Sort by reliability and status
  const rankedSuppliers = supplierProducts
    .filter(sp => sp.available)
    .sort((a, b) => {
      // Critical orders prioritize reliability over price
      if (urgency === Urgency.CRITICAL) {
        return b.supplier.reliabilityScore - a.supplier.reliabilityScore
      }
      // Regular orders balance reliability and price
      return (
        (b.supplier.reliabilityScore * 0.7) +
        (b.supplier.priceTier === PriceTier.LOW ? 30 : 0) -
        (a.supplier.reliabilityScore * 0.7) -
        (a.supplier.priceTier === PriceTier.LOW ? 30 : 0)
      )
    })
  
  // Prefer primary suppliers
  const primarySupplier = rankedSuppliers.find(sp => sp.isPrimarySupplier)
  if (primarySupplier && primarySupplier.supplier.reliabilityScore >= 70) {
    return primarySupplier.supplierId
  }
  
  // Return highest-ranked supplier
  return rankedSuppliers[0].supplierId
}
```

### Order Consolidation by Supplier

```typescript
async consolidateOrdersBySupplier(requirements: OrderRequirement[]): Promise<Map<string, OrderRequirement[]>> {
  const supplierGroups = new Map<string, OrderRequirement[]>()
  
  // Group by primary supplier
  for (const req of requirements) {
    const supplierId = req.supplierId
    if (!supplierGroups.has(supplierId)) {
      supplierGroups.set(supplierId, [])
    }
    supplierGroups.get(supplierId).push(req)
  }
  
  // Apply consolidation rules per supplier
  for (const [supplierId, items] of supplierGroups.entries()) {
    const supplier = await getSupplier(supplierId)
    
    // Rule 1: Bump to minimum order quantity
    if (items.length < 5) {
      // Consider merging with alternate suppliers
      const alternateSupplier = await findAlternateSupplier(supplierId, items)
      if (alternateSupplier) {
        supplierGroups.delete(supplierId)
        supplierGroups.set(alternativeSupplier.id, [...supplierGroups.get(alternateSupplier.id) || [], ...items])
      }
    }
    
    // Rule 2: Apply volume discounts
    if (items.reduce((sum, item) => sum + item.suggestedQuantity, 0) >= 100) {
      items.forEach(item => {
        item.estimatedCost *= 0.95  // 5% discount
      })
    }
  }
  
  return supplierGroups
}
```

## Best Practices

### For Kitchen Managers

1. **Diversify Suppliers**: Never depend on a single supplier for critical items
2. **Monitor Performance**: Review supplier scores weekly for top 10 suppliers
3. **Build Relationships**: Regular communication improves reliability
4. **Negotiate Terms**: Use volume data to negotiate better prices
5. **Plan Ahead**: Allow adequate lead time for preferred suppliers

### For Procurement Teams

1. **Track Trends**: Monitor pricing and reliability trends over time
2. **Regular Reviews**: Conduct quarterly performance reviews
3. **Document Issues**: Track all problems and resolutions
4. **Backup Plans**: Maintain emergency suppliers for all categories
5. **Continuous Improvement**: Set improvement goals with suppliers

### For IT/System Administrators

1. **Data Quality**: Ensure accurate contact and performance data
2. **Regular Updates**: Refresh pricing and availability weekly
3. **Backup Data**: Maintain supplier contact information offline
4. **Integration Testing**: Test order methods before production use
5. **Security**: Protect supplier pricing and contract information

## Troubleshooting

### Common Issues

**Issue: Supplier not appearing in order suggestions**
- Solution: Check if supplier is marked as `active: true`
- Solution: Verify product is linked to supplier
- Solution: Confirm supplier has conservation zone matching product

**Issue: Inaccurate reliability scores**
- Solution: Re-calculate scores with updated metrics
- Solution: Review weight configuration
- Solution: Check for data anomalies in performance logs

**Issue: Wrong price tier assigned**
- Solution: Update market average pricing data
- Solution: Recalculate supplier markup
- Solution: Verify category classification

**Issue: Preferred status not updating**
- Solution: Check reliability score threshold
- Solution: Review preferred status assignment rules
- Solution: Manually override if needed with justification

---

**Version**: 1.0.0
**Last Updated**: 2026-05-31
**Status**: ✅ Implemented