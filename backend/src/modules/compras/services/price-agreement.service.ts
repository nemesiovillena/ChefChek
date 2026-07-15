import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProductSupplierOffer } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { NotificationsService } from "../../core/notifications.service";
import {
  PriceDeviationsQueryDto,
  UpdatePriceDeviationDto,
} from "../dto/price-deviation.dto";

type PrismaClientOrTx = PrismaService | Prisma.TransactionClient;

const TOLERANCE_CONFIG_KEY = "compras.price_tolerance_percent";
const DEFAULT_TOLERANCE_PERCENT = 0;

export interface PriceDeviationResult {
  deviationPercent: number;
}

const DEVIATION_INCLUDE = {
  offer: {
    select: {
      id: true,
      agreedPrice: true,
      product: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
    },
  },
  albaran: {
    select: { id: true, internalNumber: true, albaranNumber: true },
  },
  purchaseOrder: { select: { id: true, orderNumber: true } },
};

/**
 * Precio pactado por oferta y desviaciones frente a lo realmente recibido
 * (albarán o, en el futuro, catálogo importado). Es aditivo: una oferta sin
 * `agreedPrice` no genera nunca una desviación (comportamiento actual
 * intacto, incluido el aviso genérico >10% de albaran-stock.service.ts).
 */
@Injectable()
export class PriceAgreementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getTolerance(
    tenantId: string,
    client: PrismaClientOrTx = this.prisma,
  ): Promise<number> {
    const row = await client.configuration.findUnique({
      where: { tenantId_key: { tenantId, key: TOLERANCE_CONFIG_KEY } },
    });
    return row ? Number(row.value) : DEFAULT_TOLERANCE_PERCENT;
  }

  async setTolerance(tenantId: string, percent: number, userId: string) {
    await this.prisma.configuration.upsert({
      where: { tenantId_key: { tenantId, key: TOLERANCE_CONFIG_KEY } },
      create: {
        tenantId,
        key: TOLERANCE_CONFIG_KEY,
        value: String(percent),
        category: "COMPRAS",
        updatedBy: userId,
      },
      update: { value: String(percent), updatedBy: userId },
    });
    return { tolerancePercent: percent };
  }

  /**
   * Pura y testeable: decide si `receivedPrice` constituye una desviación
   * frente a `offer.agreedPrice` dada una tolerancia %, evaluada en `now`.
   * null → sin pacto, pacto caducado, o dentro de tolerancia (no hay nada
   * que registrar).
   */
  static detectDeviation(
    offer: Pick<ProductSupplierOffer, "agreedPrice" | "agreedUntil">,
    receivedPrice: number,
    tolerancePercent: number,
    now: Date = new Date(),
  ): PriceDeviationResult | null {
    if (offer.agreedPrice === null || offer.agreedPrice === undefined) {
      return null;
    }
    if (offer.agreedUntil && offer.agreedUntil < now) {
      return null;
    }

    const threshold = offer.agreedPrice * (1 + tolerancePercent / 100);
    if (receivedPrice <= threshold) {
      return null;
    }

    const deviationPercent =
      ((receivedPrice - offer.agreedPrice) / offer.agreedPrice) * 100;
    return { deviationPercent };
  }

  /**
   * Evalúa la oferta tras recibir un precio real y, si hay desviación,
   * registra `PriceDeviation` + notificación instantánea. No-op silencioso
   * si no hay pacto — nunca lanza ni interrumpe el flujo de confirmación.
   * Acepta `tx` opcional para participar en la transacción de quien llama
   * (ej. confirmación de albarán): sin ella, una oferta recién creada/
   * actualizada en la misma transacción podría no ser visible todavía.
   */
  async evaluateAndRecord(
    tenantId: string,
    offerId: string,
    receivedPrice: number,
    context: {
      albaranId?: string;
      purchaseOrderId?: string;
      productName: string;
      supplierName: string;
      albaranLabel?: string;
    },
    tx?: PrismaClientOrTx,
  ): Promise<void> {
    const client = tx ?? this.prisma;

    const offer = await client.productSupplierOffer.findFirst({
      where: { id: offerId, tenantId },
      select: { agreedPrice: true, agreedUntil: true },
    });
    if (!offer) {
      return;
    }

    const tolerance = await this.getTolerance(tenantId, client);
    const deviation = PriceAgreementService.detectDeviation(
      offer,
      receivedPrice,
      tolerance,
    );
    if (!deviation) {
      return;
    }

    await client.priceDeviation.create({
      data: {
        tenantId,
        offerId,
        albaranId: context.albaranId,
        purchaseOrderId: context.purchaseOrderId,
        agreedPrice: offer.agreedPrice!,
        receivedPrice,
        deviationPercent: deviation.deviationPercent,
      },
    });

    const origin = context.albaranLabel
      ? ` — Albarán ${context.albaranLabel}`
      : "";
    await this.notificationsService.createNotification(tenantId, {
      type: "PRICE_AGREEMENT_DEVIATION",
      severity: "WARNING",
      title: `Desviación de precio pactado: ${context.productName}`,
      message:
        `${context.supplierName}: pactado ${offer.agreedPrice!.toFixed(2)}€ / ` +
        `recibido ${receivedPrice.toFixed(2)}€ (+${deviation.deviationPercent.toFixed(1)}%)${origin}`,
    });
  }

  async findAll(tenantId: string, query: PriceDeviationsQueryDto) {
    return this.prisma.priceDeviation.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.supplierId
          ? { offer: { supplierId: query.supplierId } }
          : {}),
        ...(query.dateFrom || query.dateTo
          ? {
              createdAt: {
                ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
                ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
              },
            }
          : {}),
      },
      include: DEVIATION_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async updateStatus(
    tenantId: string,
    id: string,
    dto: UpdatePriceDeviationDto,
  ) {
    // Verifica pertenencia al tenant antes de escribir (soft-delete filtra
    // deletedAt automáticamente en findFirst)
    const existing = await this.prisma.priceDeviation.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException("Desviación no encontrada");
    }

    return this.prisma.priceDeviation.update({
      where: { id },
      data: { status: dto.status, note: dto.note },
      include: DEVIATION_INCLUDE,
    });
  }
}
