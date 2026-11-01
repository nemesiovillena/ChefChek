import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { RoleAccessService } from "./role-access.service";
import { SECTION_BYPASS_ROLES } from "./constants/section-registry";

/** Listas de compra asignadas a una persona: JSON con los ids de las listas. */
const KEY_PREFIX = "userPurchaseLists.";
const CONFIG_CATEGORY = "ROLE_ACCESS";

/**
 * Lo que puede tocar en Compras quien entra solo con el permiso por persona
 * «compras-pedidos»: sus listas asignadas y los proveedores de esas listas.
 */
export interface PurchaseScope {
  listIds: string[];
  supplierIds: string[];
}

/**
 * Limita Pedidos, Listas y Programaciones a las listas que gerencia asigna a
 * cada persona. Solo afecta a quien no tiene Compras completo: gerencia y
 * quien ve Compras entero siguen viéndolo todo (`resolve` devuelve null).
 *
 * Un pedido no guarda de qué lista sale, así que los pedidos se filtran por
 * proveedor: la persona ve los pedidos de los proveedores de sus listas.
 */
@Injectable()
export class PurchaseListScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roleAccess: RoleAccessService,
  ) {}

  private key(userId: string): string {
    return `${KEY_PREFIX}${userId}`;
  }

  async getAssignedListIds(
    tenantId: string,
    userId: string,
  ): Promise<string[]> {
    const row = await this.prisma.configuration.findUnique({
      where: { tenantId_key: { tenantId, key: this.key(userId) } },
    });
    if (!row) {
      return [];
    }
    try {
      const parsed = JSON.parse(row.value);
      return Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  }

  /** Sustituye las listas asignadas a la persona. Solo listas del tenant. */
  async setAssignedListIds(
    tenantId: string,
    targetUserId: string,
    editorId: string,
    listIds: string[],
  ): Promise<string[]> {
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException("Usuario no encontrado");
    }
    const unique = [...new Set(listIds)];
    const found = await this.prisma.purchaseList.findMany({
      where: { tenantId, id: { in: unique } },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new BadRequestException("Alguna lista de compra no existe");
    }
    const key = this.key(targetUserId);
    const value = JSON.stringify(unique);
    await this.prisma.configuration.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: {
        tenantId,
        key,
        value,
        category: CONFIG_CATEGORY,
        description: `Purchase lists for ${targetUserId}`,
        updatedBy: editorId,
      },
      update: { value, updatedBy: editorId },
    });
    return unique;
  }

  /**
   * Alcance de la persona en Pedidos/Listas/Programaciones, o null si no tiene
   * límite (gerencia o Compras completo). Sin listas asignadas no ve nada.
   */
  async resolve(
    tenantId: string,
    user: { id?: string; role?: string } | undefined,
  ): Promise<PurchaseScope | null> {
    if (!user?.id || !user.role || SECTION_BYPASS_ROLES.includes(user.role)) {
      return null;
    }
    const map = await this.roleAccess.getSectionMapForUserRole(
      tenantId,
      user.role,
      user.id,
    );
    if (!map || map["compras"]) {
      return null;
    }
    const assigned = await this.getAssignedListIds(tenantId, user.id);
    const lists = assigned.length
      ? await this.prisma.purchaseList.findMany({
          where: { tenantId, id: { in: assigned } },
          select: { id: true, supplierId: true },
        })
      : [];
    return {
      listIds: lists.map((l) => l.id),
      supplierIds: [...new Set(lists.map((l) => l.supplierId))],
    };
  }

  hasList(scope: PurchaseScope | null, listId: string): boolean {
    return !scope || scope.listIds.includes(listId);
  }

  hasSupplier(scope: PurchaseScope | null, supplierId: string): boolean {
    return !scope || scope.supplierIds.includes(supplierId);
  }

  /** Lo que no está en su alcance no existe para la persona (404). */
  assertList(scope: PurchaseScope | null, listId: string): void {
    if (!this.hasList(scope, listId)) {
      throw new NotFoundException("Lista de compra no encontrada");
    }
  }

  async assertOrder(
    tenantId: string,
    scope: PurchaseScope | null,
    orderId: string,
  ): Promise<void> {
    if (!scope) {
      return;
    }
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id: orderId, tenantId },
      select: { supplierId: true },
    });
    if (!order || !scope.supplierIds.includes(order.supplierId)) {
      throw new NotFoundException("Pedido no encontrado");
    }
  }

  async assertSchedule(
    tenantId: string,
    scope: PurchaseScope | null,
    scheduleId: string,
  ): Promise<void> {
    if (!scope) {
      return;
    }
    const schedule = await this.prisma.purchaseSchedule.findFirst({
      where: { id: scheduleId, tenantId },
      select: { listId: true },
    });
    if (!schedule || !scope.listIds.includes(schedule.listId)) {
      throw new NotFoundException("Programación no encontrada");
    }
  }

  /** Acciones reservadas a quien tiene Compras completo. */
  assertUnrestricted(scope: PurchaseScope | null, message: string): void {
    if (scope) {
      throw new ForbiddenException(message);
    }
  }
}
