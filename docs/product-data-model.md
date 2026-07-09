# Product Data Model - ChefChek

## Modelo de Datos de Productos

El modelo de `Product` es la base del sistema de escandallos en ChefChek, implementando el sistema multi-unidad y cálculo de costeos automático.

## Esquema Prisma Completo

```prisma
model Product {
  id               String           @id @default(cuid())
  tenantId          String
  name              String
  description       String?
  category          String
  supplier          String?

  // Multi-unidad
  purchaseUnit      String           // UC: Caja 10kg, Bote 300uds
  storageUnit       String           // UA: Kilogramos, Litros
  recipeUnit        String           // UR: Gramos, Mililitros

  // Precios
  purchasePrice         Float            // Precio bruto de compra actual
  previousPurchasePrice Float @default(0) // Precio de compra inmediatamente anterior (instantánea del último cambio; alimenta el badge de tendencia del listado)
  netPrice              Float            // Precio neto (producto limpio)
  profitMargin          Float @default(0) // Margen de beneficio

  // Rendimiento
  wastePercentage   Float            @default(0) // Porcentaje de mermas
  yieldFactor       Float            @default(1.0) // Factor de rendimiento

  // Alérgenos (array de IDs)
  allergens         Int[]

  isActive          Boolean          @default(true)
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  tenant            Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  recipeIngredients  RecipeIngredient[]
  stockMovements   StockMovement[]

  @@index([tenantId])
  @@index([tenantId, category])
  @@index([tenantId, supplier])
  @@index([tenantId, name])
  @@map("products")
}
```

## Historial de Precios de Compra

Cada cambio del precio de compra (`purchasePrice`) queda registrado en la tabla `product_price_histories` (modelo `ProductPriceHistory`), para poder consultar subidas/bajadas a lo largo del tiempo.

```prisma
model ProductPriceHistory {
  id            String   @id @default(cuid())
  tenantId      String
  productId     String
  supplierId    String?  // Proveedor asociado al cambio
  albaranId     String?  // Albarán que originó el cambio (null si fue edición manual)
  previousPrice Float    // Precio anterior
  newPrice      Float    // Precio nuevo
  recordedAt    DateTime @default(now())
}
```

**Trazas de escritura** (dos orígenes, ambos graban `previousPrice`/`newPrice`):

- **Edición manual** — `ProductsService.update()`: al cambiar `purchasePrice`, actualiza el producto y crea la fila de historial en la misma transacción. `supplierId` = proveedor actual del producto; `albaranId` = `null`.
- **Confirmación de albarán** — `AlbaranStockService`: al confirmar un albarán con un precio de línea distinto, actualiza `previousPurchasePrice`/`purchasePrice`/`netPrice` y crea la fila de historial con `supplierId` y `albaranId` del albarán.

`previousPurchasePrice` en `Product` es solo una instantánea del último valor (un paso), usada por el indicador de tendencia del listado. El histórico completo vive en `product_price_histories`.

**Lectura**: `GET /api/v1/products/price-history?productId=<id>` devuelve los últimos 50 registros (`recordedAt desc`) con `supplier` y `albaran` incluidos.

## Campos Detallados

### Identificación y Contexto

```typescript
{
  id: "prod-abc123",              // ID único (CUID)
  tenantId: "tenant-xyz789",       // Tenant propietario
  name: "Tomates Frescos",        // Nombre del producto
  description: "Tomates de calidad...", // Descripción opcional
  category: "Verduras",          // Categoría organizativa
  supplier: "Proveedores HU",    // Proveedor (opcional)
}
```

### Sistema Multi-unidad

```typescript
{
  purchaseUnit: "Caja 10kg",      // Unidad de compra
  storageUnit: "Kilogramos",       // Unidad de almacenamiento
  recipeUnit: "Gramos"            // Unidad de receta
}
```

**Convenciones de Nomenclatura:**

| Tipo | Formato | Ejemplos |
|------|---------|----------|
| **UC** | `{Contenedor} {Cantidad} {Medida}` | `Caja 10kg`, `Bote 300uds` |
| **UA** | `{Medida} (plural/español)` | `Kilogramos`, `Litros`, `Unidades` |
| **UR** | `{Medida} (plural/español)` | `Gramos`, `Mililitros`, `Unidades` |

