# Cost Engine Algorithm - ChefChek

## Motor de Cálculo de Costeos

ChefChek implementa un motor de cálculo de costeos automatizado que procesa recetas recursivas, ingredientes base y sub-recetas con precisión milimétrica.

## Arquitectura del Motor

### Componentes Principales

```
CostEngine
├── ProductCostCalculator    // Cálculo de costos de productos
├── RecipeCostCalculator     // Cálculo de costos de recetas
├── RecursiveCostEngine      // Motor recursivo para sub-recetas
└── CostCacheManager         // Gestión de caché de costeos
```

## Algoritmo Principal

### 1. Cálculo de Costo de Receta

```typescript
async calculateRecipeCost(
  recipeId: string,
  tenantId: string,
  depth: number = 0
): Promise<RecipeCostBreakdown> {
  // Validación de profundidad
  if (depth > 10) {
    throw new Error('Maximum recursion depth exceeded');
  }

  // Obtener datos de receta
  const recipe = await this.getRecipe(recipeId, tenantId);

  // Inicializar acumuladores
  let ingredientsCost = 0;
  let subRecipesCost = 0;

  // 1. Calcular costos de ingredientes base
  for (const ingredient of recipe.ingredients) {
    const productCost = await this.calculateIngredientCost(ingredient);
    ingredientsCost += productCost;
  }

  // 2. Calcular costos de sub-recetas (recursivo)
  for (const subRecipe of recipe.subRecipes) {
    const subRecipeCost = await this.calculateSubRecipeCost(
      subRecipe,
      depth + 1
    );
    subRecipesCost += subRecipeCost;
  }

  // 3. Calcular totales
  const totalCost = ingredientsCost + subRecipesCost;
  const costPerPortion = totalCost / recipe.portions;
  const costPerUnit = this.calculateCostPerUnit(totalCost, recipe);

  return {
    ingredientsCost,
    subRecipesCost,
    totalCost,
    costPerPortion,
    costPerUnit,
  };
}
```

### 2. Cálculo de Costo de Ingrediente

```typescript
async calculateIngredientCost(ingredient: RecipeIngredient): Promise<number> {
  // Obtener producto
  const product = await this.getProduct(ingredient.productId);

  // Calcular costo por UR (Unidad de Receta)
  const costPerUR = await this.calculateProductCostPerUnit(product);

  // Validar unidades
  if (ingredient.unit !== product.recipeUnit) {
    throw new Error(
      `Unit mismatch: Ingredient uses ${ingredient.unit}, ` +
      `but product recipe unit is ${product.recipeUnit}`
    );
  }

  // Calcular costo del ingrediente
  return ingredient.quantity * costPerUR;
}
```

### 3. Cálculo de Costo por UR de Producto

```typescript
async calculateProductCostPerUnit(product: Product): Promise<number> {
  // Obtener precio base
  const basePrice = product.netPrice; // Precio neto (ajustado por mermas)

  // Obtener factores de conversión
  const ucToUaFactor = this.getUcToUaFactor(
    product.purchaseUnit,
    product.storageUnit
  );

  const uaToUrFactor = this.getUaToUrFactor(
    product.storageUnit,
    product.recipeUnit
  );

  // Calcular costo por UR
  // Costo/UR = Precio Neto / (Factor UC→UA × Factor UA→UR)
  const costPerUR = basePrice / (ucToUaFactor * uaToUrFactor);

  return this.roundToPrecision(costPerUR, 4); // 4 decimales de precisión
}
```

### 4. Cálculo de Costo de Sub-Receta (Recursivo)

```typescript
async calculateSubRecipeCost(
  subRecipe: RecipeSubRecipe,
  depth: number
): Promise<number> {
  // Obtener datos de sub-receta
  const subRecipeData = await this.getRecipe(subRecipe.subRecipeId);

  // Calcular costo total de sub-receta
  const subRecipeCost = await this.calculateRecipeCost(
    subRecipe.subRecipeId,
    subRecipeData.tenantId,
    depth
  );

  // Calcular costo proporcional
  // Costo Proporcional = (Cantidad Usada / Cantidad Total) × Costo Total

  const totalQuantity = subRecipeData.portions * subRecipeData.portionSize;
  const usedQuantity = subRecipe.quantity;

  const proportionalCost = (usedQuantity / totalQuantity) * subRecipeCost.totalCost;

  return this.roundToPrecision(proportionalCost, 2); // 2 decimales
}
```

## Sistema de Cache de Costeos

### 1. Estructura de Cache

