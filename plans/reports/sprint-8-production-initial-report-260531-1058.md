# Sprint 8: Control de Producción - Reporte Inicial

## Estado del Proyecto
- **Fecha:** 2026-05-31
- **Estado:** Iniciando Sprint 8
- **Git:** Rama develop actualizada (commit 1bbb680)
- **GitHub:** https://github.com/nemesiovillena/ChefChek
- **Sprint Anterior:** ✅ Sprint 7 COMPLETADO (APPCC y Control Sanitario)
- **Sprint Actual:** 🚀 Sprint 8 INICIANDO (Control de Producción)

## Objetivos Sprint 8
**Meta:** Sistema de partidas de trabajo y mise en place organizado por zonas de cocina

### Backend (NestJS) - PENDIENTE
- [ ] Modelo de partidas de trabajo
- [ ] Órdenes de producción
- [ ] Organización por zonas de cocina
- [ ] Hojas guía de mise en place
- [ ] Sistema de asignación de tareas
- [ ] Seguimiento de progreso

### Frontend - PENDIENTE
- [ ] Dashboard de producción
- [ ] Gestión de partidas de trabajo
- [ ] Vista por zonas de cocina
- [ ] Hojas de mise en place
- [ ] Asignación de tareas
- [ ] Seguimiento de progreso

### Documentación - PENDIENTE
- [ ] `docs/production-control-system.md`
- [ ] `docs/work-batch-architecture.md`
- [ ] `docs/mise-en-place-management.md`

## Sistema de Control de Producción

### Conceptos Principales

```
Control de Producción
├── Partidas de Trabajo (Work Batches)
│   ├── Identificador único
│   ├── Fecha y hora programada
│   ├── Estado de ejecución
│   └── Responsable asignado
├── Órdenes de Producción
│   ├── Receta a producir
│   ├── Cantidad a producir
│   ├── Ingredientes necesarios
│   └── Tiempos estimados
├── Organización por Zonas
│   ├── Zona de cocinado
│   ├── Zona de preparación
│   ├── Zona de emplatado
│   └── Zona de servicio
├── Mise en Place
│   ├── Lista de preparaciones
│   ├── Cantidad requerida
│   ├── Estado de preparación
│   └── Verificación de calidad
├── Asignación de Tareas
│   ├── Personal disponible
│   ├── Habilidades requeridas
│   ├── Carga de trabajo
│   └── Distribución equitativa
└── Seguimiento de Progreso
    ├── Porcentaje completado
    ├── Tiempo transcurrido
    ├── Tiempo restante estimado
    └── Alertas de retraso
```

### Partidas de Trabajo (Work Batches)

```typescript
interface WorkBatch {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  scheduledDate: Date;
  scheduledTime: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  responsible: string[];
  kitchenZone: string;
  productionOrders: ProductionOrder[];
  createdAt: Date;
  createdBy: string;
  startedAt?: Date;
  completedAt?: Date;
}

interface ProductionOrder {
  id: string;
  batchId: string;
  recipeId: string;
  recipeName: string;
  quantity: number;
  unit: string;
  ingredients: ProductionIngredient[];
  estimatedTime: number; // en minutos
  actualTime?: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  miseEnPlaceItems: MiseEnPlaceItem[];
  createdAt: Date;
}

interface ProductionIngredient {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  isAvailable: boolean;
  reserved: boolean;
}

interface MiseEnPlaceItem {
  id: string;
  orderId: string;
  description: string;
  quantity: number;
  unit: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'VERIFIED';
  notes?: string;
  completedAt?: Date;
  verifiedBy?: string;
}
```

### Organización por Zonas de Cocina

```typescript
enum KitchenZone {
  HOT_KITCHEN = 'HOT_KITCHEN',           // Cocinado caliente
  COLD_KITCHEN = 'COLD_KITCHEN',         // Preparación fría
  PASTRY_KITCHEN = 'PASTRY_KITCHEN',     // Pastelería
  GRILL_STATION = 'GRILL_STATION',       // Parrilla
  FRYING_STATION = 'FRYING_STATION',     // Freidora
  PLATING_STATION = 'PLATING_STATION',   // Emplatado
  SERVICE_STATION = 'SERVICE_STATION',   // Servicio
}

interface KitchenZoneConfig {
  zone: KitchenZone;
  name: string;
  capacity: number;                      // Número de estaciones
  equipment: string[];
  responsible: string[];
  activeBatches: number;
  status: 'AVAILABLE' | 'BUSY' | 'MAINTENANCE';
}
```

### Hojas Guía de Mise en Place

```typescript
interface MiseEnPlaceSheet {
  id: string;
  batchId: string;
  orderId: string;
  zone: KitchenZone;
  items: MiseEnPlaceItem[];
  checklists: MiseEnPlaceChecklist[];
  qualityChecks: QualityCheck[];
  printedAt?: Date;
  completedAt?: Date;
  verifiedBy?: string;
}

interface MiseEnPlaceChecklist {
  id: string;
  sheetId: string;
  item: string;
  description: string;
  category: 'EQUIPMENT' | 'INGREDIENTS' | 'TOOLS' | 'SANITATION';
  checked: boolean;
  checkedBy?: string;
  checkedAt?: Date;
  notes?: string;
}

interface QualityCheck {
  id: string;
  sheetId: string;
  parameter: string;
  expectedValue: string;
  actualValue: string;
  isCompliant: boolean;
  checkedBy: string;
  checkedAt: Date;
  photos?: string[];
}
```

### Sistema de Asignación de Tareas

