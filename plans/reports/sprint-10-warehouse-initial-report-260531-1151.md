# Sprint 10: Almacenes e Inventarios - Reporte Inicial

## Estado del Proyecto
- **Fecha:** 2026-05-31
- **Estado:** Iniciando Sprint 10
- **Git:** Rama develop actualizada (commit 3da5fa0)
- **GitHub:** https://github.com/nemesiovillena/ChefChek
- **Sprint Anterior:** ✅ Sprint 9 COMPLETADO (Hojas de Pedido Automatizadas)
- **Sprint Actual:** 🚀 Sprint 10 INICIANDO (Almacenes e Inventarios)

## Objetivos Sprint 10
**Meta:** Sistema completo de gestión de almacenes e inventarios

### Backend (NestJS) - PENDIENTE
- [ ] Modelo de almacenes
- [ ] Gestión de entradas (albaranes)
- [ ] Gestión de salidas
- [ ] Inventarios teóricos
- [ ] Inventarios físicos
- [ ] Comparación teórico vs real
- [ ] Sistema de alertas de stock

### Frontend - PENDIENTE
- [ ] Dashboard de almacenes
- [ ] Gestión de albaranes
- [ ] Registro de entradas/salidas
- [ ] Realización de inventarios físicos
- [ ] Comparación de inventarios
- [ ] Alertas de stock

### Documentación - PENDIENTE
- [ ] `docs/warehouse-management-system.md`
- [ ] `docs/inventory-control-architecture.md`
- [ ] `docs/stock-alert-system.md`

## Sistema de Almacenes

### Concepto Principal

El sistema de gestión de almacenes controla el flujo completo de productos: desde la recepción de mercancías hasta el consumo en producción, pasando por inventarios físicos y comparaciones automáticas entre stock teórico y real.

### Flujo del Sistema

```
1. Recepción de Mercancía
   ├── Verificación de albarán
   ├── Inspección de calidad
   ├── Registro de entrada
   └── Actualización de stock

2. Almacenamiento
   ├── Asignación a zona
   ├── Registro de ubicación
   ├── Control de temperatura
   └── Seguimiento de caducidad

3. Gestión de Salidas
   ├── Petición de material
   ├── Reserva de stock
   ├── Registro de salida
   └── Actualización de inventario

4. Inventarios Físicos
   ├── Planificación de inventario
   ├── Conteo manual o escaneo
   ├── Comparación teórico vs real
   └── Generación de reportes

5. Análisis y Alertas
   ├── Diferencias de inventario
   ├── Stock mínimo alertas
   ├── Productos caducados
   └── Métricas de rotación
```

## Estructura de Datos

### Almacén

```typescript
interface Warehouse {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  type: 'MAIN' | 'KITCHEN' | 'COLD_STORAGE' | 'DRY_STORAGE' | 'SPECIAL';
  location: string;
  capacity: number;
  managerId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  zones: WarehouseZone[];
}
```

### Zona de Almacén

```typescript
interface WarehouseZone {
  id: string;
  warehouseId: string;
  name: string;
  code: string;
  conservationZone: 'FROZEN' | 'REFRIGERATED' | 'DRY_GOODS' | 'AMBIENT' | 'SPECIAL';
  temperature: number;
  humidity: number;
  capacity: number;
  currentUsage: number;
  isActive: boolean;
}
```

### Entrada (Albarán)

```typescript
interface StockEntry {
  id: string;
  tenantId: string;
  warehouseId: string;
  entryNumber: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber?: string;
  receivedDate: Date;
  receivedBy: string;
  status: 'PENDING' | 'RECEIVED' | 'VERIFIED' | 'PROCESSED';
  items: StockEntryItem[];
  subtotal: number;
  taxes: number;
  shippingCost: number;
  total: number;
  notes?: string;
}

interface StockEntryItem {
  id: string;
  entryId: string;
  productId: string;
  productName: string;
  lotNumber?: string;
  expirationDate?: Date;
  receivedQuantity: number;
  verifiedQuantity?: number;
  unit: string;
  unitPrice: number;
  totalCost: number;
  qualityCheck: 'PASS' | 'FAIL' | 'PENDING';
  notes?: string;
}
```

### Salida

```typescript
interface StockExit {
  id: string;
  tenantId: string;
  warehouseId: string;
  exitNumber: string;
  exitType: 'PRODUCTION' | 'TRANSFER' | 'WASTE' | 'RETURN';
  destinationId?: string;
  requestedDate: Date;
  requestedBy: string;
  approvedBy?: string;
  status: 'PENDING' | 'APPROVED' | 'PICKED' | 'PROCESSED';
  items: StockExitItem[];
}

interface StockExitItem {
  id: string;
  exitId: string;
  productId: string;
  productName: string;
  lotNumber?: string;
  requestedQuantity: number;
  pickedQuantity?: number;
  unit: string;
  zoneId: string;
  location?: string;
  notes?: string;
}
```

