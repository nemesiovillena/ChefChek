# Recipe Data Model - ChefChek

## Modelo de Datos de Recetas

El modelo de `Recipe` es el núcleo del sistema de escandallos en ChefChek, implementando recetas recursivas, versionado automático y cálculo de costeos en tiempo real.

## Esquema Prisma Completo

```prisma
model Recipe {
  id               String           @id @default(cuid())
  tenantId          String
  name              String
  description       String?
  elaboration       String           // TipTap JSON (instrucciones)

  // Costeo
  totalCost         Float            @default(0)
  totalCostPerUnit  Float            @default(0)

  // Rendimiento
  portions          Int              @default(1)
  portionSize       Float            @default(1)

  // Versionado
  version           Int              @default(1)
  parentVersion     String?

  isActive          Boolean          @default(true)
  isPublic          Boolean          @default(false)
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  tenant            Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  ingredients       RecipeIngredient[]
  subRecipes        RecipeSubRecipe[]
  menuItems         MenuItem[]

  @@index([tenantId])
  @@index([tenantId, isActive])
  @@map("recipes")
}

model RecipeIngredient {
  id           String   @id @default(cuid())
  recipeId     String
  productId    String
  quantity     Float
  unit         String   // Debe coincidir con UR del producto

  recipe       Recipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  product      Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([recipeId, productId])
  @@index([recipeId])
  @@index([productId])
  @@map("recipe_ingredients")
}

model RecipeSubRecipe {
  id              String   @id @default(cuid())
  parentRecipeId  String
  subRecipeId     String
  quantity        Float
  unit            String

  parentRecipe    Recipe   @relation("ParentRecipe", fields: [parentRecipeId], references: [id], onDelete: Cascade)
  subRecipe       Recipe   @relation("SubRecipe", fields: [subRecipeId], references: [id], onDelete: Cascade)

  @@unique([parentRecipeId, subRecipeId])
  @@index([parentRecipeId])
  @@index([subRecipeId])
  @@map("recipe_sub_recipes")
}
```

## Campos Detallados

### Identificación y Contexto

```typescript
{
  id: "recipe-abc123",         // ID único (CUID)
  tenantId: "tenant-xyz789",   // Tenant propietario
  name: "Salsa de Tomate",     // Nombre de la receta
  description: "Salsa clásica...", // Descripción opcional
}
```

### Sistema de Elaboración (TipTap JSON)

```typescript
{
  elaboration: JSON.stringify({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Picar los tomates en cubos pequeños." }
        ]
      },
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Cocer a fuego medio 20 minutos" }] }] }
        ]
      }
    ]
  })
}
```

**TipTap Extensions Activadas:**
- `StarterKit` - Bold, Italic, Heading, List, etc.
- `Underline` - Texto subrayado
- `TextAlign` - Alineación de texto
- `ListItem` - Items de lista personalizables

### Sistema de Costeos

```typescript
{
  totalCost: 6.45,              // Costo total de la receta
  totalCostPerUnit: 64.50,      // Costo por 100g/100ml
  costBreakdown: {
    ingredientsCost: 5.45,       // Costo de ingredientes base
    subRecipesCost: 1.00,        // Costo de sub-recetas
    totalCost: 6.45,             // Suma total
    costPerPortion: 0.645,       // Costo por porción
    costPerUnit: 64.50,          // Costo por unidad de medida
  }
}
```

### Rendimiento y Porciones

```typescript
{
  portions: 10,                  // 10 porciones
  portionSize: 150,              // 150g por porción
}
```

**Cálculo de Porciones:**
```
Costo/Porción = Costo Total / Porciones
Costo/Unidad = Costo Total / (Porciones × Tamaño Porción) × 100
```

### Sistema de Versionado

```typescript
{
  version: 2,                    // Versión actual
  parentVersion: "recipe-original-123", // ID de versión anterior
}
```

**Lógica de Versionado:**
- Incremento automático en cambios significativos
- Referencia a versión anterior en `parentVersion`
- Snapshots completos para rollback
- Historial de cambios trazable

### Ingredientes Base (Recursivos)

```typescript
{
  ingredients: [
    {
      id: "ing-123",
      productId: "prod-tomates",
      productName: "Tomates Frescos",
      quantity: 2.0,             // 2 kg
      unit: "Kilogramos",
      cost: 5.00                 // Costo calculado
    }
  ]
}
```

### Sub-Recetas Anidadas

