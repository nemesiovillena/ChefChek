# Multi-Unit System - ChefChek

## Sistema Multi-unidad Métrica

ChefChek implementa un sistema **multi-unidad** avanzado que permite gestión precisa de ingredientes desde la compra hasta su uso en recetas, cubriendo tres niveles fundamentales de conversión.

## Conceptos Principales

### 1. Unidades de Compra (UC) - Purchase Unit

**Definición:** La unidad en la que se compra el ingrediente al proveedor.

**Ejemplos:**
- `Caja 10kg` - Compra de hortalizas por cajas de 10 kilogramos
- `Bote 300uds` - Compra de latas por botes de 300 unidades
- `Saco 25kg` - Compra de harina por sacos de 25 kilogramos
- `Lote 1000L` - Compra de aceite por lotes de 1000 litros

**Propósito:** Control de costeo de compra y negociación con proveedores.

### 2. Unidades de Almacenamiento (UA) - Storage Unit

**Definición:** La unidad estándar para control de stock en almacén.

**Ejemplos:**
- `Kilogramos` - Para productos pesables
- `Litros` - Para productos líquidos
- `Unidades` - Para productos discretos
- `Gramos` - Para ingredientes de bajo peso

**Propósito:** Gestión de inventario y control de stock físico.

### 3. Unidades de Receta (UR) - Recipe Unit

**Definición:** La unidad utilizada en la cocina para elaborar platos.

**Ejemplos:**
- `Gramos` - Para pesada precisa de ingredientes
- `Mililitros` - Para medición de líquidos en recetas
- `Unidades` - Para ingredientes discretos en porciones
- `Miligramos` - Para ingredientes en cantidades muy pequeñas

**Propósito:** Elaboración precisa de recetas y costeo por porción.

## Sistema de Conversión

### Cadena de Conversión

```
UC (Compra) → UA (Almacén) → UR (Receta)
   ↓              ↓                ↓
Factor UC→UA    Factor UA→UR     Factor UC→UR
```

### Fórmulas de Conversión

**1. UC → UA (Factor de Aprovechamiento):**
```
Cantidad en UA = Cantidad en UC × Factor UC→UA
```

**Ejemplo:**
- UC: `Caja 10kg` → UA: `Kilogramos`
- Factor: `10` (1 caja = 10kg)
- Resultado: `1 Caja 10kg = 10 Kilogramos`

**2. UA → UR (Factor de Precisión):**
```
Cantidad en UR = Cantidad en UA × Factor UA→UR
```

**Ejemplo:**
- UA: `Kilogramos` → UR: `Gramos`
- Factor: `1000` (1kg = 1000g)
- Resultado: `1 Kilogramo = 1000 Gramos`

**3. UC → UR (Conversión Directa):**
```
Cantidad en UR = Cantidad en UC × Factor UC→UA × Factor UA→UR
```

**Ejemplo:**
- UC: `Caja 10kg` → UR: `Gramos`
- Factor: `10 × 1000 = 10000`
- Resultado: `1 Caja 10kg = 10000 Gramos`

## Factores de Conversión Configurables

### Sistema de Mapeo de Conversión

```typescript
// backend/src/modules/products/products.service.ts
private getUcToUaFactor(purchaseUnit: string, storageUnit: string): number {
  const conversionMap: { [key: string]: { [key: string]: number } } = {
    'Caja 10kg': { 'Kilogramos': 10, 'Gramos': 10000 },
    'Bote 300uds': { 'Unidades': 300 },
    'Saco 25kg': { 'Kilogramos': 25, 'Gramos': 25000 },
    'Litro': { 'Litros': 1, 'Mililitros': 1000 },
    'Kilogramo': { 'Kilogramos': 1, 'Gramos': 1000 },
  };

  return conversionMap[purchaseUnit]?.[storageUnit] || 1;
}
```

### Factores de Conversión Más Comunes

| Unidad de Compra | Unidad de Almacén | Factor |
|------------------|-------------------|---------|
| Caja 10kg | Kilogramos | 10 |
| Caja 10kg | Gramos | 10,000 |
| Bote 300uds | Unidades | 300 |
| Saco 25kg | Kilogramos | 25 |
| Litro | Litros | 1 |
| Litro | Mililitros | 1,000 |
| Kilogramo | Gramos | 1,000 |
| Metro Lineal | Centímetros | 100 |

## Implementación en Base de Datos

### Esquema Prisma

```prisma
model Product {
  // ... otros campos ...

  // Multi-unidad
  purchaseUnit      String  // UC: Caja 10kg, Bote 300uds
  storageUnit       String  // UA: Kilogramos, Litros
  recipeUnit        String  // UR: Gramos, Mililitros

  // ... otros campos ...
}
```

### Consulta de Conversión

```typescript
// Obtener conversión completa para un producto
const conversion = {
  uc: product.purchaseUnit,      // "Caja 10kg"
  ua: product.storageUnit,       // "Kilogramos"
  ur: product.recipeUnit,        // "Gramos"

  ucToUa: 10,                     // Factor UC → UA
  uaToUr: 1000,                   // Factor UA → UR
  ucToUr: 10000,                   // Factor UC → UR
};
```

## Uso en Recetas

### Ejemplo: Costeo de Receta con Multi-unidad

