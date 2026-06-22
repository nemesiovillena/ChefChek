# Menu Composition System - ChefChek

## Sistema de Composición de Menús

ChefChek implementa un sistema avanzado de composición de menús con secciones dinámicas, recetas anidadas y cálculo automático de costeos y márgenes.

## Arquitectura del Sistema

### Jerarquía de Componentes

```
Menu (Menú Completo)
├── name: string
├── description: string
├── startDate: Date
├── endDate: Date
├── portions: number
├── isActive: boolean
├── sections: MenuSection[]
│   ├── name: string (Primeros, Segundos, Postres...)
│   ├── order: number
│   └── items: MenuItem[]
│       ├── recipeId: string
│       ├── price: number
│       ├── cost: number (calculado)
│       ├── margin: number (calculado)
│       └── isAvailable: boolean
└── translations: MenuTranslation[]
    ├── language: string
    ├── name: string
    ├── description: string
    └── sectionsTranslations: Record<string, string>
```

### Modelo de Base de Datos

```prisma
model Menu {
  id               String           @id @default(cuid())
  tenantId          String
  name              String
  description       String?
  startDate         DateTime?
  endDate           DateTime?
  portions          Int              @default(1)
  totalCost         Float            @default(0)
  totalPrice        Float            @default(0)
  totalMargin       Float            @default(0)
  isActive          Boolean          @default(true)
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  tenant            Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  sections          MenuSection[]
  translations      MenuTranslation[]

  @@index([tenantId])
  @@index([tenantId, isActive])
  @@map("menus")
}

model MenuSection {
  id        String   @id @default(cuid())
  menuId    String
  name      String
  order     Int
  createdAt DateTime @default(now())

  menu      Menu     @relation(fields: [menuId], references: [id], onDelete: Cascade)
  items     MenuItem[]

  @@unique([menuId, order])
  @@index([menuId])
  @@map("menu_sections")
}

model MenuItem {
  id           String   @id @default(cuid())
  sectionId    String
  recipeId     String
  price        Float
  isAvailable  Boolean @default(true)
  createdAt    DateTime @default(now())

  section      MenuSection @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  recipe       Recipe     @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  @@index([sectionId])
  @@index([recipeId])
  @@map("menu_items")
}

model MenuTranslation {
  id                   String   @id @default(cuid())
  menuId               String
  language             String
  name                 String
  description          String?
  sectionsTranslations Json     @default("{}")
  createdAt            DateTime @default(now())

  menu                 Menu     @relation(fields: [menuId], references: [id], onDelete: Cascade)

  @@unique([menuId, language])
  @@index([menuId])
  @@map("menu_translations")
}
```

## Sistema de Composición Dinámica

### 1. Secciones Configurables

```typescript
const sections = [
  {
    name: 'Primeros',
    order: 1,
    items: [
      {
        recipeId: 'recipe-sopa-tomate',
        price: 8.50,
        isAvailable: true,
      },
    ],
  },
  {
    name: 'Segundos',
    order: 2,
    items: [
      {
        recipeId: 'recipe-paella',
        price: 25.00,
        isAvailable: true,
      },
    ],
  },
];
```

### 2. Ordenación Flexible

**Orden Automático:**
```typescript
sections.sort((a, b) => a.order - b.order);
```

**Orden Manual (Drag & Drop):**
```typescript
// Implementación futura con react-beautiful-dnd
const onDrop = (result) => {
  const { source, destination } = result;
  if (!destination) return;

  const newOrder = reorder(
    sections,
    source.index,
    destination.index
  );

  setSections(newOrder);
};
```

## Cálculo de Costeos en Menús

### Fórmulas de Cálculo

```typescript
private calculateMenuCost(sections: MenuSection[], portions: number): MenuCostBreakdown {
  let totalCost = 0;
  let totalPrice = 0;

  for (const section of sections) {
    for (const item of section.items) {
      const recipe = await this.getRecipe(item.recipeId);
      const cost = recipe.totalCost;
      const price = item.price || cost * 1.3; // 30% margen por defecto

      totalCost += cost;
      totalPrice += price;
    }
  }

  const totalMargin = totalPrice - totalCost;
  const averageMarginPercentage = (totalMargin / totalPrice) * 100;
  const costPerPortion = totalCost / portions;
  const pricePerPortion = totalPrice / portions;

  return {
    totalCost,
    totalPrice,
    totalMargin,
    averageMarginPercentage,
    costPerPortion,
    pricePerPortion,
  };
}
```

### Ejemplo de Cálculo

```
Menú: Menú Ejecutivo (20 porciones)

Sección: Primeros
- Sopa de Tomate: €8.50 (Costo: €4.25, Margen: 50%)
- Ensalada César: €9.00 (Costo: €5.40, Margen: 40%)
Total Primeros: €17.50 (Costo: €9.65)

Sección: Segundos
- Paella Valenciana: €25.00 (Costo: €11.50, Margen: 54%)
Total Segundos: €25.00 (Costo: €11.50)

Sección: Postres
- Tarta Queso: €7.00 (Costo: €3.50, Margen: 50%)
Total Postres: €7.00 (Costo: €3.50)

Total Menú: €49.50 (Costo: €24.65, Margen: 50.2%)
Costo/Porción: €1.23
Precio/Porción: €2.48
```

## Sistema Multi-idioma

### Estructura de Traducciones