```typescript
{
  subRecipes: [
    {
      id: "sub-123",
      subRecipeId: "recipe-sofrito",
      subRecipeName: "Sofrito Básico",
      quantity: 200,             // 200g de sofrito
      unit: "Gramos",
      totalCost: 2.50,           // Costo total del sofrito
      costPerUnit: 12.50         // Costo por kg de sofrito
    }
  ]
}
```

## Relaciones con Otros Modelos

### 1. Relación con Productos (Ingredientes Base)

```prisma
model RecipeIngredient {
  id           String   @id @default(cuid())
  recipeId     String
  productId    String
  quantity     Float
  unit         String   // Debe coincidir con UR del producto

  recipe       Recipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  product      Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
}
```

**Validaciones:**
- `unit` debe coincidir con `recipeUnit` del producto
- Cálculo automático de costos usando `costPerRecipeUnit`
- Soporte para alérgenos en cascada

### 2. Relación Recursiva (Sub-Recetas)

```prisma
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

**Lógica Recursiva:**
- Costos calculados recursivamente
- Alérgenos propagados en cascada
- Soporte para sub-recetas de sub-recetas (profundidad ilimitada)
- Detección de ciclos infinitos

### 3. Relación con Tenant

```prisma
model Tenant {
  id      String   @id @default(cuid())
  // ... otros campos ...

  recipes Recipe[]
}
```

## Validaciones de Negocio

### Reglas de Validación

**1. Elaboración TipTap:**
- Debe ser JSON válido
- Estructura mínima requerida (`type: "doc"`)
- Soporte para extensiones configuradas

**2. Ingredientes:**
- Cada ingrediente debe referenciar un producto válido
- `unit` debe coincidir con `recipeUnit` del producto
- Cantidad debe ser mayor que cero

**3. Sub-Recetas:**
- Sub-receta debe ser diferente de receta padre
- Detección de ciclos infinitos
- Validación de profundidad recursiva (máx 10 niveles)

**4. Costeos:**
- Cálculo automático al crear/actualizar
- Recálculo en cascada de recetas que usan esta receta
- Validación de costos no negativos

**5. Versionado:**
- Incremento automático en cambios significativos
- No se pueden eliminar versiones activas
- Snapshots inmutables

## Índices de Base de Datos

```sql
-- Índices para optimización de queries
CREATE INDEX idx_recipes_tenant ON recipes(tenantId);
CREATE INDEX idx_recipes_tenant_active ON recipes(tenantId, isActive);
CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipeId);
CREATE INDEX idx_recipe_ingredients_product ON recipe_ingredients(productId);
CREATE INDEX idx_recipe_sub_recipes_parent ON recipe_sub_recipes(parentRecipeId);
CREATE INDEX idx_recipe_sub_recipes_sub ON recipe_sub_recipes(subRecipeId);
```

## Operaciones CRUD

### Crear Receta

```typescript
POST /api/v1/recipes
{
  "name": "Salsa de Tomate",
  "description": "Salsa clásica italiana",
  "elaboration": "{\"type\":\"doc\",\"content\":[...]}",
  "portions": 10,
  "portionSize": 150,
  "ingredients": [
    {
      "productId": "prod-tomates",
      "quantity": 2.0,
      "unit": "Kilogramos"
    }
  ],
  "subRecipes": [
    {
      "subRecipeId": "recipe-sofrito",
      "quantity": 200,
      "unit": "Gramos"
    }
  ],
  "isPublic": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "recipe-abc123",
    "name": "Salsa de Tomate",
    "totalCost": 6.45,
    "totalCostPerUnit": 64.50,
    "version": 1,
    "ingredients": [...],
    "subRecipes": [...],
    "costBreakdown": {
      "ingredientsCost": 5.45,
      "subRecipesCost": 1.00,
      "totalCost": 6.45,
      "costPerPortion": 0.645,
      "costPerUnit": 64.50
    },
    "allergens": [1, 3, 7]
  },
  "message": "Recipe created successfully"
}
```

### Calcular Costos

```typescript
GET /api/v1/recipes/:id/calculate

Response:
{
  "success": true,
  "data": {
    "ingredientsCost": 5.45,
    "subRecipesCost": 1.00,
    "totalCost": 6.45,
    "costPerPortion": 0.645,
    "costPerUnit": 64.50
  },
  "message": "Recipe cost calculated successfully"
}
```

### Duplicar Receta

```typescript
POST /api/v1/recipes/:id/duplicate
{
  "newName": "Salsa de Tomate Picante"
}