### Inventario Físico

```typescript
interface PhysicalInventory {
  id: string;
  tenantId: string;
  warehouseId: string;
  inventoryNumber: string;
  inventoryDate: Date;
  inventoryType: 'FULL' | 'PARTIAL' | 'CYCLIC';
  conductedBy: string;
  reviewedBy?: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEWED';
  items: PhysicalInventoryItem[];
  summary: InventorySummary;
}

interface PhysicalInventoryItem {
  id: string;
  inventoryId: string;
  productId: string;
  productName: string;
  theoreticalQuantity: number;
  physicalQuantity: number;
  difference: number;
  unit: string;
  lotNumber?: string;
  location?: string;
  countedBy: string;
  countedAt: Date;
  notes?: string;
}

interface InventorySummary {
  totalItems: number;
  totalValue: number;
  discrepancies: number;
  totalDiscrepancyValue: number;
  accuracyRate: number;
}
```

### Alerta de Stock

```typescript
interface StockAlert {
  id: string;
  tenantId: string;
  productId: string;
  productName: string;
  warehouseId: string;
  alertType: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRING_SOON' | 'EXPIRED' | 'OVERSTOCK';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  currentStock: number;
  minimumStock?: number;
  expirationDate?: Date;
  daysUntilExpiration?: number;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
}
```

## API Endpoints Propuestos

### Gestión de Almacenes
- `GET /api/v1/warehouses` - Listar almacenes (ADMIN/USER/VIEWER)
- `GET /api/v1/warehouses/:id` - Obtener almacén (ADMIN/USER/VIEWER)
- `POST /api/v1/warehouses` - Crear almacén (ADMIN)
- `PUT /api/v1/warehouses/:id` - Actualizar almacén (ADMIN)
- `DELETE /api/v1/warehouses/:id` - Eliminar almacén (ADMIN)

### Gestión de Zonas
- `GET /api/v1/warehouses/:id/zones` - Listar zonas (ADMIN/USER/VIEWER)
- `POST /api/v1/warehouses/:id/zones` - Crear zona (ADMIN)

### Entradas
- `POST /api/v1/warehouses/entries` - Crear entrada (ADMIN/USER)
- `GET /api/v1/warehouses/entries` - Listar entradas (ADMIN/USER/VIEWER)
- `GET /api/v1/warehouses/entries/:id` - Obtener entrada (ADMIN/USER/VIEWER)
- `PUT /api/v1/warehouses/entries/:id/verify` - Verificar entrada (ADMIN/USER)
- `PUT /api/v1/warehouses/entries/:id/process` - Procesar entrada (ADMIN/USER)

### Salidas
- `POST /api/v1/warehouses/exits` - Crear salida (ADMIN/USER)
- `GET /api/v1/warehouses/exits` - Listar salidas (ADMIN/USER/VIEWER)
- `GET /api/v1/warehouses/exits/:id` - Obtener salida (ADMIN/USER/VIEWER)
- `PUT /api/v1/warehouses/exits/:id/approve` - Aprobar salida (ADMIN)
- `PUT /api/v1/warehouses/exits/:id/pick` - Marcar como picked (ADMIN/USER)

### Inventarios Físicos
- `POST /api/v1/warehouses/inventories` - Crear inventario (ADMIN/USER)
- `GET /api/v1/warehouses/inventories` - Listar inventarios (ADMIN/USER/VIEWER)
- `GET /api/v1/warehouses/inventories/:id` - Obtener inventario (ADMIN/USER/VIEWER)
- `PUT /api/v1/warehouses/inventories/:id/items/:itemId/count` - Registrar conteo (ADMIN/USER)
- `PUT /api/v1/warehouses/inventories/:id/complete` - Completar inventario (ADMIN/USER)
- `GET /api/v1/warehouses/inventories/:id/comparison` - Comparación teórico vs real (ADMIN/USER/VIEWER)

### Alertas
- `GET /api/v1/warehouses/alerts` - Listar alertas (ADMIN/USER/VIEWER)
- `PUT /api/v1/warehouses/alerts/:id/acknowledge` - Reconocer alerta (ADMIN/USER)
- `GET /api/v1/warehouses/alerts/unacknowledged` - Alertas no reconocidas (ADMIN/USER/VIEWER)

## Rutas de Checking
`/Users/nemesioj/Documents/Trabajos offline/ChefChek/chefchek/plans/reports/`

---
**Estado:** 🚀 Iniciando implementación Sprint 10