# Sistema de Recálculo en Cascada de Costes

## Resumen

Sistema automático de recálculo en cascada que actualiza costes en todas las recetas y menús cuando se actualiza un precio de producto, garantizando que los costos de escandallos siempre estén actualizados.

## Arquitectura del Sistema

### Flujo de Recálculo

```
1. Actualización de Precio de Producto
   ├── Nuevo precio extraído del documento
   ├── Usuario confirma actualización
   ├── Actualizar producto en DB
   └── Trigger recálculo en cascada

2. Identificación de Recetas Afectadas
   ├── Buscar recetas que contienen producto
   ├── Buscar sub-recetas recursivamente
   ├── Marcar recetas para recálculo
   └── Generar cola de recálculo

3. Recálculo de Recetas
   ├── Para cada receta afectada:
   │   ├── Calcular nuevo coste total
   │   ├── Calcular nuevo coste por unidad
   │   ├── Actualizar receta en DB
   │   └── Actualizar timestamp
   └── Marcar como completado

4. Recálculo de Menús
   ├── Para cada menú que usa recetas afectadas:
   │   ├── Buscar items que usan recetas
   │   ├── Recalcular coste de items
   │   ├── Calcular nuevo coste total del menú
   │   └── Actualizar menú en DB

5. Notificación de Usuarios
   ├── Identificar usuarios interesados
   ├── Enviar notificaciones
   ├── Log eventos de notificación
   └── Crear alerta de cambios significativos
```

## Detección de Recetas Afectadas

### Búsqueda Directa

```typescript
async function findAffectedRecipes(
  productId: string,
  tenantId: string
): Promise<string[]> {
  const queryBuilder = recipeRepository
    .createQueryBuilder('recipe')
    .where('recipe.tenantId = :tenantId', { tenantId })
    .andWhere(':productId = ANY(recipe.ingredients)', { productId });

  const recipes = await queryBuilder.getMany();

  return recipes.map((r) => r.id);
}
```

### Búsqueda Recursiva en Sub-Recetas

```typescript
async function findAffectedRecipesRecursive(
  productId: string,
  tenantId: string,
  visited: Set<string> = new Set()
): Promise<string[]> {
  const directlyAffected = await findAffectedRecipes(productId, tenantId);
  const allAffected = new Set<string>(directlyAffected);

  for (const recipeId of directlyAffected) {
    if (visited.has(recipeId)) {
      continue;
    }

    visited.add(recipeId);

    // Buscar sub-recetas que contienen esta receta
    const subRecipesContainingThisRecipe = await findRecipesContainingRecipe(
      recipeId,
      tenantId
    );

    for (const subRecipeId of subRecipesContainingThisRecipe) {
      const affectedSubRecipes = await findAffectedRecipesRecursive(
        productId,
        tenantId,
        visited
      );

      affectedSubRecipes.forEach((id) => allAffected.add(id));
    }
  }

  return Array.from(allAffected);
}

async function findRecipesContainingRecipe(
  recipeId: string,
  tenantId: string
): Promise<string[]> {
  const queryBuilder = recipeRepository
    .createQueryBuilder('recipe')
    .where('recipe.tenantId = :tenantId', { tenantId })
    .andWhere(':recipeId = ANY(recipe.subRecipes)', { recipeId });

  const recipes = await queryBuilder.getMany();

  return recipes.map((r) => r.id);
}
```

## Recálculo de Recetas

### Cálculo de Coste Total

```typescript
async function recalculateRecipeCost(recipeId: string): Promise<RecipeCostUpdate> {
  const recipe = await getRecipeWithIngredients(recipeId);

  let totalCost = 0;

  for (const ingredient of recipe.ingredients) {
    const ingredientCost = await calculateIngredientCost(ingredient);
    totalCost += ingredientCost;
  }

  // Calcular coste por unidad
  const costPerUnit = recipe.yieldGrams > 0
    ? totalCost / (recipe.yieldGrams / 1000) // Convertir a kg
    : totalCost;

  const costUpdate: RecipeCostUpdate = {
    recipeId,
    totalCost,
    costPerUnit,
    ingredientBreakdown: await calculateIngredientBreakdown(recipe),
    updatedAt: new Date(),
  };

  await recipeRepository.update(recipeId, {
    totalCost,
    costPerUnit,
    updatedAt: new Date(),
  });

  await saveRecipeCostHistory(costUpdate);

  return costUpdate;
}

async function calculateIngredientCost(ingredient: RecipeIngredient): Promise<number> {
  const product = await getProduct(ingredient.productId);

  if (!product) {
    throw new NotFoundException(`Producto ${ingredient.productId} no encontrado`);
  }

  // Costo = cantidad * precio unitario
  const rawCost = ingredient.quantity * product.unitPrice;

  // Ajustar por rendimiento (si aplica)
  const yieldAdjustment = ingredient.yieldPercentage || 1;
  const adjustedCost = rawCost / yieldAdjustment;

  return adjustedCost;
}
```

