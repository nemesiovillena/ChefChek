import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";

export enum AuditAction {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
  APPROVE = "APPROVE",
  REJECT = "REJECT",
  EXPORT = "EXPORT",
  VIEW = "VIEW",
}

export enum EntityType {
  USER = "User",
  PRODUCT = "Product",
  RECIPE = "Recipe",
  MENU = "Menu",
  ORDER = "Order",
  STOCK = "Stock",
  WAREHOUSE = "Warehouse",
  CATEGORY = "Category",
  DOCUMENT = "Document",
}

export interface AuditLogOptions {
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async log(userId: string, tenantId: string, options: AuditLogOptions) {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: options.action,
          entityType: options.entityType,
          entityId: options.entityId,
          details: options.details,
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
        },
      });
    } catch (error) {
      // Don't fail the main operation if audit logging fails
      this.logger.error("Audit logging error:", error);
    }
  }

  async getAuditLogs(
    tenantId: string,
    filters?: {
      userId?: string;
      action?: AuditAction;
      entityType?: EntityType;
      entityId?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    const where: any = { tenantId };

    if (filters?.userId) {
      where.userId = filters.userId;
    }
    if (filters?.action) {
      where.action = filters.action;
    }
    if (filters?.entityType) {
      where.entityType = filters.entityType;
    }
    if (filters?.entityId) {
      where.entityId = filters.entityId;
    }
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    return this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100, // Limit to last 100 records
    });
  }

  async getUserActivity(userId: string, tenantId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.prisma.auditLog.findMany({
      where: {
        userId,
        tenantId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getEntityHistory(
    entityType: EntityType,
    entityId: string,
    tenantId: string,
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        entityType,
        entityId,
        tenantId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