```typescript
interface MenuTranslation {
  id: string;
  menuId: string;
  language: string; // 'es', 'en', 'fr', 'de', 'it', etc.
  name: string;
  description: string;
  sectionsTranslations: Record<string, string>; // sectionId -> translated name
}
```

### Implementación Frontend

```typescript
const translations = [
  {
    language: 'es',
    name: 'Menú Ejecutivo',
    description: 'Menú completo de 3 tiempos',
    sectionsTranslations: {
      'section-1': 'Primeros',
      'section-2': 'Segundos',
      'section-3': 'Postres',
    },
  },
  {
    language: 'en',
    name: 'Executive Menu',
    description: 'Complete 3-course menu',
    sectionsTranslations: {
      'section-1': 'Starters',
      'section-2': 'Main Courses',
      'section-3': 'Desserts',
    },
  },
];
```

### Cambio de Idioma en Tiempo Real

```typescript
const [currentLanguage, setCurrentLanguage] = useState('es');

const getTranslatedMenu = (menu: Menu, lang: string): Menu => {
  const translation = menu.translations?.find(t => t.language === lang);
  
  if (!translation) return menu;

  return {
    ...menu,
    name: translation.name,
    description: translation.description,
    sections: menu.sections.map(section => ({
      ...section,
      name: translation.sectionsTranslations?.[section.id] || section.name,
    })),
  };
};
```

## Validaciones de Negocio

### 1. Validación de Fechas

```typescript
if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
  throw new BadRequestException('End date must be after start date');
}
```

### 2. Validación de Disponibilidad

```typescript
// Verificar disponibilidad de ingredientes
async validateMenuAvailability(menu: Menu): Promise<boolean> {
  for (const section of menu.sections) {
    for (const item of section.items) {
      const recipe = await this.getRecipe(item.recipeId);
      for (const ingredient of recipe.ingredients) {
        const product = await this.getProduct(ingredient.productId);
        const stock = await this.getProductStock(product.id);
        
        if (stock < ingredient.quantity * menu.portions) {
          return false;
        }
      }
    }
  }
  return true;
}
```

### 3. Validación de Precios

```typescript
if (item.price <= 0) {
  throw new BadRequestException('Price must be greater than 0');
}

const recipe = await this.getRecipe(item.recipeId);
if (item.price < recipe.totalCost) {
  throw new BadRequestException('Price cannot be lower than cost');
}
```

## Performance y Optimización

### 1. Queries Optimizadas

```typescript
const menu = await this.prisma.menu.findUnique({
  where: { id },
  include: {
    sections: {
      include: {
        items: {
          include: {
            recipe: true,
          },
        },
      },
      orderBy: { order: 'asc' },
    },
    translations: true,
  },
});
```

### 2. Cálculo Incremental

```typescript
// Solo recalcular cuando hay cambios
const oldCost = menu.totalCost;
const newCost = await this.calculateMenuCost(sections, portions);

if (Math.abs(oldCost - newCost.totalCost) > 0.01) {
  await this.prisma.menu.update({
    where: { id },
    data: { totalCost: newCost.totalCost },
  });
}
```

### 3. Cache de Menús Populares

```typescript
const menuCache = new Map<string, Menu>();

async getCachedMenu(menuId: string): Promise<Menu> {
  if (menuCache.has(menuId)) {
    return menuCache.get(menuId);
  }

  const menu = await this.findOne(tenantId, menuId);
  menuCache.set(menuId, menu);
  return menu;
}
```

## API Endpoints

### CRUD Completo

```
POST   /api/v1/menus              - Crear menú
GET    /api/v1/menus              - Listar menús
GET    /api/v1/menus/:id           - Obtener menú
PATCH  /api/v1/menus/:id           - Actualizar menú
DELETE /api/v1/menus/:id           - Eliminar menú
GET    /api/v1/menus/:id/calculate - Calcular costos
GET    /api/v1/menus/:id/qr-code    - Generar QR code
```

### Ejemplo de Response

```json
{
  "success": true,
  "data": {
    "id": "menu-abc123",
    "name": "Menú Ejecutivo",
    "description": "Menú completo de 3 tiempos",
    "portions": 20,
    "isActive": true,
    "sections": [
      {
        "id": "section-1",
        "name": "Primeros",
        "order": 1,
        "items": [
          {
            "id": "item-1",
            "recipeId": "recipe-sopa",
            "recipeName": "Sopa de Tomate",
            "price": 8.50,
            "cost": 4.25,
            "margin": 4.25,
            "isAvailable": true,
            "allergens": [1, 3]
          }
        ]
      }
    ],
    "translations": [
      {
        "language": "en",
        "name": "Executive Menu",
        "description": "Complete 3-course menu"
      }
    ],
    "costBreakdown": {
      "totalCost": 24.65,
      "totalPrice": 49.50,
      "totalMargin": 24.85,
      "averageMarginPercentage": 50.2,
      "costPerPortion": 1.23,
      "pricePerPortion": 2.48
    }
  },
  "message": "Menu retrieved successfully"
}
```

## Documentación Relacionada

- [Digital Menu Architecture](./digital-menu-architecture.md) - Arquitectura de cartas digitales
- [Multi-Lingual Menu System](./multi-lingual-menu-system.md) - Sistema multi-idioma
- [Recipe Data Model](./recipe-data-model.md) - Modelo de datos de recetas
- [Cost Calculation Rules](./cost-calculation-rules.md) - Reglas de cálculo de costeos