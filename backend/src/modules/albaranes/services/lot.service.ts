import { Injectable } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";

interface CreateLotParams {
  tenantId: string;
  productId: string;
  albaranLineId: string;
  lotNumber: string;
  quantity: number;
  warehouseId?: string | null;
  supplierId?: string | null;
}

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

export interface FindLotsFilters {
  tenantId: string;
  /** Artículos candidatos ya resueltos por el caller (búsqueda directa). */
  productIds?: string[];
  /** Nº de lote a rastrear (búsqueda inversa). */
  lotNumber?: string;
  /** Filtro por nombre de proveedor (parcial, sin distinguir acentos/caja). */
  supplierName?: string;
  /** Rango contra `Albaran.date` (fecha del papel). */
  from?: Date;
  to?: Date;
  /** Tope de filas cuando no hay rango de fechas. */
  limit?: number;
}

export interface LotTraceabilityRow {
  productName: string;
  lotNumber: string;
  supplierName: string | null;
  /** Nº del albarán del proveedor (el que reconoce el usuario). */
  albaranNumber: string | null;
  albaranInternalNumber: string | null;
  albaranDate: string | null;
  quantity: number;
  unit: string | null;
  /** Hoy siempre `null`: el OCR no captura caducidad. Reservado para etiquetas. */
  expiryDate: string | null;
  source: "lot_record" | "raw_line";
}

