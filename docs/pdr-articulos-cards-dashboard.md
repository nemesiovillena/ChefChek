# PDR - Cards Dashboard para Artículos

**Fecha**: 2026-06-11
**Estado**: Pendiente de aprobación
**Prioridad**: Alta
**Estimación**: 2-3 días de desarrollo

---

## Contexto

La página de Artículos actualmente muestra una vista de tabla/tarjetas con filtros, búsqueda y funcionalidades básicas. Se requiere añadir un dashboard con 4 cards informativas para mejorar la experiencia de usuario y facilitar el acceso a operaciones frecuentes.

**Estado actual**:
- ✅ Vista de tabla y tarjetas implementada
- ✅ Filtros por categoría, proveedor y stock
- ✅ Búsqueda de artículos
- ✅ Añadir artículo manual
- ✅ Añadir desde albarán (OCR) con upload de imágenes
- ✅ Gestión de proveedores vía combobox
- ✅ Gestión de categorías con separación de contextos

**Localización actual**:
- Frontend: `frontend/src/app/dashboard/articulos/page.tsx`

---

## Objetivos

1. Crear 4 cards informativas en la parte superior de la página Artículos
2. Mostrar métricas clave y acceso rápido a operaciones frecuentes
3. Mantener consistencia con el diseño existente (shadcn/ui, Tailwind CSS)
4. Responsive design para móvil y desktop

---

## Especificación de Cards

### Card 1: Artículos Totales

**Mostrar**:
- Número total de artículos activos
- Botón "Añadir artículo" (redirige a drawer de creación)
- Botón "Añadir desde albarán" (abre drawer de upload OCR)

**Comportamiento**:
- Contador dinámico: se actualiza en tiempo real al añadir/eliminar artículos
- Upload de imágenes desde móvil (cámara) y archivo local
- Integración con drawer `AlbaranUploadDrawer` existente

**Backend requerido**:
- Endpoint existente: `POST /v1/products/albaran/upload`
- Soporte multi-upload para múltiples imágenes de albaranes

**Frontend**:
- Card con número grande prominente
- 2 botones secundarios con iconos
- Color de acento: indigo

---

### Card 2: Proveedores Activos

**Mostrar**:
- Número total de proveedores activos (`isActive: true`)
- Botón "Gestionar proveedores" (abre modal/dialogo de gestión)

**Funcionalidades del modal de gestión**:
1. **Listado de todos los proveedores**:
   - Tabla con: Nombre, Contacto, Email, Teléfono, Estado (activo/inactivo), Precio (badge con tendencia)
   - Badges de tendencia de precio:
     - 🔴 Precio subió desde última compra (flecha ↑)
     - 🟢 Precio bajó desde última compra (flecha ↓)
     - ⚪ Sin cambios (primer proveedor o sin comparación)
2. **Crear nuevo proveedor**:
   - Formulario con todos los campos del modelo Supplier:
     - Nombre (obligatorio)
     - Persona de contacto
     - Email
     - Teléfono
     - Website
     - Tiempo medio de entrega (días)
     - Puntuación de fiabilidad (0-100)
     - Nivel de precios (LOW, MEDIUM, HIGH)
     - Estado preferido (PREFERRED, ALTERNATIVE, EXCLUDED)
     - Métodos de pedido (EMAIL, PHONE, WEB)
     - Estado activo (checkbox)
3. **Editar proveedor existente**:
   - Mismo formulario que creación, pre-rellenado con datos actuales
4. **Eliminar proveedor**:
   - Confirmación de eliminación
   - Validación: no eliminar si tiene productos asociados (opcional: forzar eliminación con warning)
5. **Activar/Desactivar proveedor**:
   - Toggle de estado rápido en la tabla
6. **Ver artículos de un proveedor**:
   - Botón "Ver artículos" que abre una lista de productos del proveedor seleccionado
   - Posible integración con vista filtrada de Artículos

