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

    // «Mercancía recibida»: el pedido vinculado queda recibido ya, sin
    // esperar a la confirmación de oficina.
    if (newStatus === AlbaranStatus.REVISADO && albaran.purchaseOrderId) {
      await this.markOrderReceived(
        tenantId,
        albaran.purchaseOrderId,
        albaran.internalNumber,
      );
    }

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

  /**
   * Mantiene el pedido al día cuando cambia el vínculo de un albarán aún sin
   * confirmar: vincularlo con la mercancía ya recibida marca el pedido nuevo,
   * y quitarlo (desvincular o borrar el albarán) reabre el anterior si solo
   * estaba recibido por este albarán.
   */
  async syncOrderLink(
    tenantId: string,
    albaran: { status: AlbaranStatus; internalNumber: string },
    previousOrderId: string | null,
    nextOrderId: string | null,
  ): Promise<void> {
    if (previousOrderId === nextOrderId) {
      return;
    }
    if (previousOrderId) {
      await this.orderReconciliationService
        .reopenIfReceivedOnlyOnArrival(tenantId, previousOrderId)
        .catch((err) =>
          this.logger.error(
            `Pedido ${previousOrderId}: no se pudo reabrir tras quitar el albarán`,
            err instanceof Error ? err.stack : undefined,
          ),
        );
    }
    if (nextOrderId && albaran.status === AlbaranStatus.REVISADO) {
      await this.markOrderReceived(
        tenantId,
        nextOrderId,
        albaran.internalNumber,
      );
    }
  }

  /**
   * Pedido al que vincular solo un albarán de ese proveedor: el único enviado
   * y pendiente de recibir cerca de la fecha del albarán. Con varios (o
   * ninguno) devuelve null y el vínculo se elige a mano.
   */
  async findSingleOpenOrder(
    tenantId: string,
    supplierId: string,
    albaranDate: Date,
  ): Promise<string | null> {
    try {
      const orders = await this.orderReconciliationService.suggestOrders(
        tenantId,
        supplierId,
        albaranDate,
      );
      return orders.length === 1 ? orders[0].id : null;
    } catch (err) {
      this.logger.error(
        `No se pudo buscar el pedido del proveedor ${supplierId}`,
        err instanceof Error ? err.stack : undefined,
      );
      return null;
    }
  }

  /** Un fallo del pedido no debe impedir marcar la mercancía como recibida. */
  private async markOrderReceived(
    tenantId: string,
    orderId: string,
    albaranLabel: string,
  ) {
    await this.orderReconciliationService
      .markReceivedOnArrival(tenantId, orderId, albaranLabel)
      .catch((err) =>
        this.logger.error(
          `Pedido ${orderId}: no se pudo marcar recibido (albarán ${albaranLabel})`,
          err instanceof Error ? err.stack : undefined,
        ),
      );
  }

  private async validateTransition(
    from: AlbaranStatus,
    to: AlbaranStatus,
    lines: any[],
  ): Promise<void> {
    // REVISADO = mercancía recibida: no exige haber revisado las líneas.

    if (to === AlbaranStatus.CONFIRMADO) {
      // Las líneas pendientes no entrarían en stock: hay que confirmarlas o
      // rechazarlas antes.
      const pending = lines.filter(
        (l) => l.lineStatus === LineStatus.PENDIENTE,
      );
      if (pending.length > 0) {
        throw new BadRequestException(
          `No se puede confirmar: ${pending.length} línea(s) pendiente(s) de confirmar/rechazar`,
        );
      }

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
