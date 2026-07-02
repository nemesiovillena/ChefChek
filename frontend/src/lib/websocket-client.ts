import { io, Socket } from 'socket.io-client';

// Minimal auth context shape required by the WebSocket client.
// Avoids importing the full AuthContextType (which carries React-bound
// methods) so this module stays decoupled from the auth provider.
export interface WebSocketAuthContext {
  sessionId: string | null;
  user: { tenantId: string | null } | null;
}

// Event types (sync with backend)
export interface ServerToClientEvents {
  // Order events
  orderCreated: (order: OrderEvent) => void;
  orderUpdated: (order: OrderEvent) => void;
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

export interface ClientToServerEvents {
  joinTenant: (tenantId: string) => void;
  joinKitchen: () => void;
  joinDashboard: () => void;
  leaveRoom: (room: string) => void;
}

// Event Data Types (sync with backend)
export interface OrderEvent {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SENT' | 'RECEIVED' | 'COMPLETED';
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
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  assignedTo?: string;
  assignedToName?: string;
  estimatedMinutes: number;
  tenantId: string;
}

export interface ProductionTaskEvent {
  taskId: string;
  orderId: string;
  recipeName: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  completedAt: Date;
  completedBy: string;
  completedByName: string;
  tenantId: string;
}

export interface ProductionAlertEvent {
  id: string;
  type: 'DELAY' | 'QUALITY' | 'RESOURCE';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
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
  severity: 'LOW' | 'CRITICAL';
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
  changeType: 'IN' | 'OUT' | 'ADJUSTMENT';
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
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
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
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  actionUrl?: string;
  read?: boolean;
  timestamp: Date;
  createdAt: Date;
  expiresAt?: Date;
  tenantId: string;
}

export class WebSocketClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(private authContext: WebSocketAuthContext) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const token = this.authContext.sessionId;

      if (!token) {
        reject(new Error('No session token available'));
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || apiUrl.replace(/\/api\/?$/, '');
      this.socket = io(`${backendBaseUrl}/api/v1/ws`, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      this.socket.on('connect', () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;

        // Auto-join tenant room
        const tenantId = this.authContext.user?.tenantId;
        if (tenantId) {
          this.socket?.emit('joinTenant', tenantId);
        }

        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        this.reconnectAttempts++;

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error('Max reconnection attempts reached'));
        }
      });

      this.socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
      });

      this.socket.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Room management
  joinKitchen(): void {
    this.socket?.emit('joinKitchen');
  }

  joinDashboard(): void {
    this.socket?.emit('joinDashboard');
  }

  leaveRoom(room: string): void {
    this.socket?.emit('leaveRoom', room);
  }

  // Event listeners
  onOrderCreated(callback: (order: OrderEvent) => void): void {
    this.socket?.on('orderCreated', callback);
  }

  onOrderUpdated(callback: (order: OrderEvent) => void): void {
    this.socket?.on('orderUpdated', callback);
  }

  onOrderApproved(callback: (order: OrderEvent) => void): void {
    this.socket?.on('orderApproved', callback);
  }

  onOrderRejected(callback: (order: OrderEvent) => void): void {
    this.socket?.on('orderRejected', callback);
  }

  onProductionOrderCreated(callback: (productionOrder: ProductionEvent) => void): void {
    this.socket?.on('productionOrderCreated', callback);
  }

  onProductionOrderUpdated(callback: (productionOrder: ProductionEvent) => void): void {
    this.socket?.on('productionOrderUpdated', callback);
  }

  onProductionTaskCompleted(callback: (task: ProductionTaskEvent) => void): void {
    this.socket?.on('productionTaskCompleted', callback);
  }

  onProductionAlert(callback: (alert: ProductionAlertEvent) => void): void {
    this.socket?.on('productionAlert', callback);
  }

  onStockLow(callback: (alert: StockAlertEvent) => void): void {
    this.socket?.on('stockLow', callback);
  }

  onStockCritical(callback: (alert: StockAlertEvent) => void): void {
    this.socket?.on('stockCritical', callback);
  }

  onStockUpdated(callback: (stock: StockEvent) => void): void {
    this.socket?.on('stockUpdated', callback);
  }

  onQRScan(callback: (scan: QRScanEvent) => void): void {
    this.socket?.on('qrScan', callback);
  }

  onMenuUpdated(callback: (menu: MenuEvent) => void): void {
    this.socket?.on('menuUpdated', callback);
  }

  onMenuPublished(callback: (menu: MenuEvent) => void): void {
    this.socket?.on('menuPublished', callback);
  }

  onNotification(callback: (notification: NotificationEvent) => void): void {
    this.socket?.on('notification', callback);
  }

  onError(callback: (error: { message: string; code?: string }) => void): void {
    this.socket?.on('error', callback);
  }

  // Remove specific listener
  off(event: keyof ServerToClientEvents, callback?: (...args: unknown[]) => void): void {
    this.socket?.off(event, callback);
  }

  // Remove all listeners
  removeAllListeners(): void {
    if (this.socket) {
      this.socket.offAny();
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// Singleton instance
let wsClient: WebSocketClient | null = null;

export function getWebSocketClient(authContext: WebSocketAuthContext): WebSocketClient {
  if (!wsClient) {
    wsClient = new WebSocketClient(authContext);
  }
  return wsClient;
}

export function resetWebSocketClient(): void {
  if (wsClient) {
    wsClient.disconnect();
    wsClient = null;
  }
}