**Backend requerido**:
- Endpoints existentes/por crear:
  - `GET /v1/products/suppliers` (listar proveedores)
  - `POST /v1/products/suppliers` (crear)
  - `PUT /v1/products/suppliers/:id` (actualizar)
  - `DELETE /v1/products/suppliers/:id` (eliminar)
  - `GET /v1/products/suppliers/:id/products` (productos de proveedor)
- Endpoint para tendencia de precios (calcular diferencia de `purchasePrice` entre productos del mismo proveedor)

**Frontend**:
- Card con contador de proveedores activos
- Botón principal de gestión
- Modal con tabs o secciones (Listado, Crear, Editar)
- Badges de tendencia de precio con colores y flechas

---

### Card 3: Categorías

**Mostrar**:
- Número total de categorías activas (context: articles)
- Botón "Gestionar categorías" (abre modal de gestión)

**Funcionalidades del modal de gestión**:
1. **Listado de todas las categorías**:
   - Árbol jerárquico (padre → hijos)
   - Columnas: Nombre, Descripción, Icono, Color, Cantidad de artículos, Estado
   - Solo categorías con `context: "articles"` (filtrado por contexto)
2. **Crear nueva categoría**:
   - Formulario con campos:
     - Nombre (obligatorio)
     - Descripción
     - Slug (generado automáticamente a partir del nombre)
     - Icono (selector de iconos Lucide React o emoji)
     - Color (picker de color)
     - Categoría padre (dropdown de categorías existentes)
     - Orden (número)
     - Estado activo (checkbox)
     - Contexto: "articles" (fijo, no editable)
3. **Editar categoría existente**:
   - Mismo formulario que creación
   - Permitir cambiar categoría padre (con validación de ciclos)
4. **Eliminar categoría**:
   - Confirmación de eliminación
   - Opción "mover artículos a otra categoría" si tiene productos asociados
   - Validación: no eliminar si tiene subcategorías (opcional: forzar con warning)
5. **Reordenar categorías**:
   - Drag & drop o botones de subir/bajar
   - Afecta campo `sortOrder`

**Backend requerido**:
- Endpoints existentes/por crear:
  - `GET /v1/products/categories?context=articles` (listar con jerarquía)
  - `POST /v1/products/categories` (crear)
  - `PUT /v1/products/categories/:id` (actualizar)
  - `DELETE /v1/products/categories/:id` (eliminar)
  - `GET /v1/products/categories/:id/count` (cantidad de artículos)
- Validación de unicidad de slug por tenant + contexto

**Frontend**:
- Card con contador de categorías activas
- Botón principal de gestión
- Modal con vista de árbol jerárquico
- Editor de categorías con preview de icono y color
- Validación de ciclos en jerarquía

---

### Card 4: Alertas de Stock (Propuesta)

**Mostrar**:
- Número de artículos con stock bajo o agotado
- Distribución: 🔴 Agotados, 🟡 Bajo stock
- Botón "Ver alertas" (filtra tabla de artículos por stock bajo/agotado)

**Definición de stock bajo**:
- `quantity <= minimumStock` Y `quantity > 0` = 🟡 Bajo stock
- `quantity <= 0` = 🔴 Agotado

**Funcionalidades**:
- Click en card: aplica filtro de stock bajo/agotado automáticamente
- Tooltip con lista de artículos críticos (top 5 más urgentes)
- Posible integración con sistema de alertas existente

**Backend requerido**:
- Endpoint existente: `GET /v1/products?stockStatus=low` (o similar)
- Contadores: `/v1/products/stock-status/count`

**Frontend**:
- Card con desglose de estados (rojo/amarillo)
- Icono de alerta
- Click filtrado y tooltip informativo

---

## Arquitectura Técnica

### Frontend

**Tecnologías**:
- Next.js 16.2.6 (App Router)
- React 19.2.4
- TypeScript
- Tailwind CSS
- shadcn/ui components (Sheet, Dialog, Tabs, Badge, Button, Input, Select)
- Lucide React icons
- TanStack Query para cache de datos

