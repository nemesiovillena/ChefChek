import {
  Injectable,
  Logger,
  BadRequestException,
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

    await this.prisma.albaran.update({
      where: { id: albaranId },
      data: { status: newStatus },
    });

    this.logger.log(`Albarán ${albaranId}: ${albaran.status} → ${newStatus}`);

    // Process stock on CONFIRMADO transition
    if (newStatus === AlbaranStatus.CONFIRMADO) {
      await this.stockService.processStockOnConfirmation(albaranId, tenantId);
      // No-op si el albarán no tiene purchaseOrderId vinculado: el flujo de
      // albarán sin pedido queda intacto.
      await this.orderReconciliationService.reconcileFromAlbaran(
        albaranId,
        tenantId,
      );
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
      // All confirmed lines must have a matched product
      const unmatched = lines.filter(
        (l) => l.lineStatus === LineStatus.CONFIRMADO && !l.matchedProductId,
      );
      if (unmatched.length > 0) {
        throw new BadRequestException(
          `No se puede confirmar: ${unmatched.length} línea(s) confirmada(s) sin producto asignado`,
        );
      }
    }
  }
}
