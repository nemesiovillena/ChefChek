import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
// Note: PrismaService path resolves relative to dist/ after compilation
import { AlbaranStatus, LineMatchStatus, LineStatus } from "@prisma/client";
import { AlbaranStockService } from "./albaran-stock.service";
import { OrderReconciliationService } from "../../compras/services/order-reconciliation.service";

/** Valid status transitions and their preconditions */
const VALID_TRANSITIONS: Record<AlbaranStatus, AlbaranStatus[]> = {
  PENDIENTE: [AlbaranStatus.REVISADO],
  REVISADO: [AlbaranStatus.CONFIRMADO],
  CONFIRMADO: [AlbaranStatus.ARCHIVADO],
  ARCHIVADO: [],
};

@Injectable()
export class AlbaranStatusService {
  private readonly logger = new Logger(AlbaranStatusService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AlbaranStockService))
    private readonly stockService: AlbaranStockService,
    private readonly orderReconciliationService: OrderReconciliationService,
  ) {}

  /** Transition albaran to a new status with validation */
  async transitionStatus(
    albaranId: string,
    tenantId: string,
    newStatus: AlbaranStatus,
  ): Promise<void> {
    const albaran = await this.prisma.albaran.findFirst({
      where: { id: albaranId, tenantId },
      include: { lines: true },
    });

    if (!albaran) {
      throw new NotFoundException("Albarán no encontrado");
    }

    // Idempotente: pedir el estado en el que el albarán ya está no es un error.
    // Pasa con doble clic, con una red que cae DESPUÉS de aplicarse el cambio
    // (el reintento del usuario llegaba a un 400 "CONFIRMADO → CONFIRMADO") o
    // con una pestaña/dispositivo con datos viejos. No se reprocesa stock.
    if (albaran.status === newStatus) {
      this.logger.log(
        `Albarán ${albaranId}: ya está en ${newStatus}, petición ignorada`,
      );
      return;
    }

    // Check transition is valid
    const allowed = VALID_TRANSITIONS[albaran.status];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Transición no válida: ${albaran.status} → ${newStatus}. ` +
          `Permitidas: ${allowed.join(", ") || "ninguna"}`,
      );
    }

    // Validate preconditions per transition
    await this.validateTransition(albaran.status, newStatus, albaran.lines);

    // Compare-and-swap sobre el estado leído: si dos peticiones concurrentes
    // pasan la validación, solo una gana el cambio y la otra no asienta stock
    // por duplicado.
    const claimed = await this.prisma.albaran.updateMany({
      where: { id: albaranId, tenantId, status: albaran.status },
      data: { status: newStatus },
    });
    if (claimed.count === 0) {
      throw new ConflictException(
        "El albarán cambió de estado mientras se procesaba. Recarga e inténtalo de nuevo.",
      );
    }

    this.logger.log(`Albarán ${albaranId}: ${albaran.status} → ${newStatus}`);

    // Process stock on CONFIRMADO transition
    if (newStatus === AlbaranStatus.CONFIRMADO) {
      try {
        await this.stockService.processStockOnConfirmation(albaranId, tenantId);
        // No-op si el albarán no tiene purchaseOrderId vinculado: el flujo de
        // albarán sin pedido queda intacto.
        await this.orderReconciliationService.reconcileFromAlbaran(
          albaranId,
          tenantId,
        );
      } catch (err) {
        // El estado ya está escrito pero el stock/conciliación falló: devolver
        // el albarán a su estado previo para no dejarlo CONFIRMADO sin stock
        // (sin CTA para reintentar). El asiento de stock es idempotente, así
        // que reintentar tras un fallo parcial no duplica movimientos.
        await this.prisma.albaran
          .updateMany({
            where: { id: albaranId, tenantId, status: newStatus },
            data: { status: albaran.status },
          })
          .catch((rollbackErr) =>
            this.logger.error(
              `Albarán ${albaranId}: no se pudo revertir a ${albaran.status} tras fallo al confirmar`,
              rollbackErr instanceof Error ? rollbackErr.stack : undefined,
            ),
          );
        throw err;
      }
    }
  }

  private async validateTransition(
    from: AlbaranStatus,
    to: AlbaranStatus,
    lines: any[],
  ): Promise<void> {
    if (to === AlbaranStatus.REVISADO) {
      // All lines must be confirmed or rejected
      const pending = lines.filter(
        (l) => l.lineStatus === LineStatus.PENDIENTE,
      );
      if (pending.length > 0) {
        throw new BadRequestException(
          `No se puede revisar: ${pending.length} línea(s) pendiente(s) de confirmar/rechazar`,
        );
      }
    }

    if (to === AlbaranStatus.CONFIRMADO) {
      const confirmedLines = lines.filter(
        (l) => l.lineStatus === LineStatus.CONFIRMADO,
      );

      // All confirmed lines must have a matched product
      const unmatched = confirmedLines.filter((l) => !l.matchedProductId);
      if (unmatched.length > 0) {
        throw new BadRequestException(
          `No se puede confirmar: ${unmatched.length} línea(s) confirmada(s) sin producto asignado`,
        );
      }
    }
  }
}