**Producto:**
- Nombre: `Tomates`
- UC: `Caja 10kg`
- UA: `Kilogramos`
- UR: `Gramos`
- Precio UC: `€25.00` (precio de la caja)

**Cálculo de Costeo:**

1. **Costo por UA (Kilogramo):**
```
€25.00 ÷ 10 = €2.50/kg
```

2. **Costo por UR (Gramo):**
```
€2.50 ÷ 1000 = €0.0025/g
```

3. **Costo en Receta (500g de tomates):**
```
500g × €0.0025/g = €1.25
```

## Precios por Unidad

### Cálculo Automático de Costeos

**Endpoint:** `GET /api/v1/products/:id/calculate`

**Response:**
```json
{
  "success": true,
  "data": {
    "productId": "prod-id",
    "productName": "Tomates",
    "costPerPurchaseUnit": 25.00,
    "costPerStorageUnit": 2.50,
    "costPerRecipeUnit": 0.0025,
    "ucToUaFactor": 10,
    "uaToUrFactor": 1000,
    "ucToUrFactor": 10000,
    "purchasePrice": 25.00,
    "netPrice": 22.75,
    "wastePercentage": 9,
    "yieldFactor": 0.91
  }
}
```

## Frontend Implementation

### Selector de Unidades Multi-unidad

```typescript
// Formulario de creación de producto
<form>
  <input
    name="purchaseUnit"
    placeholder="Caja 10kg"
    list="purchase-units"
  />
  <datalist id="purchase-units">
    <option value="Caja 10kg" />
    <option value="Bote 300uds" />
    <option value="Saco 25kg" />
    <option value="Litro" />
  </datalist>

  <input
    name="storageUnit"
    placeholder="Kilogramos"
    list="storage-units"
  />
  <datalist id="storage-units">
    <option value="Kilogramos" />
    <option value="Litros" />
    <option value="Unidades" />
  </datalist>

  <input
    name="recipeUnit"
    placeholder="Gramos"
    list="recipe-units"
  />
  <datalist id="recipe-units">
    <option value="Gramos" />
    <option value="Mililitros" />
    <option value="Unidades" />
  </datalist>
</form>
```

### Visualización de Conversión

```typescript
// Mostrar conversión en UI
<div className="conversion-info">
  <div>
    <span className="font-semibold">1 {product.purchaseUnit}</span>
    <span>=</span>
    <span className="font-semibold">{product.ucToUa} {product.storageUnit}</span>
    <span>=</span>
    <span className="font-semibold">{product.ucToUr} {product.recipeUnit}</span>
  </div>
  <div className="mt-2 text-sm text-gray-600">
    Cost: €{product.costPerRecipeUnit.toFixed(4)}/{product.recipeUnit}
  </div>
</div>
```

## Validación de Conversión

### Reglas de Negocio

1. **Validación de Factores:**
   - Factores deben ser positivos
   - Factores no pueden ser cero
   - Conversión circular no permitida

2. **Consistencia de Unidades:**
   - UC y UA deben ser compatibles
   - UA y UR deben ser compatibles
   - Sistema de validación dimensional

3. **Alertas de Conversión:**
   - Factores de conversión no estándar requieren configuración
   - Conversión con alta pérdida de precisión debe alertarse

## Performance y Optimización

### Cache de Conversiones

```typescript
// Cache de conversiones frecuentes
const conversionCache = new Map();

private getCachedConversion(uc: string, ua: string, ur: string): number {
  const key = `${uc}:${ua}:${ur}`;
  if (conversionCache.has(key)) {
    return conversionCache.get(key);
  }

  const factor = this.calculateConversion(uc, ua, ur);
  conversionCache.set(key, factor);
  return factor;
}
```

### Pre-cálculo de Costos

```typescript
// Calcular costos al guardar producto
async create(createProductDto: CreateProductDto) {
  const {
    purchasePrice,
    wastePercentage = 0,
    profitMargin = 0,
    ...productData
  } = createProductDto;

  // Calcular precios netos automáticamente
  const netPrice = this.calculateNetPrice(purchasePrice, wastePercentage, profitMargin);

  // Pre-calcular factores de conversión
  const ucToUaFactor = this.getUcToUaFactor(productData.purchaseUnit, productData.storageUnit);
  const uaToUrFactor = this.getUaToUrFactor(productData.storageUnit, productData.recipeUnit);

  return this.prisma.product.create({
    data: {
      ...productData,
      netPrice,
      // Guardar factores para cálculo rápido
    },
  });
}
```

## Troubleshooting Multi-unidad

### Problemas Comunes

**1. Conversión Incorrecta:**
- Verificar factores de conversión configurados
- Validar compatibilidad de unidades
- Revisar cálculos matemáticos

**2. Costeo Inexacto:**
- Verificar que yieldFactor esté calculado correctamente
- Validar cálculo de wastePercentage
- Revisar conversión completa UC→UR

**3. Inconsistencia en Recetas:**
- Asegurar que las conversiones sean consistentes
- Validar que las URs sean apropiadas para recetas
- Revisar redondeo en cálculos

## Documentación Relacionada

- [Cost Calculation Rules](./cost-calculation-rules.md) - Reglas de cálculo de costeos
- [Product Data Model](./product-data-model.md) - Modelo de datos de productos
- [Tech Stack](./tech-stack.md) - Stack tecnológico detallado
- [System Architecture](./system-architecture.md) - Arquitectura del sistema