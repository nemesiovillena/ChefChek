import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PurchaseOrderStatus } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { PurchaseOrderNumberService } from "./purchase-order-number.service";
import {
  CreatePurchaseOrderDto,
  PurchaseOrdersQueryDto,
  PurchaseOrderLineInputDto,
  UpdatePurchaseOrderDto,
} from "../dto/purchase-order.dto";

const ORDER_INCLUDE = {
  supplier: { select: { id: true, name: true, orderMethods: true } },
  location: { select: { id: true, name: true } },
  lines: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          referenceUnit: true,
          purchaseFormat: true,
        },
      },
    },
  },
};

@Injectable()
export class PurchaseOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numberService: PurchaseOrderNumberService,
  ) {}

  async findAll(tenantId: string, query: PurchaseOrdersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const where = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.search
        ? {
            orderNumber: {
              contains: query.search,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [orders, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return {
      success: true,
      data: orders,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: {
        ...ORDER_INCLUDE,
        events: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!order) {
      throw new NotFoundException("Pedido no encontrado");
    }
    return order;
  }

  /**
   * Crea un pedido BORRADOR. `sourceListId` distingue en la auditoría los
   * pedidos generados desde una lista (y, en el Sprint 6, por el scheduler).
   */
  async create(
    tenantId: string,
    userId: string | undefined,
    dto: CreatePurchaseOrderDto,
    sourceListId?: string,
  ) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, tenantId },
    });
    if (!supplier) {
      throw new NotFoundException("Proveedor no encontrado");
    }
    if (dto.locationId) {
      await this.assertLocationOwned(tenantId, dto.locationId);
    }

    const lines = await this.buildLines(tenantId, dto.supplierId, dto.lines);
    const expectedTotal = this.computeTotal(lines);
    const orderNumber = await this.numberService.generateOrderNumber(tenantId);

    return this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        orderNumber,
        supplierId: dto.supplierId,
        locationId: dto.locationId,
        notes: dto.notes,
        expectedTotal,
        createdBy: userId,
        lines: { create: lines },
        events: {
          create: {
            type: "CREATED",
            userId,
            payload: sourceListId ? { sourceListId } : undefined,
          },
        },
      },
      include: ORDER_INCLUDE,
    });
  }

  /** Solo los BORRADOR son editables (notas, local y líneas). */
  async update(tenantId: string, id: string, dto: UpdatePurchaseOrderDto) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
    });
    if (!order) {
      throw new NotFoundException("Pedido no encontrado");
    }
    if (order.status !== PurchaseOrderStatus.BORRADOR) {
      throw new BadRequestException(
        "Solo los pedidos en BORRADOR pueden editarse.",
      );
    }
    if (dto.locationId) {
      await this.assertLocationOwned(tenantId, dto.locationId);
    }

    let linesData: Awaited<ReturnType<typeof this.buildLines>> | undefined;
    if (dto.lines) {
      linesData = await this.buildLines(tenantId, order.supplierId, dto.lines);
    }

    // deleteMany+create anidados en un único update → atómico en Prisma
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        notes: dto.notes,
        locationId: dto.locationId,
        ...(linesData
          ? {
              expectedTotal: this.computeTotal(linesData),
              lines: { deleteMany: {}, create: linesData },
            }
          : {}),
      },
      include: ORDER_INCLUDE,
    });
  }

  /** Borrado (soft) solo de BORRADOR y CANCELADO: lo enviado es histórico auditable. */
  async remove(tenantId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
    });
    if (!order) {
      throw new NotFoundException("Pedido no encontrado");
    }
    const deletable: PurchaseOrderStatus[] = [
      PurchaseOrderStatus.BORRADOR,
      PurchaseOrderStatus.CANCELADO,
    ];
    if (!deletable.includes(order.status)) {
      throw new BadRequestException(
        "Solo pueden eliminarse pedidos en BORRADOR o CANCELADO.",
      );
    }
    return this.prisma.purchaseOrder.delete({ where: { id } });
  }

  /**
   * Resuelve el precio unitario esperado de cada línea: oferta del proveedor
   * para el producto (preferida primero) o, si el proveedor es el principal
   * del producto, su purchasePrice. Sin dato → null (se rellena al conciliar).
   */
  private async buildLines(
    tenantId: string,
    supplierId: string,
    inputs: PurchaseOrderLineInputDto[],
  ) {
    const productIds = [...new Set(inputs.map((l) => l.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, tenantId },
      select: {
        id: true,
        supplierId: true,
        purchasePrice: true,
        purchaseFormat: true,
        referenceUnit: true,
        supplierOffers: {
          where: { supplierId },
          orderBy: { isPreferred: "desc" },
          take: 1,
          select: { purchasePrice: true },
        },
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const missing = productIds.filter((pid) => !byId.has(pid));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Artículos no encontrados: ${missing.join(", ")}`,
      );
    }

    return inputs.map((line, index) => {
      const product = byId.get(line.productId)!;
      const offerPrice = product.supplierOffers[0]?.purchasePrice;
      const fallbackPrice =
        product.supplierId === supplierId ? product.purchasePrice : null;
      return {
        productId: line.productId,
        quantity: line.quantity,
        unit: line.unit ?? (product.purchaseFormat || product.referenceUnit),
        expectedPrice: line.expectedPrice ?? offerPrice ?? fallbackPrice,
        lineNotes: line.lineNotes,
        sortOrder: index,
      };
    });
  }

  private computeTotal(
    lines: { quantity: number; expectedPrice: number | null }[],
  ): number {
    return lines.reduce(
      (sum, l) => sum + l.quantity * (l.expectedPrice ?? 0),
      0,
    );
  }

  private async assertLocationOwned(tenantId: string, locationId: string) {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, tenantId },
    });
    if (!location) {
      throw new NotFoundException("Local no encontrado");
    }
  }
}