**Estructura de componentes**:
```
frontend/src/app/dashboard/articulos/
├── page.tsx (modificar: añadir section de cards)
└── components/
    ├── dashboard-cards/
    │   ├── articles-summary-card.tsx
    │   ├── suppliers-summary-card.tsx
    │   ├── categories-summary-card.tsx
    │   └── stock-alerts-card.tsx
    ├── suppliers-management-modal.tsx (nuevo)
    ├── categories-management-modal.tsx (nuevo)
    ├── supplier-price-trend-badge.tsx (nuevo)
    └── category-tree-view.tsx (nuevo)
```

**Estado**:
- Cards reutilizables con props flexibles
- Modals manejados con hooks de shadcn/ui (`useDialog` / `useSheet`)
- Cache de TanStack Query para contadores y listados

**Responsive**:
- Cards: grid de 4 columnas en desktop, 2 en tablet, 1 en móvil
- Modals: full-screen en móvil, centrado en desktop

---

### Backend

**Tecnologías**:
- NestJS
- Prisma ORM
- PostgreSQL
- DTOs con class-validator

**Servicios requeridos**:
- `SuppliersService` (crear endpoints CRUD completos si no existen)
- `CategoriesService` (verificar endpoints existentes para gestión completa)
- `ProductsService` (endpoint de contadores y stock alerts)

**Endpoints a implementar**:

**Suppliers**:
```typescript
// CRUD completo
GET    /v1/products/suppliers
POST   /v1/products/suppliers
GET    /v1/products/suppliers/:id
PUT    /v1/products/suppliers/:id
DELETE /v1/products/suppliers/:id

// Funcionalidades extra
GET    /v1/products/suppliers/:id/products
GET    /v1/products/suppliers/:id/price-trend
GET    /v1/products/suppliers/stats/active-count
```

**Categories**:
```typescript
// Verificar si existen, crear si no
GET    /v1/products/categories?context=articles
POST   /v1/products/categories
GET    /v1/products/categories/:id
PUT    /v1/products/categories/:id
DELETE /v1/products/categories/:id

// Funcionalidades extra
GET    /v1/products/categories/:id/product-count
POST   /v1/products/categories/reorder
```

**Stock Alerts**:
```typescript
GET    /v1/products/stock-status/count
GET    /v1/products?stockStatus=low
GET    /v1/products/stock-alerts/critical
```

**DTOs**:
- `CreateSupplierDto`, `UpdateSupplierDto`
- `CreateCategoryDto`, `UpdateCategoryDto`
- `SupplierPriceTrendDto`
- `StockAlertSummaryDto`

---

## Seguimiento de Precios (Badge de Tendencia)

**Algoritmo para calcular tendencia**:

```typescript
interface PriceTrend {
  status: 'increased' | 'decreased' | 'stable';
  percentage: number;
  lastPrice: number;
  currentPrice: number;
}

function calculatePriceTrend(supplierId: string): PriceTrend {
  // Obtener todos los productos del proveedor
  const products = await prisma.product.findMany({
    where: { supplierId },
    select: { purchasePrice: true, updatedAt: true }
  });

  if (products.length === 0) return { status: 'stable', ... };

  // Calcular precio promedio actual
  const currentAvg = products.reduce((sum, p) => sum + p.purchasePrice, 0) / products.length;

  // Obtener histórico de precios (si existe tabla de precios históricos)
  // Alternativa: usar el último precio registrado en productos
  const historicalData = await getHistoricalPrices(supplierId);

  if (!historicalData) return { status: 'stable', ... };

  const lastAvg = historicalData.averagePrice;

  // Calcular diferencia
  const diff = ((currentAvg - lastAvg) / lastAvg) * 100;

  return {
    status: diff > 0 ? 'increased' : diff < 0 ? 'decreased' : 'stable',
    percentage: Math.abs(diff),
    lastPrice: lastAvg,
    currentPrice: currentAvg
  };
}
```