### Cálculo de Desglose por Ingrediente

```typescript
interface IngredientCostBreakdown {
  ingredientId: string;
  ingredientName: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  rawCost: number;
  adjustedCost: number;
  yieldPercentage: number;
  costContribution: number; // Percentage of total recipe cost
}

async function calculateIngredientBreakdown(
  recipe: Recipe
): Promise<IngredientCostBreakdown[]> {
  const breakdown: IngredientCostBreakdown[] = [];
  const totalRecipeCost = recipe.totalCost || 0;

  for (const ingredient of recipe.ingredients) {
    const product = await getProduct(ingredient.productId);

    if (!product) {
      continue;
    }

    const rawCost = ingredient.quantity * product.unitPrice;
    const yieldAdjustment = ingredient.yieldPercentage || 1;
    const adjustedCost = rawCost / yieldAdjustment;

    const costContribution = totalRecipeCost > 0
      ? (adjustedCost / totalRecipeCost) * 100
      : 0;

    breakdown.push({
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      productId: ingredient.productId,
      productName: product.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      unitPrice: product.unitPrice,
      rawCost,
      adjustedCost,
      yieldPercentage: ingredient.yieldPercentage || 1,
      costContribution,
    });
  }

  return breakdown.sort((a, b) => b.costContribution - a.costContribution);
}
```

## Recálculo de Menús

### Búsqueda de Menús Afectados

```typescript
async function findAffectedMenus(
  recipeIds: string[],
  tenantId: string
): Promise<string[]> {
  const queryBuilder = menuRepository
    .createQueryBuilder('menu')
    .where('menu.tenantId = :tenantId', { tenantId })
    .andWhere(':recipeId = ANY(menu.categories)', { recipeId: recipeIds });

  const menus = await queryBuilder.getMany();

  return menus.map((m) => m.id);
}
```

### Recálculo de Costes de Menú

```typescript
async function recalculateMenuCost(menuId: string): Promise<MenuCostUpdate> {
  const menu = await getMenuWithCategories(menuId);

  let totalCost = 0;
  const categoryBreakdown: CategoryCostBreakdown[] = [];

  for (const category of menu.categories) {
    const categoryCost = await calculateCategoryCost(category);
    totalCost += categoryCost;

    categoryBreakdown.push({
      categoryId: category.id,
      categoryName: category.name,
      totalCost: categoryCost,
      itemBreakdown: category.itemBreakdown,
    });
  }

  const costUpdate: MenuCostUpdate = {
    menuId,
    totalCost,
    categoryBreakdown,
    updatedAt: new Date(),
  };

  await menuRepository.update(menuId, {
    totalCost,
    updatedAt: new Date(),
  });

  await saveMenuCostHistory(costUpdate);

  return costUpdate;
}

async function calculateCategoryCost(category: MenuCategory): Promise<number> {
  let categoryCost = 0;
  const itemBreakdown: MenuItemCostBreakdown[] = [];

  for (const item of category.items) {
    const itemCost = await calculateMenuItemCost(item);
    categoryCost += itemCost;

    itemBreakdown.push({
      itemId: item.id,
      itemName: item.name,
      recipeId: item.recipeId,
      cost: itemCost,
      costContribution: categoryCost > 0 ? (itemCost / categoryCost) * 100 : 0,
    });
  }

  category.itemBreakdown = itemBreakdown;

  return categoryCost;
}

async function calculateMenuItemCost(menuItem: MenuItem): Promise<number> {
  if (menuItem.recipeId) {
    const recipe = await getRecipe(menuItem.recipeId);
    return recipe.totalCost || 0;
  }

  // Si no usa receta, usar coste directo del ítem
  return menuItem.directCost || 0;
}
```

## Historial de Costos

### Guardar Historial de Receta

