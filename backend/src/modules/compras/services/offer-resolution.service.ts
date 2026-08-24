import { Injectable, NotFoundException } from "@nestjs/common";
import { ProductSupplierOffer } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";

export interface OfferComparisonRow {
  offerId: string;
  supplierId: string;
  supplierName: string;
  purchasePrice: number;
  purchaseFormat: string;
  referenceUnit: string;
  /** purchasePrice / unitSize — comparable entre formatos distintos (caja vs kg) */
  referencePrice: number;
  isPreferred: boolean;
  isBestPrice: boolean;
  /** Solo presente si se pidió locationId: es la oferta que se usaría en ese local */
  isActiveForLocation?: boolean;
  agreedPrice: number | null;
}

/**
 * Resuelve qué oferta de proveedor está "activa" para un producto: por
 * defecto la preferente, salvo que exista un override habilitado por local
 * (`OfferLocationSetting`) — activar la oferta de otro proveedor en un local
 * puntual sin tocar la preferente del resto de locales (PDR §F7).
 *
 * Si se fija `supplierId` (pedido ya atado a un proveedor concreto — los
 * pedidos son por proveedor, decisión de producto de Sprint 1), se devuelve
 * directamente la oferta de ese proveedor: el local no pinta nada ahí, solo
 * aplica cuando se busca "la mejor oferta disponible" sin proveedor fijo
 * (comparativa, futuras sugerencias sin lista).
 */
@Injectable()
export class OfferResolutionService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveActiveOffer(
    tenantId: string,
    productId: string,
    options?: { supplierId?: string; locationId?: string },
  ): Promise<ProductSupplierOffer | null> {
    if (options?.supplierId) {
      return this.prisma.productSupplierOffer.findFirst({
        where: { tenantId, productId, supplierId: options.supplierId },
      });
    }

    if (options?.locationId) {
      const override = await this.prisma.offerLocationSetting.findFirst({
        where: {
          locationId: options.locationId,
          enabled: true,
          offer: { tenantId, productId },
        },
        include: { offer: true },
      });
      if (override) {
        return override.offer;
      }
    }

    return this.prisma.productSupplierOffer.findFirst({
      where: { tenantId, productId, isPreferred: true },
    });
  }

  /**
   * Comparativa de ofertas de un artículo: precio normalizado a la unidad de
   * referencia CANÓNICA DEL ARTÍCULO (product.referenceUnit — mismo criterio
   * que getReferencePrice en el frontend), no a la de cada oferta individual.
   * `locationId` opcional marca cuál está activa para ese local (§F7).
   */
  async compareOffers(
    tenantId: string,
    productId: string,
    locationId?: string,
  ): Promise<OfferComparisonRow[]> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) {
      throw new NotFoundException("Artículo no encontrado");
    }

    const offers = await this.prisma.productSupplierOffer.findMany({
      where: { tenantId, productId },
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { purchasePrice: "asc" },
    });
    if (offers.length === 0) {
      return [];
    }

    const activeOffer = locationId
      ? await this.resolveActiveOffer(tenantId, productId, { locationId })
      : null;

    const referencePrices = offers.map(
      (o) => o.purchasePrice / (o.unitSize || 1),
    );
    const bestReferencePrice = Math.min(...referencePrices);

    return offers.map((offer, index) => ({
      offerId: offer.id,
      supplierId: offer.supplierId,
      supplierName: offer.supplier.name,
      purchasePrice: offer.purchasePrice,
      purchaseFormat: offer.purchaseFormat,
      // Unidad canónica del artículo, NUNCA la de la oferta individual: dos
      // ofertas del mismo producto pueden llevar un referenceUnit propio
      // distinto (kg vs L) y compararlas así sería inválido (nº distintas
      // magnitudes). El artículo manda.
      referenceUnit: product.referenceUnit,
      referencePrice: referencePrices[index],
      isPreferred: offer.isPreferred,
      isBestPrice: referencePrices[index] === bestReferencePrice,
      ...(locationId
        ? { isActiveForLocation: activeOffer?.id === offer.id }
        : {}),
      agreedPrice: offer.agreedPrice,
    }));
  }

  /**
   * Activa/desactiva una oferta para un local puntual. `enabled:false`
   * simplemente borra el override (equivalente a "sigue la preferente").
   */
  async setLocationOverride(
    tenantId: string,
    offerId: string,
    locationId: string,
    enabled: boolean,
  ): Promise<void> {
    const offer = await this.prisma.productSupplierOffer.findFirst({
      where: { id: offerId, tenantId },
    });
    if (!offer) {
      throw new NotFoundException("Oferta no encontrada");
    }
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, tenantId },
    });
    if (!location) {
      throw new NotFoundException("Local no encontrado");
    }

    if (!enabled) {
      await this.prisma.offerLocationSetting.deleteMany({
        where: { offerId, locationId },
      });
      return;
    }

    // Solo puede haber una oferta activa por producto+local: al activar esta,
    // se desactivan (borran) los overrides de las demás ofertas del mismo
    // producto en ese local.
    await this.prisma.offerLocationSetting.deleteMany({
      where: {
        locationId,
        offer: { tenantId, productId: offer.productId, id: { not: offerId } },
      },
    });
    await this.prisma.offerLocationSetting.upsert({
      where: { offerId_locationId: { offerId, locationId } },
      create: { tenantId, offerId, locationId, enabled: true },
      update: { enabled: true },
    });
  }
}