### Precios y Costeos

```typescript
{
  purchasePrice: 25.00,           // €25.00 por Caja 10kg
  netPrice: 22.75,               // €22.75 (calculado con mermas)
  profitMargin: 9.0,              // 9% margen de beneficio
}
```

**Cálculos Automáticos:**
- `netPrice` calculado al crear/actualizar producto
- Fórmula: `purchasePrice × (1 - wastePercentage/100) × (1 + profitMargin/100)`

### Rendimiento y Mermas

```typescript
{
  wastePercentage: 10.0,          // 10% de desperdicio
  yieldFactor: 0.9,               // 90% de aprovechamiento
}
```

**Relación:**
```
yieldFactor = (100 - wastePercentage) / 100
```

**Ejemplos:**
| Waste % | Yield Factor | Descripción |
|---------|-------------|-------------|
| 0% | 1.0 | Sin mermas, 100% aprovechable |
| 10% | 0.9 | 10% merma, 90% aprovechable |
| 25% | 0.75 | 25% merma, 75% aprovechable |
| 50% | 0.5 | 50% merma, 50% aprovechable |

### Alérgenos

```typescript
{
  allergens: [1, 3, 7]  // IDs de alérgenos UE 1169/2011
}
```

**14 Alérgenos UE 1169/2011:**
```typescript
enum AllergenEU {
  CEREALS_WITH_GLUTEN = 1,
  CRUSTACEANS = 2,
  EGGS = 3,
  FISH = 4,
  PEANUTS = 5,
  SOY = 6,
  MILK = 7,
  CELERY = 8,
  MUSTARD = 9,
  SESAME_SEEDS = 10,
  SULFITES = 11,
  LUPIN = 12,
  MOLLUSCS = 13,
  MUSTARD_POWDER = 14
}
```

## Relaciones con Otros Modelos

### 1. Relación con Recetas

```prisma
model RecipeIngredient {
  id           String   @id @default(cuid())
  recipeId     String
  productId    String
  quantity     Float
  unit         String   // Debe coincidir con UR del producto

  recipe       Recipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  product      Product  @relation(fields: [productId], references: [id], onDelete: Restrict)
}
```

### 2. Relación con Stock

```prisma
model StockMovement {
  id           String   @id @default(cuid())
  productId    String
  tenantId      String
  quantity     Float
  unit         String   // Debe coincidir con UA del producto
  type         StockMovementType
  reason       String?

  product      Product  @relation(fields: [productId], references: [id], onDelete: Restrict)
}
```

### 3. Relación con Tenant

```prisma
model Tenant {
  id            String    @id @default(cuid())
  // ... otros campos ...

  products      Product[] // Un tenant tiene muchos productos
}
```

## Validaciones de Negocio

### Reglas de Validación

**1. Unidades Multi-unidad:**
- `purchaseUnit` no puede estar vacío
- `storageUnit` no puede estar vacío
- `recipeUnit` no puede estar vacío
- Conversión UC→UA debe ser válida

**2. Precios:**
- `purchasePrice` debe ser mayor que cero
- `netPrice` debe calcularse automáticamente
- `profitMargin` debe estar entre 0% y 100%

**3. Rendimiento:**
- `wastePercentage` debe estar entre 0% y 100%
- `yieldFactor` debe calcularse automáticamente
- `wastePercentage` y `yieldFactor` deben ser consistentes

**4. Alérgenos:**
- Array de números enteros válidos
- IDs deben corresponder a alérgenos UE 1169/2011
- Array puede estar vacío (sin alérgenos)

## Índices de Base de Datos

```sql
-- Índices para optimización de queries
CREATE INDEX idx_products_tenant ON products(tenantId);
CREATE INDEX idx_products_category ON products(tenantId, category);
CREATE INDEX idx_products_supplier ON products(tenantId, supplier);
CREATE INDEX idx_products_name ON products(tenantId, name);

-- Índices compuestos para queries frecuentes
CREATE INDEX idx_products_tenant_active ON products(tenantId, isActive);
CREATE INDEX idx_products_tenant_category_active ON products(tenantId, category, isActive);
```

## Operaciones CRUD

### Crear Producto