```typescript
class CostCache {
  private cache: Map<string, CachedCost>;

  constructor() {
    this.cache = new Map();
    this.maxSize = 1000; // Máximo 1000 entradas
  }

  set(key: string, cost: RecipeCostBreakdown, ttl: number = 3600) {
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data: cost,
      timestamp: Date.now(),
      ttl,
    });
  }

  get(key: string): RecipeCostBreakdown | null {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Verificar TTL
    if (Date.now() - cached.timestamp > cached.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  invalidate(productId: string) {
    // Invalidar todas las recetas que usan este producto
    const keysToDelete: string[] = [];

    for (const [key, value] of this.cache.entries()) {
      if (this.recipeUsesProduct(key, productId)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  private evictOldest() {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, value] of this.cache.entries()) {
      if (value.timestamp < oldestTimestamp) {
        oldestTimestamp = value.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

interface CachedCost {
  data: RecipeCostBreakdown;
  timestamp: number;
  ttl: number;
}
```

### 2. Uso en Cálculos

```typescript
async calculateRecipeCost(
  recipeId: string,
  tenantId: string,
  depth: number = 0
): Promise<RecipeCostBreakdown> {
  // Generar key de cache
  const cacheKey = `recipe:${recipeId}:${tenantId}`;

  // Verificar cache
  const cached = this.costCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Calcular costos
  const costBreakdown = await this.performCostCalculation(recipeId, tenantId, depth);

  // Guardar en cache
  this.costCache.set(cacheKey, costBreakdown, 3600); // 1 hora TTL

  return costBreakdown;
}
```

## Fórmulas de Cálculo

### 1. Costo por Unidad de Receta (UR)

```
Costo/UR = Precio Neto / (Factor UC→UA × Factor UA→UR)

Ejemplo:
- Producto: Tomates
- Precio Neto: €22.75 (Caja 10kg con 10% merma)
- UC→UA: 10 (1 Caja = 10kg)
- UA→UR: 1000 (1kg = 1000g)

Costo/UR = €22.75 / (10 × 1000) = €0.002275/g
```

### 2. Costo de Ingrediente en Receta

```
Costo Ingrediente = Cantidad × Costo/UR

Ejemplo:
- Cantidad: 2kg (2000g)
- Costo/UR: €0.002275/g

Costo = 2000g × €0.002275/g = €4.55
```

### 3. Costo Proporcional de Sub-Receta

```
Costo Proporcional = (Cantidad Usada / Cantidad Total) × Costo Total Sub-Receta

Ejemplo:
- Sub-Receta: Sofrito (Costo total €2.50, produce 500g)
- Uso en Receta: 200g de Sofrito

Costo Proporcional = (200g / 500g) × €2.50 = €1.00
```

### 4. Costo por Porción

```
Costo/Porción = Costo Total / Porciones

Ejemplo:
- Costo Total: €6.45
- Porciones: 10

Costo/Porción = €6.45 / 10 = €0.645
```

### 5. Costo por Unidad de Medida

```
Costo/Unidad = Costo Total × 100 / (Porciones × Tamaño Porción)

Ejemplo:
- Costo Total: €6.45
- Porciones: 10
- Tamaño Porción: 150g

Costo/100g = €6.45 × 100 / (10 × 150g) = €0.43/100g
```

## Ejemplo Completo de Cálculo

### Receta: Paella Valenciana

```
Porciones: 10
Tamaño Porción: 300g

Ingredientes Base:
├── Arroz: 500g × €0.005/g = €2.50
├── Pollo: 400g × €0.015/g = €6.00
└── Caldo: 1L × €0.002/ml = €2.00
Total Ingredientes: €10.50

Sub-Recetas:
└── Sofrito: 200g
    ├── Costo Total Sub-Receta: €2.50 (produce 500g)
    └── Costo Proporcional: (200g/500g) × €2.50 = €1.00
Total Sub-Recetas: €1.00

Costo Total: €11.50
Costo/Porción: €11.50 / 10 = €1.15
Costo/100g: €11.50 × 100 / (10 × 300g) = €0.38/100g
```

### Desglose Detallado del Sofrito (Sub-Receta)

```
Porciones: 5
Tamaño Porción: 100g

Ingredientes Base:
├── Ajo: 50g × €0.025/g = €1.25
├── Cebolla: 100g × €0.0015/g = €0.15
└── Aceite: 50ml × €0.005/ml = €0.25
Total Ingredientes: €1.65

Sub-Recetas:
└── Pasta de Tomate: 100g
    ├── Costo Total: €0.85 (produce 200g)
    └── Costo Proporcional: (100g/200g) × €0.85 = €0.425
Total Sub-Recetas: €0.425

Costo Total Sofrito: €2.075 ≈ €2.50 (con margen de rendimiento)
Costo/Porción: €2.50 / 5 = €0.50
Costo/100g: €2.50 × 100 / (5 × 100g) = €0.50/100g
```

## Recálculo en Cascada

### 1. Detección de Impacto

