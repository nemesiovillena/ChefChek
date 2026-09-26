import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";

/** Umbral de aviso de caducidad por defecto (días); igual que `etiquetado`. */
const DEFAULT_EXPIRY_WARNING_DAYS = 5;
const EXPIRY_WARNING_DAYS_KEY = "ETIQUETADO_EXPIRY_WARNING_DAYS";

export interface ProcurementEvidenceReport {
  from: Date;
  to: Date;
  receptions: { confirmedCount: number; withLotCount: number };
  expiringSoon: { warningDays: number; count: number };
  labelsIssued: { count: number };
  stockAlerts: {
    belowMinimumCount: number;
    aboveMaximumCount: number;
    belowMinimum: {
      productId: string;
      productName: string;
      quantity: number;
      minimumStock: number;
    }[];
    aboveMaximum: {
      productId: string;
      productName: string;
      quantity: number;
      maximumStock: number;
    }[];
  };
}

/**
 * Panel de evidencia de aprovisionamiento (PROV.4/PROV.6/PROV.7/PROV.8):
 * **cero escrituras** en `albaranes`/`etiquetado`/`almacenes`/`proveedores` —
 * solo consulta sus tablas vía Prisma, sin importar sus módulos Nest (mismo
 * patrón de desacoplo que el resto de esta fase). `to` es exclusivo (mismo
 * bug de fase 5 evitado desde el inicio: comparar instantes, no día natural).
 */
@Injectable()
export class SictedProcurementEvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  async evidence(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<ProcurementEvidenceReport> {
    const [receptions, expiringSoon, labelsIssued, stockAlerts] =
      await Promise.all([
        this.receptionsEvidence(tenantId, from, to),
        this.expiringSoonEvidence(tenantId),
        this.labelsIssuedEvidence(tenantId, from, to),
        this.stockAlertsEvidence(tenantId),
      ]);
    return { from, to, receptions, expiringSoon, labelsIssued, stockAlerts };
  }

  /** PROV.4: compras formalizadas — recepciones confirmadas en el periodo, "n de m con lote" (nunca un % que oculte huecos). */
  private async receptionsEvidence(tenantId: string, from: Date, to: Date) {
    const albaranes = await this.prisma.albaran.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: "CONFIRMADO",
        date: { gte: from, lt: to },
      },
      select: {
        id: true,
        lines: { select: { lotRecord: { select: { id: true } } } },
      },
    });
    const confirmedCount = albaranes.length;
    const withLotCount = albaranes.filter((a) =>
      a.lines.some((line) => line.lotRecord),
    ).length;
    return { confirmedCount, withLotCount };
  }

  /** PROV.6/PROV.8: FIFO/caducidad — mismo dato que alimenta `/dashboard/appcc/caducidades` (etiquetas emitidas, no `Lot.expiryDate`, que el OCR no rellena hoy). */
  private async expiringSoonEvidence(tenantId: string) {
    const warningDays = await this.getExpiryWarningDays(tenantId);
    const threshold = new Date(Date.now() + warningDays * 86_400_000);
    const count = await this.prisma.foodLabel.count({
      where: {
        tenantId,
        voidedAt: null,
        OR: [
          { frozenUseByDate: { not: null, lte: threshold } },
          { frozenUseByDate: null, useByDate: { lte: threshold } },
        ],
      },
    });
    return { warningDays, count };
  }

  private async getExpiryWarningDays(tenantId: string): Promise<number> {
    const row = await this.prisma.configuration.findUnique({
      where: { tenantId_key: { tenantId, key: EXPIRY_WARNING_DAYS_KEY } },
    });
    const parsed = row ? Number(row.value) : NaN;
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= 30
      ? parsed
      : DEFAULT_EXPIRY_WARNING_DAYS;
  }

  /** PROV.6: etiquetado interno — etiquetas emitidas en el periodo (incluye anuladas: emitir también es evidencia). */
  private async labelsIssuedEvidence(tenantId: string, from: Date, to: Date) {
    const count = await this.prisma.foodLabel.count({
      where: { tenantId, createdAt: { gte: from, lt: to } },
    });
    return { count };
  }

  /** PROV.7: stock mínimo/máximo — estado actual (no depende del periodo consultado). */
  private async stockAlertsEvidence(tenantId: string) {
    const stocks = await this.prisma.stock.findMany({
      where: { tenantId, product: { deletedAt: null } },
      include: { product: { select: { id: true, name: true } } },
    });
    const belowMinimum = stocks
      .filter((s) => s.quantity < s.minimumStock)
      .map((s) => ({
        productId: s.productId,
        productName: s.product.name,
        quantity: s.quantity,
        minimumStock: s.minimumStock,
      }));
    const aboveMaximum = stocks
      .filter((s) => s.maximumStock !== null && s.quantity > s.maximumStock)
      .map((s) => ({
        productId: s.productId,
        productName: s.product.name,
        quantity: s.quantity,
        maximumStock: s.maximumStock as number,
      }));
    return {
      belowMinimumCount: belowMinimum.length,
      aboveMaximumCount: aboveMaximum.length,
      belowMinimum,
      aboveMaximum,
    };
  }
}
