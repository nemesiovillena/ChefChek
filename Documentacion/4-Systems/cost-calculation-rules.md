# Cost Calculation Rules - ChefChek

## Reglas de Cálculo de Costeos

ChefChek implementa un sistema de cálculo de costos automático basado en el sistema multi-unidad y el concepto de **precio neto** (costo del producto limpio/aprovechable).

## Conceptos Fundamentales

### 1. Precio Bruto vs Precio Neto

**Precio Bruto (Purchase Price):**
- El precio que se paga al proveedor
- Incluye desperdicio y mermas
- Base de negociación comercial

**Precio Neto (Net Price):**
- El costo real del producto aprovechable
- Precio bruto menos desperdicio
- Base para cálculo de costos en recetas

**Fórmula:**
```
Precio Neto = (Precio Bruto - (Precio Bruto × % Mermas)) × (1 + % Margen Beneficio)
```

### 2. Mermas y Rendimiento

**Mermas (Waste Percentage):**
- Porcentaje del producto que no se aprovecha
- Formato: 0% (sin merma) a 100% (todo desperdicio)

**Factor de Rendimiento (Yield Factor):**
- Proporción de producto aprovechable
- Cálculo automático: `1 - (WastePercentage / 100)`

**Fórmula:**
```
Yield Factor = (100 - Waste Percentage) / 100
```

**Ejemplo:**
```
Waste % = 15%
Yield Factor = (100 - 15) / 100 = 0.85
```

## Cálculo de Costos por Nivel

### 1. Costo por Unidad de Compra (Cost/UC)

```
Costo/UC = Precio Bruto de Compra
```

**Ejemplo:**
- Precio bruto: `€25.00` por Caja 10kg
- Costo/UC: `€25.00/Caja 10kg`

### 2. Costo por Unidad de Almacenamiento (Cost/UA)

```
Costo/UA = Costo/UC ÷ Factor UC→UA
```

**Ejemplo:**
- UC: `Caja 10kg` → UA: `Kilogramos`
- Factor UC→UA: `10`
- Costo/UA: `€25.00 ÷ 10 = €2.50/Kilogramo`

### 3. Costo por Unidad de Receta (Cost/UR)

```
Costo/UR = Costo/UA ÷ Factor UA→UR
```

**Ejemplo:**
- UA: `Kilogramos` → UR: `Gramos`
- Factor UA→UR: `1000`
- Costo/UR: `€2.50 ÷ 1000 = €0.0025/Gramo`

### 4. Cálculo Directo UC→UR

```
Costo/UR = Costo/UC ÷ (Factor UC→UA × Factor UA→UR)
```

**Ejemplo:**
- Costo/UC: `€25.00`
- Factor UC→UA: `10`
- Factor UA→UR: `1000`
- Costo/UR: `€25.00 ÷ (10 × 1000) = €0.0025/Gramo`

## Cálculo de Precio Neto

### Fórmula Completa

```typescript
private calculateNetPrice(
  purchasePrice: number,
  wastePercentage: number,
  profitMargin: number
): number {
  // 1. Restar merma al precio bruto
  const priceAfterWaste = purchasePrice - (purchasePrice * wastePercentage / 100);

  // 2. Aplicar margen de beneficio
  const netPrice = priceAfterWaste * (1 + profitMargin / 100);

  // 3. Redondear a 2 decimales
  return Math.round(netPrice * 100) / 100;
}
```

### Ejemplos Prácticos

**Ejemplo 1: Producto con Merma 10% y Margen 5%**
```
Precio Bruto: €10.00/kg
Waste %: 10%
Margen: 5%

Cálculo:
= €10.00 × (1 - 0.10) × (1 + 0.05)
= €10.00 × 0.90 × 1.05
= €9.45
```

**Ejemplo 2: Producto sin Merma y Margen 20%**
```
Precio Bruto: €25.00/Caja
Waste %: 0%
Margen: 20%

Cálculo:
= €25.00 × (1 - 0.00) × (1 + 0.20)
= €25.00 × 1.00 × 1.20
= €30.00
```