```typescript
async onProductUpdated(productId: string): Promise<void> {
  // Encontrar todas las recetas que usan este producto
  const affectedRecipes = await this.findRecipesUsingProduct(productId);

  // Recalcular costos de cada receta afectada
  for (const recipe of affectedRecipes) {
    await this.recalculateRecipeCost(recipe.id, recipe.tenantId);
  }
}
```

### 2. Algoritmo de Recálculo

```typescript
async recalculateRecipeCost(recipeId: string, tenantId: string): Promise<void> {
  // Invalidar cache
  const cacheKey = `recipe:${recipeId}:${tenantId}`;
  this.costCache.invalidateCacheKey(cacheKey);

  // Recalcular costos
  const newCosts = await this.calculateRecipeCost(recipeId, tenantId);

  // Actualizar en base de datos
  await this.prisma.recipe.update({
    where: { id: recipeId },
    data: {
      totalCost: newCosts.totalCost,
      totalCostPerUnit: newCosts.costPerUnit,
    },
  });

  // Recalcular recetas padre que usan esta receta
  await this.recalculateParentRecipes(recipeId);
}
```

## Validaciones y Seguridad

### 1. Validación de Precios

```typescript
validateCost(cost: number): void {
  if (isNaN(cost)) {
    throw new Error('Cost must be a valid number');
  }

  if (cost < 0) {
    throw new Error('Cost cannot be negative');
  }

  if (cost > 100000) {
    throw new Error('Cost exceeds maximum allowed value');
  }
}
```

### 2. Validación de Unidades

```typescript
validateUnits(ingredient: RecipeIngredient, product: Product): void {
  if (ingredient.unit !== product.recipeUnit) {
    throw new Error(
      `Unit mismatch: Ingredient uses ${ingredient.unit}, ` +
      `but product recipe unit is ${product.recipeUnit}`
    );
  }
}
```

### 3. Validación de Profundidad Recursiva

```typescript
validateDepth(currentDepth: number, maxDepth: number = 10): void {
  if (currentDepth > maxDepth) {
    throw new Error(
      `Maximum recursion depth of ${maxDepth} levels exceeded`
    );
  }
}
```

## Performance y Optimización

### 1. Queries Optimizadas

```typescript
// Cargar ingredientes con productos en una query
const recipe = await this.prisma.recipe.findUnique({
  where: { id: recipeId },
  include: {
    ingredients: {
      include: {
        product: true,
      },
    },
    subRecipes: {
      include: {
        subRecipe: true,
      },
    },
  },
});
```

### 2. Cálculos en Lote

```typescript
// Calcular múltiples costos en paralelo
const costs = await Promise.all(
  recipeIds.map(id => this.calculateRecipeCost(id, tenantId))
);
```

### 3. Pre-cálculo en Background

```typescript
// Pre-calcular costos de recetas populares
async preCalculatePopularRecipes(): Promise<void> {
  const popularRecipes = await this.getPopularRecipes();

  for (const recipe of popularRecipes) {
    await this.calculateRecipeCost(recipe.id, recipe.tenantId);
  }
}
```

## Testing del Motor

### 1. Tests Unitarios

```typescript
describe('CostEngine', () => {
  it('should calculate ingredient cost correctly', async () => {
    const ingredient = {
      productId: 'prod-123',
      quantity: 2.0,
      unit: 'Kilogramos',
    };

    const cost = await costEngine.calculateIngredientCost(ingredient);

    expect(cost).toBeCloseTo(4.55, 2);
  });

  it('should detect unit mismatch', async () => {
    const ingredient = {
      productId: 'prod-123',
      quantity: 2.0,
      unit: 'Litros', // Unidad incorrecta
    };

    await expect(
      costEngine.calculateIngredientCost(ingredient)
    ).rejects.toThrow('Unit mismatch');
  });
});
```

### 2. Tests de Integración

```typescript
describe('Recipe Cost Calculation', () => {
  it('should calculate complex recipe cost', async () => {
    const recipe = await createComplexRecipe();

    const cost = await costEngine.calculateRecipeCost(
      recipe.id,
      recipe.tenantId
    );

    expect(cost.totalCost).toBeGreaterThan(0);
    expect(cost.ingredientsCost).toBeGreaterThan(0);
    expect(cost.subRecipesCost).toBeGreaterThanOrEqual(0);
  });
});
```

## Documentación Relacionada

- [Recipe Data Model](./recipe-data-model.md) - Modelo de datos de recetas
- [Recursive Recipe System](./recursive-recipe-system.md) - Sistema de recetas recursivas
- [TipTap Integration](./tiptap-integration.md) - Integración de editor TipTap
- [Cost Calculation Rules](./cost-calculation-rules.md) - Reglas de cálculo de costeos
- [Product Data Model](./product-data-model.md) - Modelo de datos de productos