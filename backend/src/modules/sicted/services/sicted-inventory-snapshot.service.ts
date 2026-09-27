import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { CreateInventorySnapshotDto } from "../dto/sicted-inventory-snapshot.dto";

interface InventorySnapshotLine {
  productId: string;
  productName: string;
  quantity: number;
  minimumStock: number;
  maximumStock: number | null;
  belowMinimum: boolean;
  aboveMaximum: boolean;
}

/**
 * Sello de inventario semestral (PROV.7) — **foto+firma** de `Stock` en un
 * instante, no un formulario de líneas manual: lee `Stock`/`Product` en el
 * momento de generar y congela el resultado en `snapshotData` (append-only,
 * el trigger `forbid_mutation` bloquea UPDATE/DELETE). No se recalcula
 * después aunque `Stock` cambie — es evidencia histórica.
 */
@Injectable()
export class SictedInventorySnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.sictedInventorySnapshot.findMany({
      where: { tenantId },
      orderBy: { performedAt: "desc" },
      // snapshotData puede ser grande (una línea por artículo); el listado
      // no la necesita, solo el detalle.
      select: {
        id: true,
        tenantId: true,
        performedAt: true,
        performedByName: true,
        scope: true,
        itemCount: true,
        belowMinimumCount: true,
        aboveMaximumCount: true,
        notes: true,
        createdAt: true,
      },
    });
  }

  async getOne(tenantId: string, id: string) {
    return this.prisma.sictedInventorySnapshot.findFirst({
      where: { id, tenantId },
    });
  }

  async generate(tenantId: string, dto: CreateInventorySnapshotDto) {
    const stocks = await this.prisma.stock.findMany({
      where: { tenantId, product: { deletedAt: null } },
      include: { product: { select: { id: true, name: true } } },
    });

    const lines: InventorySnapshotLine[] = stocks.map((stock) => {
      const belowMinimum = stock.quantity < stock.minimumStock;
      const aboveMaximum =
        stock.maximumStock !== null && stock.quantity > stock.maximumStock;
      return {
        productId: stock.productId,
        productName: stock.product.name,
        quantity: stock.quantity,
        minimumStock: stock.minimumStock,
        maximumStock: stock.maximumStock,
        belowMinimum,
        aboveMaximum,
      };
    });

    const belowMinimumCount = lines.filter((l) => l.belowMinimum).length;
    const aboveMaximumCount = lines.filter((l) => l.aboveMaximum).length;

    return this.prisma.sictedInventorySnapshot.create({
      data: {
        tenantId,
        performedByName: dto.performedByName,
        scope: dto.scope,
        itemCount: lines.length,
        belowMinimumCount,
        aboveMaximumCount,
        snapshotData: lines as unknown as object,
        notes: dto.notes,
      },
    });
  }
}