**Ejemplo 3: Producto Alta Merma 25% sin Margen**
```
Precio Bruto: €15.00/L
Waste %: 25%
Margen: 0%

Cálculo:
= €15.00 × (1 - 0.25) × (1 + 0.00)
= €15.00 × 0.75 × 1.00
= €11.25
```

## Cálculo en Recetas

### Costeo de Ingrediente en Receta

**Fórmula:**
```
Costo Ingrediente = Cantidad en UR × Costo/UR
```

**Ejemplo:**
- Producto: `Tomates`
- Cantidad en receta: `500 Gramos`
- Costo/UR: `€0.0025/Gramo`

Cálculo:
```
500g × €0.0025/g = €1.25
```

### Costo Total de Receta

**Fórmula:**
```
Costo Total = Σ (Costo de cada ingrediente)
```

**Ejemplo:**
```
- Tomates: 500g × €0.0025/g = €1.25
- Cebolla: 300g × €0.0015/g = €0.45
- Ajo: 50g × €0.0250/g = €1.25

Total = €1.25 + €0.45 + €1.25 = €2.95
```

## Costeo con Multi-unidad Completa

### Cálculo Completo de Costo por Ingrediente

```typescript
interface IngredientCostCalculation {
  // Datos del producto
  productId: string;
  productName: string;

  // Unidades
  purchaseUnit: string;    // UC: "Caja 10kg"
  storageUnit: string;     // UA: "Kilogramos"
  recipeUnit: string;      // UR: "Gramos"

  // Factores de conversión
  ucToUaFactor: number;     // 10 (1 Caja = 10kg)
  uaToUrFactor: number;     // 1000 (1kg = 1000g)
  ucToUrFactor: number;     // 10000 (1 Caja = 10000g)

  // Costos por unidad
  costPerPurchaseUnit: number; // €25.00/Caja
  costPerStorageUnit: number;  // €2.50/Kilogramo
  costPerRecipeUnit: number;   // €0.0025/Gramo

  // Datos de precio y rendimiento
  purchasePrice: number;    // €25.00
  netPrice: number;          // €22.75
  wastePercentage: number;  // 9%
  yieldFactor: number;       // 0.91
}
```

### Ejemplo Completo: Salsa de Tomate

**Receta:**
- Tomates: 2kg
- Cebolla: 500g
- Ajo: 100g
- Aceite: 100ml

**Cálculo de Costos:**

**1. Tomates:**
- UC: `Caja 10kg` @ €25.00
- UA: `Kilogramos` (factor 10)
- UR: `Gramos` (factor 1000)
- Waste %: 10%, Margen: 5%

```
Net Price = €25.00 × (1 - 0.10) × (1 + 0.05) = €23.625
Costo/UR = €23.625 ÷ (10 × 1000) = €0.0023625/g
2kg = 2000g × €0.0023625/g = €4.73
```

**2. Cebolla:**
- UC: `Saco 25kg` @ €15.00
- UA: `Kilogramos` (factor 25)
- UR: `Gramos` (factor 1000)
- Waste %: 15%, Margen: 0%

```
Net Price = €15.00 × (1 - 0.15) × (1 + 0.00) = €12.75
Costo/UR = €12.75 ÷ (25 × 1000) = €0.00051/g
500g = 500g × €0.00051/g = €0.26
```

**3. Ajo:**
- UC: `Kilogramo` @ €8.00
- UA: `Gramos` (factor 1000)
- UR: `Gramos` (factor 1)
- Waste %: 5%, Margen: 10%

```
Net Price = €8.00 × (1 - 0.05) × (1 + 0.10) = €8.36
Costo/UR = €8.36 ÷ 1000 = €0.00836/g
100g = 100g × €0.00836/g = €0.84
```

**4. Aceite:**
- UC: `Litro` @ €5.00
- UA: `Mililitros` (factor 1000)
- UR: `Mililitros` (factor 1)
- Waste %: 0%, Margen: 0%

```
Net Price = €5.00 × (1 - 0.00) × (1 + 0.00) = €5.00
Costo/UR = €5.00 ÷ 1000 = €0.005/ml
100ml = 100ml × €0.005/ml = €0.50
```

**Costo Total:**
```
Total = €4.73 + €0.26 + €0.84 + €0.50 = €6.33
```

## Margen de Beneficio y Pricing Estratégico

