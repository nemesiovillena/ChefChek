# Database Schema - ChefChek

## Tablas Principales

### Core (Multi-tenancy)

**Tenant**
- `id` (PK, String): Identificador único
- `name` (String): Nombre del tenant/empresa
- `slug` (String, unique): Slug para dominio/subdominio
- `domain` (String?, unique): Dominio personalizado
- `isActive` (Boolean): Estado del tenant
- `createdAt/updatedAt` (DateTime): Timestamps

**User**
- `id` (PK, String): Identificador único
- `tenantId` (FK): Referencia al tenant
- `email` (String): Email del usuario
- `passwordHash` (String): Hash de contraseña
- `name` (String): Nombre del usuario
- `role` (UserRole): ADMIN, USER, VIEWER
- `isActive` (Boolean): Estado del usuario
- `createdAt/updatedAt` (DateTime): Timestamps
- **Unique constraint**: [email, tenantId]

**Session**
- `id` (PK, String): Identificador único
- `userId` (FK): Referencia al usuario
- `expiresAt` (DateTime): Expiración de sesión
- `ipAddress` (String?): IP del cliente
- `userAgent` (String?): User-Agent del cliente
- `createdAt` (DateTime): Timestamp

### Escandallos (Core Fase 1)

**Product**
- `id` (PK, String): Identificador único
- `tenantId` (FK): Referencia al tenant
- `name` (String): Nombre del producto
- `description` (String?): Descripción
- `category` (String): Categoría
- `supplier` (String?): Proveedor

**Multi-unidad Métrica**
- `purchaseUnit` (String): Unidad de Compra (UC)
  - Ej: "Caja 10kg", "Bote 300uds", "Saco 25kg"
- `storageUnit` (String): Unidad de Almacenamiento (UA)
  - Ej: "Kilogramos", "Litros", "Unidades"
- `recipeUnit` (String): Unidad de Receta (UR)
  - Ej: "Gramos", "Mililitros", "Unidades"

**Precios**
- `purchasePrice` (Float): Precio bruto de compra
- `netPrice` (Float): Precio neto (producto limpio)
- `profitMargin` (Float): Margen de beneficio

**Rendimiento**
- `wastePercentage` (Float): Porcentaje de mermas
- `yieldFactor` (Float): Factor de rendimiento

**Alérgenos**
- `allergens` (Int[]): Array de IDs de alérgenos

### Recetas

**Recipe**
- `id` (PK, String): Identificador único
- `tenantId` (FK): Referencia al tenant
- `name` (String): Nombre de receta
- `description` (String?): Descripción
- `elaboration` (String): TipTap JSON estructurado

**Costeo**
- `totalCost` (Float): Costo total
- `totalCostPerUnit` (Float): Costo por porción
- `portions` (Int): Número de porciones
- `portionSize` (Float): Tamaño de porción

**Versionado**
- `version` (Int): Versión actual
- `parentVersion` (String?): Versión padre

**Ingredientes y Sub-recetas**
- `RecipeIngredient`: Productos en receta
- `RecipeSubRecipe`: Sub-recetas anidadas

### Menús y Cartas

**Menu**
- Modelo de menús con composición dinámica

**CartItem**
- Ítems que componen menús y cartas digitales

## Relaciones

### One-to-Many
- Tenant → Users
- Tenant → Products
- Tenant → Recipes
- Tenant → Menus
- Recipe → RecipeIngredients
- Recipe → RecipeSubRecipes

### Many-to-Many
- Recipe → MenuItems

### Cascade Delete
- Tenant → Todos sus datos aislados
- User → Sessions asociadas
- Recipe → Ingredientes asociados

## Alérgenos Base (UE 1169/2011)

### Tabla `allergens` (catálogo global)

Catálogo **global** (no por tenant) gestionado por CRUD en `/api/v1/allergens`.
Los 14 alérgenos oficiales se siembran con `id` = código UE (1-14), de modo que
el `Int[] allergens` de `products`, `recipes` y `menus` y el enum `AllergenEU`
siguen resolviendo sin migración de datos. Los alérgenos creados por el usuario
toman `id = max(id)+1` (≥15). Fuente autoritativa de la siembra:
`prisma/seed.ts` + `ALLERGENS_INFO` (`src/modules/allergens/dto/allergens.dto.ts`).

Campos: `id` (PK, código UE), `name`, `nameEu1169`, `description`, `icon`,
`color`, `severity`, `isActive`, `createdAt`, `updatedAt`.

**14 Alérgenos Oficiales:**
1. Cereales con gluten
2. Crustáceos y moluscos
3. Huevos
4. Pescados
5. Cacahuetes
6. Soja
7. Leche y productos lácteos
8. Apio
9. Mostazos
10. Granos de mostaza
11. Sésamo
12. Sulfitos y sulfitos
13. Altramuces
14. Lupinio

## Reglas de Negocio en Database

### Multi-unidad
- **UC (Unidad de Compra)**: Cómo se compra al proveedor
- **UA (Unidad de Almacenamiento)**: Cómo se controla en almacén
- **UR (Unidad de Receta)**: Cómo se usa en la cocina

### Costeo
- **Precio Neto**: Precio del producto limpio/aprovechable
- **Precio Bruto**: Precio de compra (incluye desperdicio)
- **Costo Receta**: Suma de ingredientes netos

### Mermas
- **Waste %**: Porcentaje que se pierde en proceso
- **Yield Factor**: (1 - wastePercentage) para cálculo

### Trazabilidad Alérgenos
- **Declaración en Productos**: Alérgenos base
- **Propagación Automática**: A recetas → menús → cartas
- **Alertas**: Conflictos cuando alérgeno nuevo añadido

## Optimizaciones

### Índices
- `tenantId` en todas las tablas multi-tenant
- `email` en users (por tenant)
- `name` en products, recipes
- `slug` en tenants
- Índices compuestos para queries frecuentes

### Queries Optimizadas
- Filtros por tenant obligatorios (WHERE tenantId = ?)
- Include para relaciones con eager loading
- Pagination para listas largas
- Selección de campos específicos para evitar over-fetching

### Migrations
- Versionadas con Prisma Migrate
- Reversibles para rollbacks seguros
- Datos por defecto para tenants iniciales
- Seed data para alérgenos base UE