@Injectable()
export class LotService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea un registro Lot para una línea de recepción con número de lote.
   * No-op (devuelve null) si lotNumber está vacío.
   */
  async createLotFromReception(
    client: PrismaClientOrTx,
    params: CreateLotParams,
  ) {
    if (!params.lotNumber?.trim()) {
      return null;
    }

    return client.lot.create({
      data: {
        tenantId: params.tenantId,
        productId: params.productId,
        albaranLineId: params.albaranLineId,
        lotNumber: params.lotNumber.trim(),
        quantity: params.quantity,
        warehouseId: params.warehouseId || null,
        supplierId: params.supplierId || null,
      },
    });
  }

  /**
   * Consulta de trazabilidad de lotes recibidos. Dos usos:
   *  - búsqueda directa: `productIds` (+ opcional proveedor / periodo) → lotes.
   *  - búsqueda inversa: `lotNumber` → artículo / albarán / proveedor.
   *
   * Devuelve además líneas de albarán con nº de lote en crudo que nunca
   * llegaron a generar un registro `Lot` (gap de captura histórico), marcadas
   * como `source: "raw_line"`.
   */
  /**
   * Tope duro incluso con rango de fechas: los parámetros vienen de un LLM
   * (nombre difuso, `lotNumber` con fallback a `contains`) y el asistente puede
   * llamar a la tool en bucle. Sin cota, `{ lotNumber: "1", periodo: "mes_pasado" }`
   * podría volcar cientos de filas al contexto del modelo en cada turno.
   */
  private static readonly HARD_CAP = 200;

  async findLots(filters: FindLotsFilters): Promise<LotTraceabilityRow[]> {
    const { tenantId, productIds, lotNumber, supplierName, from, to } = filters;
    const hasRange = Boolean(from || to);
    const take = hasRange
      ? LotService.HARD_CAP
      : Math.min(filters.limit ?? 10, LotService.HARD_CAP);

    const dateFilter = hasRange
      ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
      : undefined;
    const supplierNameFilter = supplierName?.trim()
      ? { contains: supplierName.trim(), mode: "insensitive" as const }
      : undefined;

    const lotRecords = await this.findLotRecords({
      tenantId,
      productIds,
      lotNumber,
      supplierNameFilter,
      dateFilter,
      take,
    });

    const rawLines = await this.findRawLotLines({
      tenantId,
      productIds,
      lotNumber,
      supplierNameFilter,
      dateFilter,
      take,
    });

    const rows = [...lotRecords, ...rawLines].sort((a, b) => {
      const da = a.albaranDate ? Date.parse(a.albaranDate) : 0;
      const db = b.albaranDate ? Date.parse(b.albaranDate) : 0;
      return db - da;
    });

    return rows.slice(0, take);
  }

  private async findLotRecords(args: {
    tenantId: string;
    productIds?: string[];
    lotNumber?: string;
    supplierNameFilter?: { contains: string; mode: "insensitive" };
    dateFilter?: { gte?: Date; lte?: Date };
    take?: number;
  }): Promise<LotTraceabilityRow[]> {
    const {
      tenantId,
      productIds,
      lotNumber,
      supplierNameFilter,
      dateFilter,
      take,
    } = args;

    const lotNumberFilter = await this.resolveLotNumberFilter(
      tenantId,
      lotNumber,
    );
    if (lotNumber && !lotNumberFilter) {
      return [];
    }

    const where: Prisma.LotWhereInput = {
      tenantId,
      ...(productIds ? { productId: { in: productIds } } : {}),
      ...(lotNumberFilter ? { lotNumber: lotNumberFilter } : {}),
      ...(supplierNameFilter ? { supplier: { name: supplierNameFilter } } : {}),
      ...(dateFilter ? { albaranLine: { albaran: { date: dateFilter } } } : {}),
    };

    const records = await this.prisma.lot.findMany({
      where,
      include: {
        product: { select: { name: true } },
        supplier: { select: { name: true } },
        albaranLine: {
          select: {
            unit: true,
            albaran: {
              select: { albaranNumber: true, internalNumber: true, date: true },
            },
          },
        },
      },
      orderBy: [
        { albaranLine: { albaran: { date: "desc" } } },
        { receivedAt: "desc" },
      ],
      ...(take ? { take } : {}),
    });

    return records.map((r) => ({
      productName: r.product.name,
      lotNumber: r.lotNumber,
      supplierName: r.supplier?.name ?? null,
      albaranNumber: r.albaranLine?.albaran?.albaranNumber ?? null,
      albaranInternalNumber: r.albaranLine?.albaran?.internalNumber ?? null,
      albaranDate: r.albaranLine?.albaran?.date?.toISOString() ?? null,
      quantity: r.quantity,
      unit: r.albaranLine?.unit ?? null,
      expiryDate: r.expiryDate?.toISOString() ?? null,
      source: "lot_record" as const,
    }));
  }

  private async findRawLotLines(args: {
    tenantId: string;
    productIds?: string[];
    lotNumber?: string;
    supplierNameFilter?: { contains: string; mode: "insensitive" };
    dateFilter?: { gte?: Date; lte?: Date };
    take?: number;
  }): Promise<LotTraceabilityRow[]> {
    const {
      tenantId,
      productIds,
      lotNumber,
      supplierNameFilter,
      dateFilter,
      take,
    } = args;

    const where: Prisma.AlbaranLineWhereInput = {
      lot: { not: null },
      lotRecord: { is: null },
      albaran: {
        tenantId,
        deletedAt: null,
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(supplierNameFilter
          ? { supplier: { name: supplierNameFilter } }
          : {}),
      },
      ...(productIds ? { matchedProductId: { in: productIds } } : {}),
      ...(lotNumber?.trim()
        ? { lot: { contains: lotNumber.trim(), mode: "insensitive" } }
        : {}),
    };

    const lines = await this.prisma.albaranLine.findMany({
      where,
      include: {
        matchedProduct: { select: { name: true } },
        albaran: {
          select: {
            albaranNumber: true,
            internalNumber: true,
            date: true,
            supplier: { select: { name: true } },
          },
        },
      },
      orderBy: { albaran: { date: "desc" } },
      ...(take ? { take } : {}),
    });

    return lines
      .filter((l) => l.lot && l.lot.trim() !== "")
      .map((l) => ({
        productName: l.matchedProduct?.name ?? l.description,
        lotNumber: (l.lot as string).trim(),
        supplierName: l.albaran?.supplier?.name ?? null,
        albaranNumber: l.albaran?.albaranNumber ?? null,
        albaranInternalNumber: l.albaran?.internalNumber ?? null,
        albaranDate: l.albaran?.date?.toISOString() ?? null,
        quantity: l.quantity,
        unit: l.unit ?? null,
        expiryDate: null,
        source: "raw_line" as const,
      }));
  }

  /**
   * Igualdad case-insensitive; si no hay coincidencia exacta, cae a `contains`
   * (los nº de lote reales son cortos y ambiguos: "A1", "1704"…).
   */
  private async resolveLotNumberFilter(
    tenantId: string,
    lotNumber?: string,
  ): Promise<Prisma.StringFilter | undefined> {
    const value = lotNumber?.trim();
    if (!value) {
      return undefined;
    }
    const exact = await this.prisma.lot.count({
      where: { tenantId, lotNumber: { equals: value, mode: "insensitive" } },
    });
    return exact > 0
      ? { equals: value, mode: "insensitive" }
      : { contains: value, mode: "insensitive" };
  }
}
