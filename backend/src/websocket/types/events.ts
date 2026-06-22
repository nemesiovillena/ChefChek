// WebSocket Event Types

export interface AuthenticatedSocket {
  userId: string;
  tenantId: string;
  role: string;
}

// Client → Server Events
export interface ClientToServerEvents {
  joinTenant: (tenantId: string) => void;
  joinKitchen: () => void;
  joinDashboard: () => void;
  leaveRoom: (room: string) => void;
}

// Server → Client Events
export interface ServerToClientEvents {
  // Order events
  orderCreated: (order: OrderEvent) => void;
  orderUpdated: (order: OrderEvent) => void;
  orderDeleted: (orderId: string) => void;
  orderApproved: (order: OrderEvent) => void;
  orderRejected: (order: OrderEvent) => void;

  // Production events
  productionOrderCreated: (productionOrder: ProductionEvent) => void;
  productionOrderUpdated: (productionOrder: ProductionEvent) => void;
  productionTaskCompleted: (task: ProductionTaskEvent) => void;
  productionAlert: (alert: ProductionAlertEvent) => void;

  // Stock events
  stockLow: (alert: StockAlertEvent) => void;
  stockUpdated: (stock: StockEvent) => void;
  stockCritical: (alert: StockAlertEvent) => void;

  // Digital menu events
  qrScan: (scan: QRScanEvent) => void;
  menuUpdated: (menu: MenuEvent) => void;
  menuPublished: (menu: MenuEvent) => void;

  // User events
  userJoined: (user: UserEvent) => void;
  userLeft: (user: UserEvent) => void;
  notification: (notification: NotificationEvent) => void;

  // Error events
  error: (error: { message: string; code?: string }) => void;
}

// Event Data Types
export interface OrderEvent {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  status:
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "SENT"
    | "RECEIVED"
    | "COMPLETED";
  totalAmount: number;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
  }>;
  createdAt: Date;
  tenantId: string;
}

export interface ProductionEvent {
  id: string;
  taskId: string;
  recipeName: string;
  area: string;
  status: "TODO" | "IN_PROGRESS" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  assignedTo?: string;
  assignedToName?: string;
  estimatedMinutes: number;
  tenantId: string;
}

export interface ProductionTaskEvent {
  taskId: string;
  orderId: string;
  recipeName: string;
  status: "IN_PROGRESS" | "COMPLETED";
  completedAt: Date;
  completedBy: string;
  completedByName: string;
  tenantId: string;
}

export interface ProductionAlertEvent {
  id: string;
  type: "DELAY" | "QUALITY" | "RESOURCE";
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  taskId?: string;
  recipeName?: string;
  tenantId: string;
  createdAt: Date;
}

export interface StockAlertEvent {
  id: string;
  productId: string;
  productName: string;
  currentQuantity: number;
  minimumStock: number;
  maximumStock: number | null;
  warehouseName: string;
  severity: "LOW" | "CRITICAL";
  tenantId: string;
  createdAt: Date;
}

export interface StockEvent {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  previousQuantity: number;
  change: number;
  changeType: "IN" | "OUT" | "ADJUSTMENT";
  reason: string;
  tenantId: string;
  updatedAt: Date;
}

export interface QRScanEvent {
  id: string;
  configId: string;
  menuName: string;
  scanCount: number;
  deviceInfo: {
    deviceId: string;
    userAgent: string;
  };
  location?: {
    lat?: number;
    lng?: number;
  };
  scannedAt: Date;
  tenantId: string;
}

export interface MenuEvent {
  id: string;
  name: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  items: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  publishedAt?: Date;
  tenantId: string;
  updatedAt: Date;
}

export interface UserEvent {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
}

export interface NotificationEvent {
  id: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  title: string;
  message: string;
  data?: Record<string, any>;
  actionUrl?: string;
  createdAt: Date;
  expiresAt?: Date;
  tenantId: string;
}
