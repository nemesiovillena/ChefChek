# Recursive Recipe System - ChefChek

## Sistema de Recetas Recursivas

ChefChek implementa un sistema de recetas recursivas que permite composición compleja de platos mediante anidación de recetas dentro de otras recetas.

## Conceptos Fundamentales

### 1. Recetas vs Ingredientes

**Receta Base:** Contiene ingredientes directos del inventario (productos)
```
Receta: Sofrito Básico
├── Ajo: 50g
├── Cebolla: 100g
└── Aceite: 50ml
```

**Receta Compuesta:** Contiene otras recetas como ingredientes
```
Receta: Paella Valenciana
├── Arroz: 500g
├── Sofrito Básico: 200g [RECETA ANIDADA]
├── Pollo: 400g
└── Caldo: 1L
```

### 2. Profundidad Recursiva

El sistema soporta múltiples niveles de anidación:

```
Nivel 0: Paella Valenciana
├── Nivel 1: Sofrito Básico
│   └── Nivel 2: Pasta de Tomate
│       └── Nivel 3: Tomates Naturales
└── Nivel 1: Caldo de Pollo
    └── Nivel 2: Verduras para Caldo
```

**Límite de Seguridad:** Máximo 10 niveles de profundidad para prevenir stack overflow.

## Arquitectura de Base de Datos

### Modelo Recursivo

```prisma
model Recipe {
  id               String           @id @default(cuid())
  tenantId          String
  name              String
  description       String?
  elaboration       String           // TipTap JSON

  // Costeo
  totalCost         Float            @default(0)
  totalCostPerUnit  Float            @default(0)

  // Relaciones recursivas
  ingredients       RecipeIngredient[]
  subRecipes        RecipeSubRecipe[]
}

model RecipeIngredient {
  id           String   @id @default(cuid())
  recipeId     String   // Receta padre
  productId    String   // Producto del inventario
  quantity     Float
  unit         String

  recipe       Recipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  product      Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
}

model RecipeSubRecipe {
  id              String   @id @default(cuid())
  parentRecipeId  String   // Receta padre
  subRecipeId     String   // Sub-receta anidada
  quantity        Float
  unit            String

  parentRecipe    Recipe   @relation("ParentRecipe", fields: [parentRecipeId], references: [id], onDelete: Cascade)
  subRecipe       Recipe   @relation("SubRecipe", fields: [subRecipeId], references: [id], onDelete: Cascade)
}
```

### Relación Auto-Referencial

```prisma
// Una receta puede ser padre de muchas sub-recetas
// Una receta puede ser hija de muchas recetas padre
model Recipe {
  id           String  @id @default(cuid())
  name         String

  // Recetas que usan esta receta como ingrediente
  parentInSub  RecipeSubRecipe[] @relation("SubRecipe")

  // Sub-recetas que esta receta contiene
  childSubs    RecipeSubRecipe[] @relation("ParentRecipe")
}
```

## Cálculo de Costeos Recursivos

### Algoritmo de Cálculo

```typescript
async calculateRecipeCost(recipeId: string, depth: number = 0): Promise<RecipeCost> {
  if (depth > 10) {
    throw new Error('Maximum recursion depth exceeded');
  }

  const recipe = await this.getRecipe(recipeId);
  let totalCost = 0;

  // 1. Costos de ingredientes base
  for (const ingredient of recipe.ingredients) {
    const productCost = await this.calculateProductCost(ingredient);
    totalCost += productCost;
  }

  // 2. Costos de sub-recetas (recursivo)
  for (const subRecipe of recipe.subRecipes) {
    const subRecipeCost = await this.calculateRecipeCost(
      subRecipe.subRecipeId,
      depth + 1 // Incrementar profundidad
    );

    // Calcular costo proporcional
    const proportionalCost = this.calculateProportionalCost(
      subRecipeCost,
      subRecipe.quantity,
      subRecipe.unit
    );

    totalCost += proportionalCost;
  }

  return {
    totalCost,
    costPerPortion: totalCost / recipe.portions,
    depth, // Profundidad alcanzada
  };
}
```

### Fórmula de Costo Proporcional

```
Costo Proporcional = (Cantidad Usada / Cantidad Total) × Costo Total Sub-Receta

Ejemplo:
- Sub-Receta: Sofrito (Costo total €2.50, produce 500g)
- Uso en Receta: 200g de Sofrito
- Cálculo: (200g / 500g) × €2.50 = €1.00
```

## Propagación de Alérgenos en Cascada

### Algoritmo de Propagación

```typescript
async calculateAllergens(recipeId: string, visited = new Set<string>()): Promise<number[]> {
  if (visited.has(recipeId)) {
    return []; // Evitar ciclos infinitos
  }

  visited.add(recipeId);
  const allergens = new Set<number>();

  const recipe = await this.getRecipe(recipeId);

  // 1. Alérgenos de ingredientes base
  for (const ingredient of recipe.ingredients) {
    const product = await this.getProduct(ingredient.productId);
    product.allergens.forEach(a => allergens.add(a));
  }

  // 2. Alérgenos de sub-recetas (recursivo)
  for (const subRecipe of recipe.subRecipes) {
    const subRecipeAllergens = await this.calculateAllergens(
      subRecipe.subRecipeId,
      visited
    );

    subRecipeAllergens.forEach(a => allergens.add(a));
  }

  return Array.from(allergens);
}
```

### Ejemplo de Propagación