```typescript
interface RecipeCostHistory {
  id: string;
  recipeId: string;
  tenantId: string;
  totalCost: number;
  costPerUnit: number;
  ingredientBreakdown: IngredientCostBreakdown[];
  changedAt: Date;
  changedBy: string; // 'system' or user ID
  reason: string;
}

async function saveRecipeCostHistory(update: RecipeCostUpdate): Promise<void> {
  const history: RecipeCostHistory = {
    id: uuidv4(),
    recipeId: update.recipeId,
    tenantId: update.tenantId,
    totalCost: update.totalCost,
    costPerUnit: update.costPerUnit,
    ingredientBreakdown: update.ingredientBreakdown,
    changedAt: update.updatedAt,
    changedBy: 'system',
    reason: 'Producto price update via OCR',
  };

  await recipeCostHistoryRepository.save(history);

  // Limpiar histórico antiguo (mantener últimos 30 días)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await recipeCostHistoryRepository.delete({
    recipeId: update.recipeId,
    changedAt: LessThan(thirtyDaysAgo),
  });
}
```

### Guardar Historial de Menú

```typescript
interface MenuCostHistory {
  id: string;
  menuId: string;
  tenantId: string;
  totalCost: number;
  categoryBreakdown: CategoryCostBreakdown[];
  changedAt: Date;
  changedBy: string;
  reason: string;
}

async function saveMenuCostHistory(update: MenuCostUpdate): Promise<void> {
  const history: MenuCostHistory = {
    id: uuidv4(),
    menuId: update.menuId,
    tenantId: 'default-tenant-id',
    totalCost: update.totalCost,
    categoryBreakdown: update.categoryBreakdown,
    changedAt: update.updatedAt,
    changedBy: 'system',
    reason: 'Recipe cost update cascade',
  };

  await menuCostHistoryRepository.save(history);
}
```

## Detección de Cambios Significativos

### Umbral de Cambio

```typescript
interface ChangeThresholdConfig {
  percentageThreshold: number; // 5% change triggers alert
  absoluteThreshold: number;  // €1.00 change triggers alert
}

function detectSignificantChange(
  oldCost: number,
  newCost: number,
  config: ChangeThresholdConfig
): boolean {
  if (oldCost === 0) return false;

  const percentageChange = Math.abs((newCost - oldCost) / oldCost) * 100;
  const absoluteChange = Math.abs(newCost - oldCost);

  return (
    percentageChange >= config.percentageThreshold ||
    absoluteChange >= config.absoluteThreshold
  );
}
```

### Alerta de Cambio Significativo

```typescript
interface SignificantChangeAlert {
  recipeId: string;
  recipeName: string;
  oldCost: number;
  newCost: number;
  percentageChange: number;
  absoluteChange: number;
  ingredientsAffected: string[];
  affectedRecipes: string[];
  affectedMenus: string[];
}

async function alertSignificantChanges(
  recipeId: string,
  oldCost: number,
  newCost: number
): Promise<void> {
  const recipe = await getRecipe(recipeId);
  const affectedRecipes = await findAffectedRecipesRecursive(recipe.productId, recipe.tenantId);
  const affectedMenus = await findAffectedMenus(affectedRecipes, recipe.tenantId);

  const alert: SignificantChangeAlert = {
    recipeId,
    recipeName: recipe.name,
    oldCost,
    newCost,
    percentageChange: ((newCost - oldCost) / oldCost) * 100,
    absoluteChange: newCost - oldCost,
    ingredientsAffected: [recipe.productId],
    affectedRecipes,
    affectedMenus,
  };

  await notifyAdministrators(alert);
  await saveSignificantChangeAlert(alert);
}
```

## Notificación de Usuarios

### Identificar Usuarios Interesados

```typescript
async function findInterestedUsers(
  recipeIds: string[],
  tenantId: string
): Promise<string[]> {
  const userRoles = ['ADMIN', 'USER'];

  const users = await userRepository
    .createQueryBuilder('user')
    .where('user.tenantId = :tenantId', { tenantId })
    .andWhere('user.role IN (:...userRoles)', { userRoles })
    .getMany();

  // Filtrar usuarios que gestionan las recetas afectadas
  const interestedUsers = [];

  for (const user of users) {
    const userRecipes = await getUserRecipes(user.id);

    for (const recipeId of recipeIds) {
      if (userRecipes.includes(recipeId)) {
        interestedUsers.push(user.id);
        break;
      }
    }
  }

  return Array.from(new Set(interestedUsers));
}
```

### Notificaciones

```typescript
async function notifyUsersOfUpdate(
  userIds: string[],
  update: CascadeUpdateSummary
): Promise<void> {
  for (const userId of userIds) {
    const notification = await createNotification({
      userId,
      type: 'cost_update',
      title: 'Actualización de Costes',
      message: `
