import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";

// Definición de permisos granulares
export const PERMISSIONS = {
  // Productos
  products: {
    create: "products:create",
    read: "products:read",
    update: "products:update",
    delete: "products:delete",
    view: "products:view",
  },
  // Recetas
  recipes: {
    create: "recipes:create",
    read: "recipes:read",
    update: "recipes:update",
    delete: "recipes:delete",
    view: "recipes:view",
  },
  // Menús
  menus: {
    create: "menus:create",
    read: "menus:read",
    update: "menus:update",
    delete: "menus:delete",
    publish: "menus:publish",
    view: "menus:view",
  },
  // Almacenes
  warehouses: {
    create: "warehouses:create",
    read: "warehouses:read",
    update: "warehouses:update",
    delete: "warehouses:delete",
    view: "warehouses:view",
  },
  // Producción
  production: {
    create: "production:create",
    read: "production:read",
    update: "production:update",
    delete: "production:delete",
    view: "production:view",
    approve: "production:approve",
  },
  // Pedidos
  orders: {
    create: "orders:create",
    read: "orders:read",
    update: "orders:update",
    delete: "orders:delete",
    view: "orders:view",
    fulfill: "orders:fulfill",
  },
  // Usuarios
  users: {
    create: "users:create",
    read: "users:read",
    update: "users:update",
    delete: "users:delete",
    view: "users:view",
    manage_roles: "users:manage_roles",
  },
  // Dashboard
  dashboard: {
    view: "dashboard:view",
    manage_alerts: "dashboard:manage_alerts",
    export_reports: "dashboard:export_reports",
  },
  // Configuración
  settings: {
    read: "settings:read",
    update: "settings:update",
    manage_categories: "settings:manage_categories",
    manage_suppliers: "settings:manage_suppliers",
  },
} as const;

// Mapeo de roles a permisos
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [
    PERMISSIONS.products.create,
    PERMISSIONS.products.read,
    PERMISSIONS.products.update,
    PERMISSIONS.products.delete,
    PERMISSIONS.recipes.create,
    PERMISSIONS.recipes.read,
    PERMISSIONS.recipes.update,
    PERMISSIONS.recipes.delete,
    PERMISSIONS.menus.create,
    PERMISSIONS.menus.read,
    PERMISSIONS.menus.update,
    PERMISSIONS.menus.delete,
    PERMISSIONS.menus.publish,
    PERMISSIONS.menus.view,
    PERMISSIONS.warehouses.create,
    PERMISSIONS.warehouses.read,
    PERMISSIONS.warehouses.update,
    PERMISSIONS.warehouses.delete,
    PERMISSIONS.warehouses.view,
    PERMISSIONS.production.create,
    PERMISSIONS.production.read,
    PERMISSIONS.production.update,
    PERMISSIONS.production.delete,
    PERMISSIONS.production.view,
    PERMISSIONS.production.approve,
    PERMISSIONS.orders.create,
    PERMISSIONS.orders.read,
    PERMISSIONS.orders.update,
    PERMISSIONS.orders.delete,
    PERMISSIONS.orders.view,
    PERMISSIONS.orders.fulfill,
    PERMISSIONS.users.create,
    PERMISSIONS.users.read,
    PERMISSIONS.users.update,
    PERMISSIONS.users.delete,
    PERMISSIONS.users.view,
    PERMISSIONS.users.manage_roles,
    PERMISSIONS.dashboard.view,
    PERMISSIONS.dashboard.manage_alerts,
    PERMISSIONS.dashboard.export_reports,
    PERMISSIONS.settings.read,
    PERMISSIONS.settings.update,
    PERMISSIONS.settings.manage_categories,
    PERMISSIONS.settings.manage_suppliers,
  ],
  USER: [
    PERMISSIONS.products.read,
    PERMISSIONS.recipes.read,
    PERMISSIONS.recipes.update,
    PERMISSIONS.menus.read,
    PERMISSIONS.menus.view,
    PERMISSIONS.warehouses.read,
    PERMISSIONS.warehouses.view,
    PERMISSIONS.production.view,
    PERMISSIONS.orders.create,
    PERMISSIONS.orders.read,
    PERMISSIONS.orders.update,
    PERMISSIONS.dashboard.view,
  ],
  VIEWER: [
    PERMISSIONS.products.read,
    PERMISSIONS.recipes.read,
    PERMISSIONS.menus.read,
    PERMISSIONS.menus.view,
    PERMISSIONS.warehouses.read,
    PERMISSIONS.warehouses.view,
    PERMISSIONS.production.view,
    PERMISSIONS.orders.read,
    PERMISSIONS.dashboard.view,
  ],
};

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getRolePermissions(role: string): Promise<string[]> {
    return ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || [];
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      return false;
    }

    const rolePermissions = await this.getRolePermissions(user.role);
    return rolePermissions.includes(permission);
  }

  async hasAnyPermission(
    userId: string,
    permissions: string[],
  ): Promise<boolean> {
    for (const permission of permissions) {
      if (await this.hasPermission(userId, permission)) {
        return true;
      }
    }
    return false;
  }

  async hasAllPermissions(
    userId: string,
    permissions: string[],
  ): Promise<boolean> {
    for (const permission of permissions) {
      if (!(await this.hasPermission(userId, permission))) {
        return false;
      }
    }
    return true;
  }

  async checkEndpointPermission(
    userId: string,
    endpoint: string,
    method: string,
  ): Promise<{ hasAccess: boolean; reason?: string }> {
    // Convertir endpoint + method a permission
    const permission = this.endpointToPermission(endpoint, method);

    return {
      hasAccess: await this.hasPermission(userId, permission),
    };
  }

  private endpointToPermission(endpoint: string, method: string): string {
    // Mapeo simple de endpoints a permisos
    const parts = endpoint.split("/");
    const api = parts[0];
    const v1 = parts[1];
    const module = parts[2];
    const action = parts[3];

    if (action === "create" && method === "POST") {
      return `${module}:create`;
    }
    if (["read", "get", "view", "list"].includes(action) && method === "GET") {
      return `${module}:read`;
    }
    if (["update", "edit", "modify"].includes(action) && method === "PUT") {
      return `${module}:update`;
    }
    if (["delete", "remove"].includes(action) && method === "DELETE") {
      return `${module}:delete`;
    }

    return `${module}:read`;
  }

  async getAllPermissions(): Promise<{
    [resource: string]: { [action: string]: string };
  }> {
    const result: any = {};
    for (const [resource, actions] of Object.entries(PERMISSIONS)) {
      result[resource] = actions;
    }
    return result;
  }

  async getPermissionsByRole(role: string): Promise<{
    [resource: string]: string[];
  }> {
    const rolePermissions = await this.getRolePermissions(role);
    const result: any = {};

    for (const permission of rolePermissions) {
      const [resource, action] = permission.split(":");
      if (!result[resource]) {
        result[resource] = [];
      }
      result[resource].push(action);
    }

    return result;
  }
}