```typescript
interface TaskAssignment {
  id: string;
  batchId: string;
  orderId: string;
  taskId: string;
  assignedTo: string;
  taskType: 'PREPARATION' | 'COOKING' | 'PLATING' | 'QUALITY_CHECK';
  estimatedTime: number;
  actualTime?: number;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';
  assignedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  dependencies: string[];
}

interface StaffMember {
  id: string;
  tenantId: string;
  name: string;
  role: string;
  skills: string[];
  currentTasks: number;
  maxTasks: number;
  availability: boolean;
}
```

### Seguimiento de Progreso

```typescript
interface ProgressTracking {
  batchId: string;
  orderId: string;
  overallProgress: number;               // Porcentaje 0-100
  timeElapsed: number;                  // Minutos transcurridos
  timeRemaining: number;                // Minutos restantes estimados
  milestones: Milestone[];
  alerts: ProductionAlert[];
  status: 'ON_SCHEDULE' | 'DELAYED' | 'AHEAD' | 'CRITICAL';
}

interface Milestone {
  id: string;
  orderId: string;
  name: string;
  scheduledTime: Date;
  actualTime?: Date;
  status: 'PENDING' | 'ACHIEVED' | 'DELAYED' | 'SKIPPED';
}

interface ProductionAlert {
  id: string;
  orderId: string;
  type: 'DELAY' | 'QUALITY' | 'STAFFING' | 'EQUIPMENT' | 'INGREDIENTS';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}
```

## Flujo de Trabajo de Producción

### 1. Creación de Partida de Trabajo

```
1. Seleccionar fecha y hora de producción
2. Asignar responsable y zona de cocina
3. Definir prioridad de la partida
4. Agregar órdenes de producción
5. Calcular ingredientes necesarios
6. Verificar disponibilidad
7. Reservar ingredientes
8. Programar partida
```

### 2. Preparación Mise en Place

```
1. Generar hoja de mise en place
2. Distribuir checklist por categorías
3. Preparar equipos y herramientas
4. Organizar ingredientes por estación
5. Verificar cantidades y calidad
6. Marcar items como listos
7. Verificar por responsable
```

### 3. Ejecución de Producción

```
1. Asignar tareas a personal
2. Iniciar orden de producción
3. Registrar inicio de tareas
4. Monitorear progreso
5. Verificar checkpoints de calidad
6. Manejar alertas e incidentes
7. Registrar tiempos reales
```

### 4. Finalización

```
1. Verificar cumplimiento de calidad
2. Completar checkpoints
3. Cerrar orden de producción
4. Registrar tiempos finales
5. Actualizar inventario
6. Generar reporte de producción
7. Liberar recursos
```

## Funcionalidades Principales

### Dashboard de Producción

- Vista general de partidas activas
- Calendario de producciones programadas
- Estado por zona de cocina
- Métricas clave en tiempo real
- Alertas y notificaciones

### Gestión de Partidas

- Creación de nuevas partidas
- Edición de partidas existentes
- Asignación de responsables
- Gestión de prioridades
- Reprogramación de partidas

### Vista por Zonas

- Visualización de estaciones
- Asignación de tareas por zona
- Capacidad de cada zona
- Estado de equipos por zona
- Disponibilidad de personal

### Hojas de Mise en Place

- Generación automática
- Impresión de checklists
- Verificación paso a paso
- Controles de calidad
- Firma de verificación

### Asignación de Tareas

- Vista de personal disponible
- Asignación basada en habilidades
- Balanceo de carga de trabajo
- Gestión de dependencias
- Reasignación dinámica

### Seguimiento de Progreso

- Indicadores visuales de progreso
- Tiempos estimados vs reales
- Hitos y checkpoints
- Alertas de retraso
- Reportes de producción

## API Endpoints Propuestos

### Partidas de Trabajo
- `POST /api/v1/production/batches` - Crear partida
- `GET /api/v1/production/batches` - Listar partidas
- `GET /api/v1/production/batches/:batchId` - Obtener partida
- `PUT /api/v1/production/batches/:batchId` - Actualizar partida
- `DELETE /api/v1/production/batches/:batchId` - Eliminar partida
- `POST /api/v1/production/batches/:batchId/start` - Iniciar partida
- `POST /api/v1/production/batches/:batchId/complete` - Completar partida

### Órdenes de Producción
- `POST /api/v1/production/orders` - Crear orden
- `GET /api/v1/production/orders` - Listar órdenes
- `GET /api/v1/production/orders/:orderId` - Obtener orden
- `PUT /api/v1/production/orders/:orderId` - Actualizar orden
- `DELETE /api/v1/production/orders/:orderId` - Eliminar orden

### Mise en Place
- `POST /api/v1/production/mise-en-place` - Crear hoja
- `GET /api/v1/production/mise-en-place/:sheetId` - Obtener hoja
- `PUT /api/v1/production/mise-en-place/:sheetId/items/:itemId` - Actualizar item
- `POST /api/v1/production/mise-en-place/:sheetId/verify` - Verificar hoja
- `GET /api/v1/production/mise-en-place/:sheetId/print` - Imprimir hoja

### Asignación de Tareas
- `POST /api/v1/production/assignments` - Asignar tarea
- `GET /api/v1/production/assignments` - Listar asignaciones
- `PUT /api/v1/production/assignments/:assignmentId` - Actualizar asignación
- `GET /api/v1/production/staff` - Listar personal disponible
- `GET /api/v1/production/staff/:staffId/tasks` - Tareas de personal

### Seguimiento de Progreso
- `GET /api/v1/production/progress/:orderId` - Obtener progreso
- `GET /api/v1/production/alerts` - Listar alertas
- `PUT /api/v1/production/alerts/:alertId/resolve` - Resolver alerta
- `GET /api/v1/production/reports/:batchId` - Reporte de producción

## Rutas de Checking
`/Users/nemesioj/Documents/Trabajos offline/ChefChek/chefchek/plans/reports/`

---
**Estado:** 🚀 Iniciando implementación Sprint 8