**Consideración**:
- Si no existe histórico de precios, guardar el primer precio como baseline
- Opción: crear tabla `SupplierPriceHistory` con registros periódicos o al actualizar precios

---

## UX/UI Consideraciones

### Diseño de Cards

**Layout**:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
  <ArticlesSummaryCard />
  <SuppliersSummaryCard />
  <CategoriesSummaryCard />
  <StockAlertsCard />
</div>
```

**Card base**:
- Bordes sutiles (`border border-gray-200`)
- Sombra ligera en hover (`hover:shadow-md transition`)
- Fondo blanco
- Padding consistente

**Badges de tendencia**:
- Rojo (`bg-red-100 text-red-700`) + flecha ↑
- Verde (`bg-green-100 text-green-700`) + flecha ↓
- Gris (`bg-gray-100 text-gray-700`) para sin cambios

### Modals

**Comportamiento**:
- Fondo oscuro con blur (`backdrop-blur-sm`)
- Animación de entrada/ salida suave
- Cerrar con Escape + click fuera
- Título y botón de cerrar visibles

**Validaciones**:
- Validación en tiempo real
- Mensajes de error claros
- Botón de guardar deshabilitado si hay errores

### Responsive

**Móvil**:
- Cards apiladas (1 columna)
- Modals full-screen con botón de atrás
- Touch-friendly (min 44px de altura para elementos interactivos)

**Desktop**:
- Cards en grid de 4 columnas
- Modals centrados con tamaño fijo o max-width
- Hover states para interactividad

---

## Dependencies Check

**Frontend**:
- ✅ shadcn/ui components instalados (Button, Dialog, Sheet, Badge, Tabs)
- ✅ Lucide React icons
- ✅ TanStack Query hooks
- ❓ Verificar: color picker component (puede requerir `react-colorful` o similar)
- ❓ Verificar: drag & drop library para reordenar categorías (opcional)

**Backend**:
- ✅ Prisma ORM
- ✅ DTOs con class-validator
- ❓ Verificar: servicio de Suppliers completo
- ❓ Verificar: servicio de Categories con operaciones CRUD
- ❓ Crear: DTOs para nuevas operaciones

---

## Plan de Implementación

### Fase 1: Preparación (4h)
1. Crear hooks personalizados para datos de cards
2. Verificar endpoints existentes (suppliers, categories, stock alerts)
3. Crear DTOs faltantes en backend
4. Configurar colores y constantes de diseño

### Fase 2: Backend (6-8h)
1. Implementar endpoints CRUD de Suppliers
2. Implementar endpoints de gestión de Categories
3. Implementar endpoint de stock alerts
4. Implementar lógica de tendencia de precios
5. Unit tests para nuevos endpoints

### Fase 3: Frontend - Cards (4-6h)
1. Crear 4 componentes de cards
2. Integrar hooks de datos
3. Responsive layout
4. Animaciones y hover states

### Fase 4: Frontend - Modals (8-10h)
1. Modal de gestión de proveedores (listado, crear, editar, eliminar)
2. Badge de tendencia de precios
3. Modal de gestión de categorías (árbol, crear, editar, eliminar)
4. Validaciones y manejo de errores

### Fase 5: Testing y Polish (4-6h)
1. E2E tests de flujo completo
2. Testing responsive
3. Testing de accesibilidad
4. Corrección de bugs
5. Optimización de performance

**Total estimado**: 26-34 horas (3.5-4.5 días)

---

## Criterios de Aceptación

### Card 1 - Artículos
- [ ] Muestra contador correcto de artículos activos
- [ ] Botón "Añadir artículo" abre drawer de creación
- [ ] Botón "Añadir desde albarán" permite subir imágenes de móvil y archivo
- [ ] Contador se actualiza en tiempo real

### Card 2 - Proveedores
- [ ] Muestra contador correcto de proveedores activos
- [ ] Modal de gestión muestra todos los proveedores
- [ ] Badges de precio funcionan correctamente (rojo↑, verde↓)
- [ ] Crear proveedor funciona con validaciones
- [ ] Editar proveedor pre-rellena datos
- [ ] Eliminar proveedor con confirmación
- [ ] Toggle de activo/inactivo funciona
- [ ] Ver artículos de proveedor filtra la tabla principal
- [ ] Formulario incluye todos los campos del modelo Supplier

### Card 3 - Categorías
- [ ] Muestra contador correcto de categorías activas
- [ ] Modal de gestión muestra árbol jerárquico
- [ ] Solo muestra categorías con context="articles"
- [ ] Crear categoría funciona con jerarquía
- [ ] Editar categoría permite cambiar padre
- [ ] Eliminar categoría valida subcategorías y productos
- [ ] Reordenar categorías funciona
- [ ] Icono y color se muestran correctamente

### Card 4 - Stock Alerts (si se aprueba)
- [ ] Muestra contador de artículos con stock bajo/agotado
- [ ] Desglose correcto de rojo (agotado) y amarillo (bajo)
- [ ] Click en card filtra tabla por stock bajo
- [ ] Tooltip muestra artículos críticos

### General
- [ ] Design consistente con resto de la app
- [ ] Responsive en móvil y desktop
- [ ] No errores de TypeScript
- [ ] Todos los tests pasan
- [ ] Performance aceptable (carga < 2s)
- [ ] Accesibilidad (teclado, screen readers)

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Endpoints de Suppliers incompletos | Media | Medio | Implementar endpoints completos en Fase 2 |
| Histórico de precios no existe | Alta | Alto | Crear tabla `SupplierPriceHistory` o usar lógica alternativa |
| Gestión de jerarquía de categorías compleja | Baja | Medio | Reutilizar lógica existente de `useCategoryTree` |
| Performance en modales con muchos registros | Media | Bajo | Implementar paginación o virtual scrolling |
| Icon picker no disponible | Baja | Bajo | Usar selector de emojis o iconos Lucide predefinidos |

---

## Alternativas para Card 4

Si no se aprueba "Alertas de Stock", otras opciones:

1. **Valor de Inventario Total**
   - Suma de `quantity * purchasePrice` de todos los artículos
   - Útil para control de costes

2. **Artículos Recientes**
   - Últimos 10 artículos añadidos
   - Acceso rápido a productos nuevos

3. **Distribución por Categorías**
   - Gráfico circular con porcentaje de artículos por categoría
   - Visualización rápida de balance

4. **Proveedores Top**
   - Proveedores con más productos
   - Badge con porcentaje de productos

**Recomendación**: Alertas de Stock (más útil para operaciones diarias)

---

## Preguntas Abiertas

1. **Card 4**: ¿Se aprueba "Alertas de Stock" o prefiere otra opción?
2. **Histórico de precios**: ¿Crear tabla `SupplierPriceHistory` o usar lógica alternativa?
3. **Eliminar proveedores**: ¿Permitir eliminación forzada aunque tenga productos asociados?
4. **Icon picker**: ¿Usar emojis, iconos Lucide predefinidos, o instalar librería de color picker?
5. **Reordenar categorías**: ¿Implementar drag & drop o botones simples de subir/bajar?

---

## Referencias

- PDR MindChef Redesign: `docs/pdr-articulos-mindchef-redesign.md`
- Código actual: `frontend/src/app/dashboard/articulos/page.tsx`
- Schema Prisma: `backend/prisma/schema.prisma`
- Documentación shadcn/ui: `https://ui.shadcn.com`
- Icons Lucide: `https://lucide.dev`

---

**Siguiente paso**: Aprobación de PDR por usuario → Fase de implementación