### Margen de Beneficio (Profit Margin)

**Propósito:** Ajustar el precio neto para reflejar beneficios comerciales y gastos operativos.

**Valores Comunes:**
- `0%` - Costo base (sin margen)
- `5-10%` - Margen estándar
- `15-25%` - Productos premium
- `30%+` - Productos de lujo

**Ejemplo de Pricing Estratégico:**
```
Costo Base (0%): €10.00
Precio Competitivo (5%): €10.50
Precio Estándar (10%): €11.00
Precio Premium (20%): €12.00
Precio Lujo (30%): €13.00
```

### Impacto en Costeo de Recetas

**Receta Base (Margen 5%):**
```
Ingredientes: €6.33
Total Receta: €6.33
Costo/Porción: €0.63 (10 porciones)
```

**Receta Premium (Margen 20%):**
```
Ingredientes (mismo producto): €8.50
Total Receta: €8.50
Costo/Porción: €0.85 (10 porciones)
```

## Automatización de Cálculos

### Actualización Automática

**Cuando se modifica:**
- Precio de compra → Recálculo automático de todos los costos
- Mermas → Ajuste automático de yield factors
- Margen de beneficio → Actualización de precios netos
- Conversión de unidades → Recálculo de costos por UR

### Cascade Update en Recetas

```typescript
// Cuando cambia un producto, actualizar todas las recetas afectadas
async updateProductCost(productId: string, newCostPerUR: number) {
  // 1. Encontrar recetas que usan este producto
  const affectedRecipes = await this.prisma.recipeIngredient.findMany({
    where: { productId },
  });

  // 2. Recalcular costos de recetas
  for (const ingredient of affectedRecipes) {
    await this.recalculateRecipeCost(ingredient.recipeId);
  }
}
```

## Validación de Costos

### Reglas de Negocio

**1. Precio Bruto:**
- Debe ser mayor que cero
- Formato numérico con 2 decimales máximos

**2. Mermas:**
- Rango: 0% a 100%
- Valor por defecto: 0% (sin mermas)

**3. Margen de Beneficio:**
- Rango: 0% a 100%
- Valor por defecto: 0% (costo base)

**4. Factor de Rendimiento:**
- Rango: 0.0 a 1.0
- Auto-calculado: `1 - (wastePercentage / 100)`

## Performance en Cálculos

### Optimización de Queries

```typescript
// Pre-calcular costos por producto
async createProduct(createProductDto: CreateProductDto) {
  // Calcular todos los costos al crear
  const calculatedCosts = this.calculateAllCosts(createProductDto);

  // Guardar en DB para acceso rápido
  return this.prisma.product.create({
    data: {
      ...createProductDto,
      // Precios pre-calculados
      costPerPurchaseUnit: calculatedCosts.costPerPurchaseUnit,
      costPerStorageUnit: calculatedCosts.costPerStorageUnit,
      costPerRecipeUnit: calculatedCosts.costPerRecipeUnit,
    },
  });
}
```

### Cache de Costos

```typescript
// Cachear cálculos de recetas frecuentes
const recipeCostCache = new Map();

async getRecipeCost(recipeId: string) {
  if (recipeCostCache.has(recipeId)) {
    return recipeCostCache.get(recipeId);
  }

  const cost = await this.calculateRecipeCost(recipeId);
  recipeCostCache.set(recipeId, cost);
  return cost;
}
```

## Troubleshooting Costeos

### Problemas Comunes

**1. Costos Negativos:**
- Revisar cálculos matemáticos
- Validar que wastePercentage < 100%
- Verificar que precio bruto > 0

**2. Costos Inconsistentes:**
- Verificar factores de conversión
- Validar cálculos de yield factor
- Revisar redondeo matemático

**3. Discrepancia en Recetas:**
- Asegurar que todos los ingredientes usen same UR
- Validar conversión completa UC→UR
- Revisar cache de costos

## Documentación Relacionada

- [Multi-Unit System](./multi-unit-system.md) - Sistema multi-unidad completo
- [Product Data Model](./product-data-model.md) - Modelo de datos de productos
- [API Conventions](./api-conventions.md) - Convenciones de API RESTful
- [System Architecture](./system-architecture.md) - Arquitectura del sistema