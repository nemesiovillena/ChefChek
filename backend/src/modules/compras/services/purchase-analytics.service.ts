import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  AnalyticsQueryDto,
  PriceComparisonQueryDto,
} from "../dto/purchase-analytics.dto";

export interface TopSpendRow {
  productId: string;
  productName: string;
  spend: number;
  percent: number;
  cumulativePercent: number;
}

export interface SupplierSpendRow {
  supplierId: string;
  supplierName: string;
  orderCount: number;
  totalAmount: number;
  averageTicket: number;
  averageLeadTimeDays: number | null;
}

export interface DeviationPeriodRow {
  period: string;
  count: number;
  averageDeviationPercent: number;
}

export interface PriceComparisonPoint {
  supplierId: string;
  supplierName: string;
  recordedAt: string;
  price: number;
}

/**
 * Analítica de compras (PDR §F9). Todas las métricas de gasto/proveedor se
 * basan en `PurchaseOrder`/`PurchaseOrderLine` (el dominio central del
 * módulo, con `locationId` propio) — no en `AlbaranLine` directamente, para
 * mantener un único origen de datos y un filtro de local consistente entre
 * endpoints. `deletedAt IS NULL` manual en toda tabla con soft-delete
 * (SQL raw salta el middleware de Prisma).
 */
