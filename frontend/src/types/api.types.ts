// API Error Response
export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
  timestamp?: string;
  path?: string;
}

// Paginated Response
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Prisma User Model
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'SUPERADMIN' | 'OWNER' | 'ADMIN' | 'USER' | 'VIEWER';
  tenantId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Prisma Tenant Model
export interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  maxUsers: number;
  createdAt: string;
  updatedAt: string;
}

// Prisma Product Model
export interface Product {
  id: string;
  name: string;
  purchaseFormat: string;
  referenceUnit: string;
  unitsPerFormat: number;
  referenceUnitSize: number;
  unitSize: number;
  purchasePrice: number;
  netPrice: number;
  categoryId?: string;
  supplierId?: string;
  stock?: number;
  allergens: number[];
  images?: string[];
  isActive: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// Prisma Category Model
export interface Category {
  id: string;
  name: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// Prisma Recipe Model
export interface Recipe {
  id: string;
  name: string;
  description?: string;
  portions?: number;
  cost?: number;
  status: 'DRAFT' | 'APPROVED' | 'ARCHIVED';
  categoryId?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// Prisma Order Model
export interface Order {
  id: string;
  table?: string;
  cover?: string;
  orderDate: string;
  estimatedTime?: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// Prisma WorkBatch Model
export interface WorkBatch {
  id: string;
  name: string;
  description?: string;
  plannedDate: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// Prisma ProductionOrder Model
export interface ProductionOrder {
  id: string;
  workBatchId: string;
  orderId: string;
  recipeId: string;
  quantity: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Prisma TaskAssignment Model
export interface TaskAssignment {
  id: string;
  workBatchId: string;
  userId: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: string;
  completedAt?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// Prisma Notification Model
export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// Prisma Alert Model
export interface Alert {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// Prisma Allergen Model
export interface Allergen {
  id: string;
  name: string;
  code?: string;
  icon?: string;
  description?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// Dashboard KPIs
export interface DashboardKPIs {
  activeOrders: number;
  pendingTasks: number;
  stockAlerts: number;
  productionProgress: number;
}

// Production Progress Data
export interface ProductionProgressData {
  date: string;
  completedOrders: number;
  pendingOrders: number;
}

// Stock Movement
export interface StockMovement {
  id: string;
  productId: string;
  warehouseId: string;
  movementType: 'IN' | 'OUT';
  quantity: number;
  reason?: string;
  tenantId: string;
  createdAt: string;
}

// Warehouse
export interface Warehouse {
  id: string;
  name: string;
  location?: string;
  capacity?: number;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// Article (Knowledge Base)
export interface Article {
  id: string;
  title: string;
  content: string;
  categoryId?: string;
  authorId: string;
  tags?: string[];
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// Digital Menu
export interface DigitalMenu {
  id: string;
  name: string;
  description?: string;
  qrCodeUrl: string;
  views: number;
  clicks: number;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}