Response:
{
  "success": true,
  "data": {
    "id": "recipe-def456",
    "name": "Salsa de Tomate Picante",
    "version": 1,
    "parentVersion": null,
    // ... mismos ingredientes y sub-recetas
  },
  "message": "Recipe duplicated successfully"
}
```

## Cálculo de Costeos Recursivos

### Fórmula Completa

```typescript
private async calculateCost(
  tenantId: string,
  ingredients: Ingredient[],
  subRecipes: SubRecipe[]
): Promise<RecipeCostBreakdown> {
  let ingredientsCost = 0;
  let subRecipesCost = 0;

  // 1. Costos de ingredientes base
  for (const ingredient of ingredients) {
    const product = await this.getProduct(ingredient.productId);
    const costPerUnit = await this.calculateProductCostPerUnit(product);
    const ingredientCost = ingredient.quantity * costPerUnit;
    ingredientsCost += ingredientCost;
  }

  // 2. Costos de sub-recetas (recursivo)
  for (const subRecipe of subRecipes) {
    const subRecipeData = await this.getRecipe(subRecipe.subRecipeId);
    const subRecipeCostPerUnit = subRecipeData.totalCostPerUnit;
    const subRecipeCost = subRecipe.quantity * subRecipeCostPerUnit;
    subRecipesCost += subRecipeCost;
  }

  return {
    ingredientsCost,
    subRecipesCost,
    totalCost: ingredientsCost + subRecipesCost,
    costPerPortion: totalCost / portions,
    costPerUnit: totalCost * 100 / (portions * portionSize),
  };
}
```

### Ejemplo Completo

```
Receta: Salsa de Tomate (10 porciones, 150g c/u)

Ingredientes Base:
- Tomates: 2kg × €0.0025/g = €5.00
- Cebolla: 300g × €0.0015/g = €0.45
Total Ingredientes: €5.45

Sub-Recetas:
- Sofrito: 200g × €0.0125/g = €2.50
  [Cálculo recursivo del Sofrito:
   - Ajo: 50g × €0.008/g = €0.40
   - Aceite: 50ml × €0.005/ml = €0.25
   - Cebolla: 100g × €0.0015/g = €0.15
   Total Sofrito: €0.80 × rendimiento = €2.50]

Total Receta: €5.45 + €2.50 = €7.95
Costo/Porción: €7.95 / 10 = €0.795
Costo/100g: €7.95 / (10 × 150g) × 100 = €5.30
```

## Migraciones

### Inicialización de Datos

```prisma
// Seed data para recetas base
await prisma.recipe.createMany({
  data: [
    {
      tenantId: defaultTenant.id,
      name: "Salsa de Tomate",
      description: "Salsa clásica italiana",
      elaboration: JSON.stringify({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Picar los tomates..." }] }
        ]
      }),
      portions: 10,
      portionSize: 150,
      totalCost: 7.95,
      totalCostPerUnit: 5.30,
    },
  ],
});
```

## Performance Considerations

### 1. Queries Optimizadas

**Query con relaciones anidadas:**
```typescript
await prisma.recipe.findMany({
  where: { tenantId, isActive: true },
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
          },
        },
      },
    },
  },
  take: 50,
});
```

### 2. Cache de Costeos

```typescript
const costCache = new Map<string, RecipeCostBreakdown>();

async getCachedCost(recipeId: string): Promise<RecipeCostBreakdown> {
  if (costCache.has(recipeId)) {
    return costCache.get(recipeId);
  }

  const cost = await this.calculateRecipeCost(recipeId, tenantId);
  costCache.set(recipeId, cost);
  return cost;
}
```

## Seguridad y Aislamiento

### 1. Tenant Isolation

**Toda query incluye tenantId:**
```typescript
// ✅ CORRECTO
where: { tenantId: requestTenantId, isActive: true }

// ❌ INCORRECTO
where: { isActive: true } // Acceso cross-tenant no permitido
```

### 2. Protección por Roles

```typescript
@Roles('ADMIN', 'USER')  // Admin y User pueden crear recetas
async create(createRecipeDto: CreateRecipeDto) { }

@Roles('ADMIN', 'USER', 'VIEWER')  // Todos pueden ver recetas
async findAll(query: RecipesQueryDto) { }

@Roles('ADMIN')  // Solo Admin puede eliminar recetas
async remove(id: string) { }
```

## Documentación Relacionada

- [Recursive Recipe System](./recursive-recipe-system.md) - Sistema de recetas recursivas
- [TipTap Integration](./tiptap-integration.md) - Integración de editor TipTap
- [Cost Engine Algorithm](./cost-engine-algorithm.md) - Algoritmo de cálculo de costeos
- [Product Data Model](./product-data-model.md) - Modelo de datos de productos
- [Multi-Unit System](./multi-unit-system.md) - Sistema multi-unidad