@Injectable()
export class PurchaseAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildOrderConditions(
    tenantId: string,
    query: AnalyticsQueryDto,
    extra: Prisma.Sql[] = [],
  ): Prisma.Sql {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`po."tenantId" = ${tenantId}`,
      Prisma.sql`po."deletedAt" IS NULL`,
      ...extra,
    ];
    if (query.supplierId) {
      conditions.push(Prisma.sql`po."supplierId" = ${query.supplierId}`);
    }
    if (query.locationId) {
      conditions.push(Prisma.sql`po."locationId" = ${query.locationId}`);
    }
    if (query.dateFrom) {
      conditions.push(
        Prisma.sql`po."createdAt" >= ${new Date(query.dateFrom)}`,
      );
    }
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      conditions.push(Prisma.sql`po."createdAt" <= ${end}`);
    }
    return Prisma.join(conditions, " AND ");
  }

  /** Top artículos por gasto real (líneas ya conciliadas con recepción), con % individual y acumulado. */
  async topSpend(
    tenantId: string,
    query: AnalyticsQueryDto,
  ): Promise<TopSpendRow[]> {
    const where = this.buildOrderConditions(tenantId, query, [
      Prisma.sql`pol."receivedPrice" IS NOT NULL`,
      Prisma.sql`pol."receivedQuantity" IS NOT NULL`,
      Prisma.sql`p."deletedAt" IS NULL`,
    ]);

    const rows = await this.prisma.$queryRaw<
      { productId: string; productName: string; spend: number }[]
    >(
      Prisma.sql`
        SELECT pol."productId" AS "productId", p.name AS "productName",
               SUM(pol."receivedQuantity" * pol."receivedPrice")::float AS spend
        FROM purchase_order_lines pol
        JOIN purchase_orders po ON po.id = pol."orderId"
        JOIN products p ON p.id = pol."productId"
        WHERE ${where}
        GROUP BY pol."productId", p.name
        ORDER BY spend DESC
      `,
    );

    const grandTotal = rows.reduce((sum, r) => sum + r.spend, 0);
    let cumulative = 0;
    return rows.slice(0, 20).map((r) => {
      const percent = grandTotal > 0 ? (r.spend / grandTotal) * 100 : 0;
      cumulative += percent;
      return {
        productId: r.productId,
        productName: r.productName,
        spend: r.spend,
        percent,
        cumulativePercent: cumulative,
      };
    });
  }

  /** Totales, ticket medio y plazo medio de entrega (sentAt → primer albarán vinculado) por proveedor. */
  async bySupplier(
    tenantId: string,
    query: AnalyticsQueryDto,
  ): Promise<SupplierSpendRow[]> {
    const where = this.buildOrderConditions(tenantId, query, [
      Prisma.sql`po.status != 'CANCELADO'`,
      Prisma.sql`s."deletedAt" IS NULL`,
    ]);

    const rows = await this.prisma.$queryRaw<
      {
        supplierId: string;
        supplierName: string;
        orderCount: bigint;
        totalAmount: number;
        averageLeadTimeDays: number | null;
      }[]
    >(Prisma.sql`
      SELECT po."supplierId" AS "supplierId", s.name AS "supplierName",
             COUNT(*)::bigint AS "orderCount",
             SUM(COALESCE(po."receivedTotal", po."expectedTotal"))::float AS "totalAmount",
             AVG(
               CASE WHEN po."sentAt" IS NOT NULL AND first_albaran.date IS NOT NULL
               THEN EXTRACT(EPOCH FROM (first_albaran.date - po."sentAt")) / 86400.0
               END
             )::float AS "averageLeadTimeDays"
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po."supplierId"
      LEFT JOIN LATERAL (
        SELECT MIN(a.date) AS date
        FROM albaranes a
        WHERE a."purchaseOrderId" = po.id AND a."deletedAt" IS NULL
      ) first_albaran ON true
      WHERE ${where}
      GROUP BY po."supplierId", s.name
      ORDER BY "totalAmount" DESC
    `);

    return rows.map((r) => {
      const orderCount = Number(r.orderCount);
      return {
        supplierId: r.supplierId,
        supplierName: r.supplierName,
        orderCount,
        totalAmount: r.totalAmount,
        averageTicket: orderCount > 0 ? r.totalAmount / orderCount : 0,
        averageLeadTimeDays: r.averageLeadTimeDays,
      };
    });
  }

  /**
   * Evolución semanal de desviaciones de precio pactado. El filtro de local
   * solo se aplica a desviaciones originadas en un pedido de Compras (con
   * `purchaseOrderId`): las que vienen de confirmar un albarán sin pedido
   * vinculado no tienen local que filtrar y se excluyen si se pide un local
   * concreto (no se puede atribuir uno sin datos).
   */
  async deviationsOverTime(
    tenantId: string,
    query: AnalyticsQueryDto,
  ): Promise<DeviationPeriodRow[]> {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`pd."tenantId" = ${tenantId}`,
      Prisma.sql`pd."deletedAt" IS NULL`,
    ];
    if (query.supplierId) {
      conditions.push(Prisma.sql`pso."supplierId" = ${query.supplierId}`);
    }
    if (query.locationId) {
      conditions.push(Prisma.sql`po."locationId" = ${query.locationId}`);
    }
    if (query.dateFrom) {
      conditions.push(
        Prisma.sql`pd."createdAt" >= ${new Date(query.dateFrom)}`,
      );
    }
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      conditions.push(Prisma.sql`pd."createdAt" <= ${end}`);
    }
    const where = Prisma.join(conditions, " AND ");

    const rows = await this.prisma.$queryRaw<
      { period: Date; count: bigint; averageDeviationPercent: number }[]
    >(Prisma.sql`
      SELECT date_trunc('week', pd."createdAt") AS period,
             COUNT(*)::bigint AS count,
             AVG(pd."deviationPercent")::float AS "averageDeviationPercent"
      FROM price_deviations pd
      JOIN product_supplier_offers pso ON pso.id = pd."offerId"
      LEFT JOIN purchase_orders po ON po.id = pd."purchaseOrderId"
      WHERE ${where}
      GROUP BY period
      ORDER BY period ASC
    `);

    return rows.map((r) => ({
      period: r.period.toISOString(),
      count: Number(r.count),
      averageDeviationPercent: r.averageDeviationPercent,
    }));
  }

  /** Serie temporal de precios por proveedor para un artículo (para pintar una línea por proveedor). */
  async priceComparison(
    tenantId: string,
    query: PriceComparisonQueryDto,
  ): Promise<PriceComparisonPoint[]> {
    const product = await this.prisma.product.findFirst({
      where: { id: query.productId, tenantId },
    });
    if (!product) {
      throw new NotFoundException("Artículo no encontrado");
    }

    const conditions: Prisma.Sql[] = [
      Prisma.sql`pph."tenantId" = ${tenantId}`,
      Prisma.sql`pph."productId" = ${query.productId}`,
      Prisma.sql`pph."supplierId" IS NOT NULL`,
      Prisma.sql`s."deletedAt" IS NULL`,
    ];
    if (query.supplierId) {
      conditions.push(Prisma.sql`pph."supplierId" = ${query.supplierId}`);
    }
    if (query.dateFrom) {
      conditions.push(
        Prisma.sql`pph."recordedAt" >= ${new Date(query.dateFrom)}`,
      );
    }
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      conditions.push(Prisma.sql`pph."recordedAt" <= ${end}`);
    }
    const where = Prisma.join(conditions, " AND ");

    const rows = await this.prisma.$queryRaw<
      {
        supplierId: string;
        supplierName: string;
        recordedAt: Date;
        price: number;
      }[]
    >(Prisma.sql`
      SELECT pph."supplierId" AS "supplierId", s.name AS "supplierName",
             pph."recordedAt" AS "recordedAt", pph."newPrice"::float AS price
      FROM product_price_histories pph
      JOIN suppliers s ON s.id = pph."supplierId"
      WHERE ${where}
      ORDER BY pph."recordedAt" ASC
    `);

    return rows.map((r) => ({
      supplierId: r.supplierId,
      supplierName: r.supplierName,
      recordedAt: r.recordedAt.toISOString(),
      price: r.price,
    }));
  }
}
