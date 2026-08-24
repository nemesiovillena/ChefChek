import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { PurchaseOrderService } from "./purchase-order.service";
import {
  CreatePurchaseListDto,
  GenerateOrderDto,
  UpdatePurchaseListDto,
} from "../dto/purchase-list.dto";

const LIST_INCLUDE = {
  supplier: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
  items: {
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

/** Stock agregado de un producto (suma de todos sus almacenes). */
interface AggregatedStock {
  quantity: number;
  minimum: number;
  maximum: number | null;
  reorder: number;
  hasRows: boolean;
}

@Injectable()
export class PurchaseListService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly purchaseOrderService: PurchaseOrderService,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.purchaseList.findMany({
      where: { tenantId },
      include: LIST_INCLUDE,
      orderBy: { name: "asc" },
    });
  }

  async findOne(tenantId: string, id: string) {
    const list = await this.prisma.purchaseList.findFirst({
      where: { id, tenantId },
      include: LIST_INCLUDE,
    });
    if (!list) {
      throw new NotFoundException("Lista de compra no encontrada");
    }
    return list;
  }

  async create(tenantId: string, dto: CreatePurchaseListDto) {
    await this.assertSupplierOwned(tenantId, dto.supplierId);
    return this.prisma.purchaseList.create({
      data: {
        tenantId,
        name: dto.name,
        supplierId: dto.supplierId,
        locationId: dto.locationId,
        notes: dto.notes,
        additionalItems: dto.additionalItems,
        items: {
          create: (dto.items ?? []).map((item, index) => ({
            productId: item.productId,
            defaultQuantity: item.defaultQuantity ?? 1,
            sortOrder: index,
          })),
        },
      },
      include: LIST_INCLUDE,
    });
  }

  /** `items` reemplaza el conjunto completo del checklist. */
  async update(tenantId: string, id: string, dto: UpdatePurchaseListDto) {
    await this.findOne(tenantId, id);
    return this.prisma.purchaseList.update({
      where: { id },
      data: {
        name: dto.name,
        locationId: dto.locationId,
        notes: dto.notes,
        additionalItems: dto.additionalItems,
        ...(dto.items
          ? {
              items: {
                deleteMany: {},
                create: dto.items.map((item, index) => ({
                  productId: item.productId,
                  defaultQuantity: item.defaultQuantity ?? 1,
                  sortOrder: index,
                })),
              },
            }
          : {}),
      },
      include: LIST_INCLUDE,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.purchaseList.delete({ where: { id } });
  }

  /**
   * Genera un pedido BORRADOR desde la lista. Si el body trae `items`
   * (selección del checklist con cantidades) se usan tal cual; si no, entra
   * toda la lista con cantidades sugeridas según stock mín/máx.
   */
  async generateOrder(
    tenantId: string,
    listId: string,
    userId: string | undefined,
    dto: GenerateOrderDto,
  ) {
    const list = await this.findOne(tenantId, listId);

    let lines: { productId: string; quantity: number }[];
    if (dto.items && dto.items.length > 0) {
      lines = dto.items;
    } else {
      const stockByProduct = await this.aggregateStocks(
        tenantId,
        list.items.map((i) => i.productId),
      );
      lines = list.items.map((item) => ({
        productId: item.productId,
        quantity: PurchaseListService.suggestQuantity(
          stockByProduct.get(item.productId),
          item.defaultQuantity,
        ),
      }));
    }

    // Solo las notas libres de la lista: la instrucción fija al proveedor
    // (Ajustes → Compras) no se congela en el pedido, se añade en vivo al
    // generar el PDF/mensaje (purchase-order-pdf.service, order-sending
    // service), así que editarla en Ajustes actualiza también los pedidos
    // ya generados.
    const order = await this.purchaseOrderService.create(
      tenantId,
      userId,
      {
        supplierId: list.supplierId,
        locationId: dto.locationId ?? list.locationId ?? undefined,
        notes: list.notes?.trim() || undefined,
        additionalItems: list.additionalItems?.trim() || undefined,
        lines,
      },
      list.id,
    );

    // notes/additionalItems son instrucciones puntuales para ESTE pedido, ya
    // transferidas arriba: se limpian de la lista reutilizable para que no
    // reaparezcan en el próximo pedido generado desde el mismo checklist.
    if (list.notes || list.additionalItems) {
      await this.prisma.purchaseList.update({
        where: { id: list.id },
        data: { notes: null, additionalItems: null },
      });
    }

    return order;
  }

  /**
   * Cantidad sugerida: si el stock agregado está por debajo del umbral
   * (reorderLevel si existe, si no minimumStock), reponer hasta maximumStock
   * (o hasta el umbral si no hay máximo). Sin datos de stock o sin necesidad
   * → cantidad por defecto del checklist.
   */
  static suggestQuantity(
    stock: AggregatedStock | undefined,
    defaultQuantity: number,
  ): number {
    if (!stock || !stock.hasRows) {
      return defaultQuantity;
    }

    const threshold = stock.reorder > 0 ? stock.reorder : stock.minimum;
    if (threshold <= 0 || stock.quantity >= threshold) {
      return defaultQuantity;
    }

    const target = stock.maximum ?? threshold;
    const suggested = target - stock.quantity;
    return suggested > 0 ? suggested : defaultQuantity;
  }

  private async aggregateStocks(
    tenantId: string,
    productIds: string[],
  ): Promise<Map<string, AggregatedStock>> {
    const rows = await this.prisma.stock.findMany({
      where: { tenantId, productId: { in: productIds } },
      select: {
        productId: true,
        quantity: true,
        minimumStock: true,
        maximumStock: true,
        reorderLevel: true,
      },
    });

    const byProduct = new Map<string, AggregatedStock>();
    for (const row of rows) {
      const acc = byProduct.get(row.productId) ?? {
        quantity: 0,
        minimum: 0,
        maximum: null as number | null,
        reorder: 0,
        hasRows: false,
      };
      acc.quantity += row.quantity;
      acc.minimum += row.minimumStock;
      // maximumStock es nullable: solo suma si algún almacén lo define
      if (row.maximumStock !== null) {
        acc.maximum = (acc.maximum ?? 0) + row.maximumStock;
      }
      acc.reorder += row.reorderLevel;
      acc.hasRows = true;
      byProduct.set(row.productId, acc);
    }
    return byProduct;
  }

  private async assertSupplierOwned(tenantId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });
    if (!supplier) {
      throw new NotFoundException("Proveedor no encontrado");
    }
  }
}