```
Receta: Paella Valenciana
├── Arroz: []
├── Sofrito Básico: [1, 2, 7] (Trigo, Crustáceos, Leche)
│   └── Pasta de Tomate: [1, 3] (Trigo, Huevos)
│       └── Tomates Naturales: []
└── Pollo: [7] (Leche)

Resultado Paella: [1, 2, 3, 7] (Trigo, Crustáceos, Huevos, Leche)
```

## Detección de Ciclos Infinitos

### Algoritmo de Detección

```typescript
private detectCycles(recipeId: string, currentPath: string[] = []): boolean {
  if (currentPath.includes(recipeId)) {
    // ¡Ciclo detectado!
    return true;
  }

  const recipe = await this.getRecipe(recipeId);
  const newPath = [...currentPath, recipeId];

  for (const subRecipe of recipe.subRecipes) {
    if (await this.detectCycles(subRecipe.subRecipeId, newPath)) {
      return true;
    }
  }

  return false;
}
```

### Ejemplo de Ciclo Detectado

```
❌ CICLO INFINITO DETECTADO:
Paella → Sofrito → Pasta de Tomate → Paella (¡Ciclo!)

🚫 Acción: Rechazar esta configuración y alertar al usuario
```

## Gestión de Versiones en Recetas Recursivas

### Versionado en Cascada

```typescript
async updateRecipe(recipeId: string, updateDto: UpdateRecipeDto): Promise<Recipe> {
  const recipe = await this.getRecipe(recipeId);

  // Crear nueva versión
  const newVersion = recipe.version + 1;
  const parentVersion = recipe.id;

  const updatedRecipe = await this.createNewVersion({
    ...updateDto,
    version: newVersion,
    parentVersion,
  });

  // Recalcular costos de recetas padre
  await this.recalculateParentRecipes(recipeId);

  return updatedRecipe;
}
```

### Impacto en Recetas Padre

```typescript
async recalculateParentRecipes(recipeId: string): Promise<void> {
  // Encontrar todas las recetas que usan esta receta como ingrediente
  const parentRecipes = await this.prisma.recipeSubRecipe.findMany({
    where: { subRecipeId: recipeId },
    include: { parentRecipe: true },
  });

  // Recalcular costos de cada receta padre
  for (const parent of parentRecipes) {
    const newCost = await this.calculateRecipeCost(parent.parentRecipeId);
    await this.prisma.recipe.update({
      where: { id: parent.parentRecipeId },
      data: {
        totalCost: newCost.totalCost,
        totalCostPerUnit: newCost.costPerPortion,
      },
    });
  }
}
```

## Validaciones de Seguridad

### 1. Validación de Profundidad

```typescript
const MAX_DEPTH = 10;

async validateDepth(recipeId: string, currentDepth = 0): Promise<boolean> {
  if (currentDepth > MAX_DEPTH) {
    throw new Error(`Maximum depth of ${MAX_DEPTH} levels exceeded`);
  }

  const recipe = await this.getRecipe(recipeId);

  for (const subRecipe of recipe.subRecipes) {
    await this.validateDepth(subRecipe.subRecipeId, currentDepth + 1);
  }

  return true;
}
```

### 2. Validación de Ciclos

```typescript
async validateNoCycles(recipeId: string): Promise<boolean> {
  if (await this.detectCycles(recipeId)) {
    throw new Error('Circular dependency detected in recipe composition');
  }

  return true;
}
```

### 3. Validación de Unidades

```typescript
async validateUnits(recipeId: string): Promise<boolean> {
  const recipe = await this.getRecipe(recipeId);

  for (const ingredient of recipe.ingredients) {
    const product = await this.getProduct(ingredient.productId);

    if (ingredient.unit !== product.recipeUnit) {
      throw new Error(
        `Unit mismatch: Ingredient uses ${ingredient.unit}, ` +
        `but product recipe unit is ${product.recipeUnit}`
      );
    }
  }

  return true;
}
```

## Performance y Optimización

### Cache de Costeos

```typescript
const costCache = new Map<string, RecipeCost>();

async getCachedCost(recipeId: string): Promise<RecipeCost> {
  if (costCache.has(recipeId)) {
    return costCache.get(recipeId);
  }

  const cost = await this.calculateRecipeCost(recipeId);
  costCache.set(recipeId, cost);

  // Invalidar cache si cambia la receta o sus dependencias
  return cost;
}
```

### Queries Optimizadas

```typescript
// Cargar toda la estructura recursiva en una query
async loadRecipeStructure(recipeId: string): Promise<RecipeStructure> {
  return await this.prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      ingredients: {
        include: { product: true },
      },
      subRecipes: {
        include: {
          subRecipe: {
            include: {
              ingredients: {
                include: { product: true },
              },
              subRecipes: {
                include: { subRecipe: true },
              },
            },
          },
        },
      },
    },
  });
}
```

## Troubleshooting

### Problemas Comunes

**1. Costos Incorrectos:**
- Verificar cálculo de costos proporcionales
- Validar que las unidades coincidan
- Revisar caché de costos

**2. Ciclos Infinitos:**
- Usar algoritmo de detección de ciclos
- Validar profundidad máxima
- Implementar timeout en cálculos recursivos

**3. Alérgenos Faltantes:**
- Verificar propagación en cascada
- Validar detección de ciclos en cálculo de alérgenos
- Revisar productos sin alérgenos declarados

## Documentación Relacionada

- [Recipe Data Model](./recipe-data-model.md) - Modelo de datos de recetas
- [TipTap Integration](./tiptap-integration.md) - Integración de editor TipTap
- [Cost Engine Algorithm](./cost-engine-algorithm.md) - Algoritmo de cálculo de costeos
- [Product Data Model](./product-data-model.md) - Modelo de datos de productos