```typescript
POST /api/v1/products
{
  "name": "Tomates Frescos",
  "category": "Verduras",
  "supplier": "Proveedores HU",
  "purchaseUnit": "Caja 10kg",
  "storageUnit": "Kilogramos",
  "recipeUnit": "Gramos",
  "purchasePrice": 25.00,
  "wastePercentage": 10,
  "profitMargin": 5,
  "allergens": []
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "prod-abc123",
    "name": "Tomates Frescos",
    "purchasePrice": 25.00,
    "netPrice": 22.75,
    // ... otros campos
  },
  "message": "Product created successfully"
}
```

### Calcular Costos

```typescript
GET /api/v1/products/:id/calculate

Response:
{
  "success": true,
  "data": {
    "productId": "prod-abc123",
    "productName": "Tomates Frescos",
    "costPerPurchaseUnit": 25.00,
    "costPerStorageUnit": 2.50,
    "costPerRecipeUnit": 0.0025,
    "ucToUaFactor": 10,
    "uaToUrFactor": 1000,
    "ucToUrFactor": 10000,
    "purchasePrice": 25.00,
    "netPrice": 22.75,
    "wastePercentage": 10.0,
    "yieldFactor": 0.9
  },
  "message": "Product cost calculated successfully"
}
```

## Migraciones

### Inicialización de Datos

```prisma
// Seed data para productos base
await prisma.product.createMany({
  data: [
    {
      tenantId: defaultTenant.id,
      name: "Tomates",
      category: "Verduras",
      supplier: "Proveedores HU",
      purchaseUnit: "Caja 10kg",
      storageUnit: "Kilogramos",
      recipeUnit: "Gramos",
      purchasePrice: 25.00,
      wastePercentage: 10,
      profitMargin: 5,
      allergens: [],
    },
    // ... más productos iniciales
  ],
});
```

### Actualización de Schema

```sql
-- Para agregar campos futuros
ALTER TABLE products ADD COLUMN customMetadata JSONB;

-- Para agregar índices futuros
CREATE INDEX idx_products_custom_metadata ON products(tenantId, (customMetadata->>'key'));
```

## Performance Considerations

### 1. Consultas Optimizadas

**Query por tenant con filtros:**
```typescript
await prisma.product.findMany({
  where: {
    tenantId: requestTenantId,
    isActive: true,
    category: 'Verduras',
  },
  select: {
    id: true,
    name: true,
    purchasePrice: true,
    netPrice: true,
  },
  orderBy: { name: 'asc' },
  take: 50,
});
```

### 2. Paginación Eficiente

**Usar cursor-based pagination para listas grandes:**
```typescript
const products = await prisma.product.findMany({
  take: limit + 1, // +1 para cursor
  cursor: lastId,
  where: { tenantId: requestTenantId },
  orderBy: { id: 'asc' },
});
```

### 3. Cache de Cálculos

**Cachear costos calculados:**
```typescript
const costCache = new Map<string, ProductCost>();

async getCalculatedCost(productId: string): Promise<ProductCost> {
  if (costCache.has(productId)) {
    return costCache.get(productId);
  }

  const cost = await this.calculateProductCost(productId, tenantId);
  costCache.set(productId, cost);
  return cost;
}
```

## Seguridad y Aislamiento

### 1. Tenant Isolation

**Toda query incluye tenantId:**
```typescript
// ✅ CORRECTO - Siempre filtrar por tenant
where: { tenantId: requestTenantId }

// ❌ INCORRECTO - No filtrar por tenant
where: {} // Acceso cross-tenant no permitido
```

### 2. Validación de Permisos

**Protección por roles:**
```typescript
@Roles('ADMIN', 'USER')  // Admin y User pueden crear productos
async create(createProductDto: CreateProductDto) { }

@Roles('ADMIN', 'USER', 'VIEWER')  // Todos pueden ver productos
async findAll(query: ProductsQueryDto) { }

@Roles('ADMIN', 'USER')  // Admin y User pueden actualizar productos
async update(id: string, updateDto: UpdateProductDto) { }
```

## Documentación Relacionada

- [Multi-Unit System](./multi-unit-system.md) - Sistema multi-unidad completo
- [Cost Calculation Rules](./cost-calculation-rules.md) - Reglas de cálculo de costeos
- [API Conventions](./api-conventions.md) - Convenciones de API RESTful
- [Database Schema](./database-schema.md) - Esquema de base de datos completo