# ChefChek - Guías de Usuario

## Table of Contents
1. [Introducción](#introducción)
2. [Primeros Pasos](#primeros-pasos)
3. [Gestión de Productos](#gestión-de-productos)
4. [Escandallos y Recetas](#escandallos-y-recetas)
5. [Menús y Cartas](#menús-y-cartas)
6. [Almacenes y Stock](#almacenes-y-stock)
7. [Control de Producción](#control-de-producción)
8. [Dashboard y Métricas](#dashboard-y-métricas)
9. [Cartas Digitales QR](#cartas-digitales-qr)
10. [Sistema APPCC y Control Sanitario](#sistema-appcc-y-control-sanitario)
11. [Base de Conocimiento (Wiki)](#base-de-conocimiento-wiki)
12. [Preguntas Frecuentes](#preguntas-frecuentes)

---

## Introducción

ChefChek es una plataforma SaaS multi-tenant para gestión profesional de cocinas, diseñada para restaurantes, hoteles y servicios de restauración.

### Características Principales
- **Escandallos de Costos**: Cálculo preciso de costos con mermas y rendimiento
- **Control de Producción**: Gestión de mise en place y asignación de tareas
- **APPCC**: Sistema de control sanitario completo
- **Gestión de Almacenes**: Stock multi-almacén con movimientos e inventarios
- **Cartas Digitales QR**: Menús interactivos con filtrado de alérgenos (UE 1169/2011)
- **Dashboard Interactivo**: KPIs en tiempo real y alertas

### Roles de Usuario
- **ADMIN**: Acceso completo a todas las funcionalidades
- **USER**: Gestión operativa de productos, recetas, menús
- **VIEWER**: Solo lectura para consultas y visualización

---

## Primeros Pasos

### Registro y Login

1. **Registro de Tenant**: Contacte con ventas para crear su restaurante
2. **Crear Usuario**: Admin registra usuarios con roles específicos
3. **Login**: Use email y contraseña en `/api/v1/auth/login`

### Configuración Inicial

1. **Añadir Proveedores**: Configure sus proveedores de productos
2. **Crear Categorías**: Organice productos por categorías (Carnes, Pescados, Vegetales, etc.)
3. **Configurar Almacenes**: Defina sus zonas de almacenamiento
4. **Importar Productos**: Comience con productos base para sus recetas

---

## Gestión de Productos

### Crear un Producto

**Endpoint**: `POST /api/v1/products`

**Campos Obligatorios**:
- `name`: Nombre del producto (ej. "Filete de Ternera")
- `unit`: Unidad de medida (kg, l, ud)
- `unitPrice`: Precio de compra
- `yield`: Rendimiento (%) - proporción utilizable

**Campos Opcionales**:
- `categoryId`: Categoría del producto
- `supplierId`: Proveedor
- `allergens`: Array de alérgenos
- `wasteRate`: Porcentaje de merma
- `storageCondition`: Conservación (AMBIENT, REFRIGERATED, FROZEN)

**Ejemplo**:
```json
{
  "name": "Tomate",
  "unit": "kg",
  "unitPrice": 2.50,
  "yield": 85,
  "wasteRate": 15,
  "allergens": ["NONE"],
  "categoryId": "cat-vegetales"
}
```

### Cálculo de Costos

ChefChek usa el **Precio Neto** (producto limpio) no el Precio Bruto:

```
Precio Neto = Precio Compra / Rendimiento
Ejemplo: 2.50€/kg ÷ 0.85 = 2.94€/kg neto
```

### Gestión de Alérgenos

Alérgenos disponibles según UE 1169/2011:
- GLUTEN
- CRUSTACEOS
- HUEVOS
- PESCADOS
- CACAHUETES
- SOJA
- LACTEOS
- FRUTOS_CASCARA
- APIO
- MOSTAZA
- SESAMO
- SULFITOS
- MOLUSCOS
- LUPULO
- ALTRAMUZ

---

## Escandallos y Recetas

### Crear una Receta

**Endpoint**: `POST /api/v1/recipes`

**Estructura de Receta**:
```json
{
  "name": "Ensalada César",
  "servings": 4,
  "elaboration": "<tip-tap-json-content>",
  "ingredients": [
    {
      "productId": "prod-123",
      "quantity": 200,
      "unit": "g"
    }
  ],
  "allergens": ["LACTEOS", "HUEVOS"]
}
```

### Costeo Recursivo

ChefChek calcula costos recursivamente:
1. Si el ingrediente es producto base → usa Precio Neto
2. Si el ingrediente es otra receta → calcula su escandallo
3. Agrega todos los costos y divide por raciones

**Ejemplo**: Ensalada con Salsa César
- Lechuga: 1.50€/kg × 0.2kg = 0.30€
- Pan: 2.00€/kg × 0.1kg = 0.20€
- Salsa César (receta): 0.50€ × 0.05kg = 0.025€
- **Total**: 0.525€ / 4 raciones = **0.13€/ración**

### Duplicar Recetas

**Endpoint**: `POST /api/v1/recipes/:id/duplicate`

Útil para crear variaciones sin recalcular desde cero.

### Editor TipTap

El campo `elaboration` usa formato JSON TipTap para contenido enriquecido:
- Texto con formato (negrita, cursiva, lista)
- Bloques de código
- Imágenes
- Links

---

## Menús y Cartas

### Crear un Menú

**Endpoint**: `POST /api/v1/menus`

```json
{
  "name": "Carta Almuerzo",
  "isActive": true,
  "slug": "carta-almuerzo",
  "sections": [
    {
      "name": "Entrantes",
      "order": 1,
      "items": [
        {
          "recipeId": "rec-123",
          "price": 12.50,
          "description": "Ensalada fresca de temporada"
        }
      ]
    }
  ]
}
```

### Cálculo de Costos de Menú

El sistema agrega costos de todas las secciones:
```
Costo Menú = Σ(Costo Item × Precio Venta)
```

### Generar QR para Carta

**Endpoint**: `GET /api/v1/menus/:id/qr-code`

Genera código QR que redirige a vista pública del menú.

---

## Almacenes y Stock

### Crear un Almacén

**Endpoint**: `POST /api/v1/almacenes`

```json
{
  "name": "Cámara Frigorífica",
  "location": "Planta 1",
  "capacity": 1000,
  "conservationZone": "REFRIGERATED"
}
```

### Tipos de Movimientos de Stock

1. **ENTRANCE**: Compras, devoluciones
2. **EXIT**: Producción, merma, venta
3. **ADJUSTMENT**: Ajustes manuales con motivo

### Crear Movimiento

**Endpoint**: `POST /api/v1/almacenes/movimientos`

```json
{
  "productId": "prod-123",
  "warehouseId": "wh-456",
  "type": "ENTRANCE",
  "quantity": 100,
  "unit": "kg",
  "reason": "Compra proveedor Frescos S.L."
}
```

### Inventarios Físicos

1. **Crear Inventario**: `POST /api/v1/almacenes/inventarios`
2. **Agregar Items**: `POST /api/v1/almacenes/inventarios/:id/items`
3. **Completar y Comparar**: `POST /api/v1/almacenes/inventarios/:id/completar`

El sistema genera reporte de diferencias teórico vs real.

### Alertas de Stock Bajo

Configure umbrales de alerta:
- Stock mínimo
- Stock máximo
- Punto de reorden

---

## Control de Producción

### Gestión de Lotes de Trabajo (Work Batches)

**Endpoint**: `POST /api/v1/production/batches`

Organiza producción por fechas/servicios:
```json
{
  "date": "2026-06-15",
  "shift": "DINNER",
  "orders": [
    {
      "recipeId": "rec-123",
      "quantity": 50,
      "unit": "servings"
    }
  ]
}
```

### Mise en Place

**Endpoint**: `POST /api/v1/production/mise-en-place`

Crear hoja de preparación previa:
```json
{
  "name": "Mise en Place Sabado",
  "date": "2026-06-15",
  "items": [
    {
      "productId": "prod-123",
      "targetQuantity": 5,
      "unit": "kg",
      "instructions": "Picar en dados 1cm"
    }
  ]
}
```

Estados de items: `PENDING` → `IN_PROGRESS` → `COMPLETED`

### Asignación de Tareas

**Endpoint**: `POST /api/v1/production/assignments`

Asignar tareas a personal:
```json
{
  "staffId": "staff-789",
  "taskId": "task-123",
  "assignedBy": "user-456",
  "status": "ASSIGNED"
}
```

---

## Dashboard y Métricas

### KPIs Principales

**Endpoint**: `GET /api/v1/dashboard/kpis`

Retorna:
- **Costos Totales**: Suma de todos los gastos
- **Márgenes Financieros**: (Venta - Costo) / Venta × 100
- **Stock Nivel**: % de stock disponible
- **Alertas Activas**: Número de alertas sin resolver

### Tendencias de Costos

**Endpoint**: `GET /api/v1/dashboard/metrics/cost-trend`

Períodos disponibles:
- `DAILY`: Últimos 7 días
- `WEEKLY`: Últimas 4 semanas
- `MONTHLY`: Últimos 6 meses

### Análisis de Márgenes de Menú

**Endpoint**: `GET /api/v1/dashboard/metrics/menu-margin`

Genera alertas si:
- Margen < 30% (Warning)
- Margen < 20% (Critical)

### Gestión de Alertas

**Crear Alerta**: `POST /api/v1/dashboard/alerts`
**Resolver Alerta**: `PUT /api/v1/dashboard/alerts/:id/resolve`

Tipos de alertas:
- `STOCK_LOW`: Stock bajo
- `COST_HIGH`: Costo fuera de rango
- `DELAY_CRITICAL`: Plazo de entrega crítico
- `APCC_INCIDENT`: Incidencia APPCC

---

## Cartas Digitales QR

### Configurar Carta Digital

**Endpoint**: `POST /api/v1/digital-menu/config`

```json
{
  "name": "Carta QR Principal",
  "menuId": "menu-123",
  "branding": {
    "logoUrl": "https://cdn.chefchek.com/logo.png",
    "primaryColor": "#2C3E50",
    "fontFamily": "Roboto"
  },
  "languages": ["es", "en", "fr"],
  "isActive": true
}
```

### Generar QR

**Endpoint**: `POST /api/v1/digital-menu/config/:id/generate-qr`

Opciones:
- `size`: Tamaño del QR (px)
- `errorCorrection`: Nivel de corrección (L, M, Q, H)

### Vista Pública (Sin Auth)

**Endpoint**: `GET /api/v1/digital-menu/public/:configId`

Parámetros de query:
- `lang`: Idioma (es, en, fr, etc.)
- `allergens`: Filtrar por alérgenos (array)

Ejemplo: `/api/v1/digital-menu/public/config-123?lang=es&allergens[]=LACTEOS`

### Filtrado de Alérgenos

Vista pública incluye botones para filtrar por cada alérgeno UE 1169/2011, cumpliendo obligaciones legales.

### Analytics

**Endpoint**: `GET /api/v1/digital-menu/config/:id/analytics`

Métricas:
- Total de scans
- Scans por idioma
- Scans por tipo de dispositivo (mobile, desktop)
- Interacciones por sección

---

## Sistema APPCC y Control Sanitario

APPCC (Análisis de Peligros y Puntos Críticos de Control) es un sistema preventivo de seguridad alimentaria. ChefChek implementa un sistema completo de control sanitario cumpliendo la normativa europea.

### Controles de Temperatura

**Crear un Punto de Control**: `POST /api/v1/appcc/temperature-controls`

```json
{
  "type": "CAMERA",
  "location": "Cámara Frigorífica 1",
  "targetTemperature": 4,
  "tolerance": 2,
  "unit": "CELSIUS",
  "description": "Cámara de refrigerados principales",
  "responsible": "Juan García"
}
```

Tipos de control: `CAMERA` (cámara), `EQUIPMENT` (equipo), `PRODUCT` (producto)

**Registrar Medición**: `POST /api/v1/appcc/temperature-controls/:controlId/record`

```json
{
  "temperature": 5.2,
  "notes": "Dentro del rango aceptable"
}
```

El sistema evalúa automáticamente si la medición está dentro del rango (`targetTemperature ± tolerance`). Si está fuera de rango, se genera una alerta automática.

**Consultar Controles**: `GET /api/v1/appcc/temperature-controls`

**Consultar Mediciones**: `GET /api/v1/appcc/temperature-controls/:controlId/measurements`

### Planes de Limpieza

**Crear Plan de Limpieza**: `POST /api/v1/appcc/cleaning-plans`

```json
{
  "name": "Limpieza Diaria Cocina",
  "frequency": "DAILY",
  "description": "Limpieza completa de superficies y equipos",
  "responsible": ["María López", "Pedro Sánchez"],
  "durationMinutes": 45
}
```

Frecuencias: `DAILY`, `WEEKLY`, `MONTHLY`, `QUARTERLY`

**Agregar Tareas al Plan**: `POST /api/v1/appcc/cleaning-plans/:planId/tasks`

```json
{
  "area": "Cocina Principal",
  "description": "Desinfectar superficies de trabajo",
  "products": ["Lejía diluida", "Desinfectante alimentario"],
  "estimatedTime": 15,
  "responsible": ["María López"]
}
```

**Completar Tarea**: `PUT /api/v1/appcc/cleaning-tasks/:taskId/complete`

```json
{
  "verifiedBy": "admin-user-id",
  "notes": "Completada sin incidencias"
}
```

**Consultar Planes**: `GET /api/v1/appcc/cleaning-plans`

### Control de Plagas

**Registrar Control de Plagas**: `POST /api/v1/appcc/pest-controls`

```json
{
  "company": "ControlPlagas S.L.",
  "type": "RODENTS",
  "date": "2026-06-15",
  "nextDate": "2026-09-15",
  "products": ["Raticida en estaciones", "Trampas pegamento"],
  "affectedAreas": ["Almacén seco", "Zona de carga"],
  "responsible": "Ana Martínez",
  "notes": "Sin incidencias detectadas"
}
```

Tipos: `RATS` (ratas), `INSECTS` (insectos), `RODENTS` (roedores), `BIRDS` (aves)

**Consultar Controles**: `GET /api/v1/appcc/pest-controls`

### Recepción de Mercancías

**Registrar Recepción**: `POST /api/v1/appcc/goods-reception`

```json
{
  "supplierId": "supplier-123",
  "temperatureOnReception": 3.5,
  "acceptableTemperature": 4,
  "lot": "LOT-2026-001",
  "expiryDate": "2026-07-15",
  "deliveryNote": "ALB-789",
  "products": [
    {
      "productId": "prod-456",
      "quantity": 50,
      "unit": "kg",
      "temperature": 3.2
    }
  ],
  "signedBy": "Recepcionista",
  "verifiedBy": "Jefe de Cocina",
  "observations": "Todo en correcto estado"
}
```

El sistema verifica automáticamente si los productos recibidos cumplen con la temperatura aceptable. Los productos fuera de rango se marcan como rechazados.

**Consultar Recepciones**: `GET /api/v1/appcc/goods-reception`

### Gestión de Alertas APPCC

**Crear Alerta**: `POST /api/v1/appcc/alerts`

```json
{
  "severity": "HIGH",
  "type": "TEMPERATURE",
  "title": "Cámara fuera de rango",
  "message": "Cámara 1 registró 8°C, límite superior 6°C",
  "assignees": ["user-admin-id"]
}
```

Severidades: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
Tipos: `TEMPERATURE`, `CLEANING`, `APPCC`, `PEST`

**Actualizar Alerta**: `PUT /api/v1/appcc/alerts/:alertId`

```json
{
  "status": "RESOLVED",
  "resolution": "Termostato recalibrado, temperatura normalizada",
  "resolvedBy": "user-admin-id"
}
```

Estados: `OPEN` → `IN_PROGRESS` → `RESOLVED` → `CLOSED`

**Consultar Alertas**: `GET /api/v1/appcc/alerts?type=TEMPERATURE&severity=HIGH&status=OPEN`

### Informes de Cumplimiento

**Generar Informe**: `POST /api/v1/appcc/compliance-reports`

```json
{
  "period": "MONTHLY",
  "startDate": "2026-05-01",
  "endDate": "2026-05-31",
  "controlTypes": ["TEMPERATURE", "CLEANING"]
}
```

El informe incluye KPIs calculados:
- **Cumplimiento de Temperaturas** (% mediciones dentro de rango)
- **Cumplimiento de Limpieza** (% tareas completadas)
- **Tasa de Aceptación de Mercancías** (% productos aceptados)
- **Tiempo de Respuesta a Alertas** (minutos promedio)
- **Cumplimiento General** (media de los anteriores)

Si algún KPI < 90%, el sistema genera recomendaciones automáticas.

**Historial de Informes**: `GET /api/v1/appcc/compliance-reports/history?days=30`

---

## Base de Conocimiento (Wiki)

El módulo de Conocimiento permite documentar procedimientos operativos, recetas estandarizadas y buenas prácticas del restaurante.

### Crear Artículo

**Endpoint**: `POST /api/v1/conocimiento/articles`

```json
{
  "title": "Procedimiento de Recepción de Mercancías",
  "content": "<tip-tap-json-content>",
  "categoryId": "cat-procedimientos",
  "tags": ["recepción", "APPCC", "mercancías"]
}
```

### Categorías Jerárquicas

Organice artículos en categorías con estructura jerárquica:
- Procedimientos Operativos
  - Recepción de Mercancías
  - Almacenamiento
  - Preparación
- Seguridad Alimentaria
  - APPCC
  - Alergenos
  - Limpieza

### Sistema de Tags

Asigne tags a artículos para búsqueda rápida. Los tags son transversales a categorías.

### Versionado

Cada edición de un artículo crea una nueva versión. Puede consultar el historial de cambios y restaurar versiones anteriores.

### Editor TipTap

El campo `content` usa formato JSON TipTap para contenido enriquecido con formato, listas, imágenes y links.

---

## Preguntas Frecuentes

### ¿Cómo calcula ChefChek el costo de una receta?

ChefChek usa el Precio Neto (producto limpio), no el Precio Bruto:
```
Precio Neto = Precio Compra ÷ Rendimiento
Costo Receta = Σ(Ingrediente Precio Neto × Cantidad Usada)
```

### ¿Qué pasa si una receta usa otra receta como ingrediente?

ChefChek calcula recursivamente: primero calcula el costo de la receta sub-ingrediente, luego lo agrega al costo de la receta principal.

### ¿Cómo funciona el multi-idioma?

ChefChek usa slugs dinámicos por idioma para SEO y almacenamiento en base de datos. Cada entidad (menú, receta) puede tener traducciones en múltiples idiomas.

### ¿Cumple con normativa UE de alérgenos?

Sí, implementamos el Reglamento UE 1169/2011. Los alérgenos se trazan en cascada (productos → recetas → menús) y las cartas digitales permiten filtrado interactivo.

### ¿Puedo tener múltiples almacenes?

Sí, cada tenant puede crear múltiples almacenes con diferentes zonas de conservación (AMBIENT, REFRIGERATED, FROZEN). El stock se gestiona por almacén.

### ¿Cómo exporto datos?

Actualmente los endpoints de exportación (PDF, Excel, CSV) están en desarrollo. Puedes usar la API para descargar datos en formato JSON.

### ¿Qué diferencia hay entre Roles?

- **ADMIN**: Acceso completo, puede crear/eliminar usuarios y configuración
- **USER**: Gestión operativa (productos, recetas, menús, producción)
- **VIEWER**: Solo lectura, ideal para supervisores o directores

### ¿Cómo me aseguro de que mis datos están aislados?

ChefChek es multi-tenant por diseño. Todos los datos están aislados por `tenantId` y cada solicitud pasa por guard de tenant para garantizar el aislamiento.

### ¿Puedo personalizar los colores de mi carta digital?

Sí, al configurar una carta digital puedes definir:
- `primaryColor`: Color principal
- `secondaryColor`: Color secundario
- `fontFamily`: Fuente tipográfica
- `logoUrl`: URL de tu logo

### ¿Qué pasa si el stock es insuficiente para una orden de producción?

El sistema reserva stock al crear orden de producción. Si stock < requerido, devuelve error 400 con detalle de stock disponible vs requerido.

### ¿Cómo registro escaneos de QR para analytics?

Los endpoints públicos de digital-menu registran automáticamente scans cuando los usuarios acceden a las cartas. Puedes ver analytics en `/api/v1/digital-menu/config/:id/analytics`.

---

## Soporte

**Documentación API**: http://localhost:3001/api/docs
**Contacto**: soporte@chefchek.com
**Horario**: L-V 9:00-18:00 CET

---

**Versión**: 0.1.0
**Última Actualización**: 2026-06-02