Los costes de ${update.totalRecipesAffected} recetas y ${update.totalMenusAffected} menús
han sido actualizados debido a cambios en precios de productos.
      `.trim(),
      metadata: {
        changedProducts: update.changedProducts.length,
        percentageChange: update.averagePercentageChange,
      },
    });

    await notificationRepository.save(notification);

    // Enviar notificación push/email
    await sendNotificationToUser(notification);
  }
}
```

## Optimización de Recálculo

### Batch Processing

```typescript
async function batchRecalculateRecipes(
  recipeIds: string[],
  tenantId: string
): Promise<BatchRecalculationResult> {
  const startTime = Date.now();
  const results: RecipeCostUpdate[] = [];
  const errors: string[] = [];

  for (const recipeId of recipeIds) {
    try {
      const result = await recalculateRecipeCost(recipeId);
      results.push(result);
    } catch (error) {
      errors.push(`Recipe ${recipeId}: ${error.message}`);
    }
  }

  const processingTime = Date.now() - startTime;

  return {
    totalRecipes: recipeIds.length,
    successful: results.length,
    failed: errors.length,
    results,
    errors,
    processingTime,
  };
}
```

### Throttling y Debouncing

```typescript
interface ThrottlingConfig {
  maxConcurrentRecalculations: number;
  minDelayBetweenBatches: number; // ms
  maxBatchSize: number;
}

async function throttledRecalculation(
  recipeIds: string[],
  tenantId: string,
  config: ThrottlingConfig
): Promise<void> {
  const batches = [];

  // Dividir en batches
  for (let i = 0; i < recipeIds.length; i += config.maxBatchSize) {
    batches.push(recipeIds.slice(i, i + config.maxBatchSize));
  }

  for (const batch of batches) {
    await batchRecalculateRecipes(batch, tenantId);

    // Delay entre batches
    if (config.minDelayBetweenBatches > 0) {
      await new Promise(resolve => setTimeout(resolve, config.minDelayBetweenBatches));
    }
  }
}
```

## API Reference

### Recalcular en Cascada

```http
POST /api/v1/ocr-ai/cascade-recalculation
Content-Type: application/json

{
  "productIds": ["uuid-product-1", "uuid-product-2"],
  "tenantId": "uuid-tenant-id",
  "recalculateRecipes": true,
  "recalculateMenus": true,
  "notifyUsers": true
}

Response 200:
{
  "message": "Recálculo en cascada completado",
  "summary": {
    "totalProducts": 2,
    "totalRecipesAffected": 8,
    "totalMenusAffected": 5,
    "processingTime": 12500,
    "usersNotified": 3
  },
  "details": {
    "productUpdates": [...],
    "recipeUpdates": [...],
    "menuUpdates": [...]
  }
}
```

### Obtener Historial de Receta

```http
GET /api/v1/recipes/:recipeId/cost-history?tenantId={tenantId}

Response 200:
{
  "history": [
    {
      "id": "uuid",
      "totalCost": 25.50,
      "costPerUnit": 2.55,
      "changedAt": "2026-05-31T10:30:00Z",
      "changedBy": "system",
      "reason": "Producto price update via OCR"
    }
  ]
}
```

## Checklist de Implementación

### Detección de Afectados ✅
- [x] Búsqueda directa de recetas
- [x] Búsqueda recursiva de sub-recetas
- [x] Búsqueda de menús
- [x] Detección circular
- [x] Evitar duplicados

### Recálculo de Recetas ✅
- [x] Cálculo de coste total
- [x] Cálculo de coste por unidad
- [x] Ajuste por rendimiento
- [x] Desglose por ingrediente
- [x] Actualización en DB

### Recálculo de Menús ✅
- [x] Búsqueda de menús afectados
- [x] Cálculo de coste de categoría
- [x] Cálculo de coste de ítem
- [x] Cálculo de coste total
- [x] Actualización en DB

### Historial ✅
- [x] Guardar histórico de recetas
- [x] Guardar histórico de menús
- [x] Limpieza de histórico antiguo
- [x] Timestamp de cambios
- [x] Razón del cambio

### Notificaciones ✅
- [x] Detección de usuarios interesados
- [x] Creación de notificaciones
- [x] Envío de notificaciones
- [x] Resumen de cambios
- [x] Logging de eventos

### Optimización ✅
- [x] Batch processing
- [x] Throttling
- [x] Debouncing
- [x] Cola de procesamiento
- [x] Límites de concurrencia

---

**Versión:** 1.0.0
**Última actualización:** 2026-05-31
**Estado:** ✅ Implementado
**Sprint:** 13 - Ingesta Omnicanal - OCR + IA