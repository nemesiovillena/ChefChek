import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { Prisma, ProductSupplierOffer } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";

export interface UpsertSupplierOfferData {
  purchasePrice: number;
  netPrice?: number;
  purchaseFormat?: string;
  referenceUnit?: string;
  unitsPerFormat?: number;
  referenceUnitSize?: number;
  profitMargin?: number;
}

type PrismaClientOrTx = PrismaService | Prisma.TransactionClient;

/**
 * Ofertas de proveedor por artículo: un Product (ingrediente canónico) puede
 * tener varias ofertas de proveedor con precio/formato propios. La oferta
 * `isPreferred` es la única que sincroniza los campos planos de Product
 * (purchasePrice/netPrice/supplierId/formato) — así el motor de costeo de
 * recetas y los hooks de frontend, que solo leen esos campos planos, no
 * requieren ningún cambio.
 */
@Injectable()
export class ProductSupplierOffersService {
  constructor(private readonly prisma: PrismaService) {}

  async listOffers(productId: string, tenantId: string) {
    return this.prisma.productSupplierOffer.findMany({
      where: { productId, tenantId },
      include: { supplier: true },
      orderBy: [{ isPreferred: "desc" }, { createdAt: "asc" }],
    });
  }

  /**
   * Crea o actualiza la oferta de `supplierId` para `productId`. Si la oferta
   * afectada es la preferente, sincroniza Product y registra el cambio en
   * ProductPriceHistory; si no lo es, solo actualiza la oferta (pero el
   * histórico de precio se registra igualmente, para conservar visibilidad
   * de todos los proveedores). Acepta `tx` opcional para participar en una
   * transacción existente (ej. confirmación de albarán).
   */
  async upsertOffer(
    productId: string,
    supplierId: string,
    tenantId: string,
    data: UpsertSupplierOfferData,
    tx?: PrismaClientOrTx,
    albaranId?: string,
  ): Promise<ProductSupplierOffer> {
    const client = tx ?? this.prisma;

    const product = await client.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) {
      throw new NotFoundException("Product not found");
    }

    const existingOffer = await client.productSupplierOffer.findFirst({
      where: { productId, supplierId },
    });

    const unitsPerFormat =
      data.unitsPerFormat ?? existingOffer?.unitsPerFormat ?? 1;
    const referenceUnitSize =
      data.referenceUnitSize ?? existingOffer?.referenceUnitSize ?? 1;
    const unitSize = unitsPerFormat * referenceUnitSize;
    const netPrice = data.netPrice ?? data.purchasePrice;

    let offer: ProductSupplierOffer;
    if (existingOffer) {
      const priceChanged = existingOffer.purchasePrice !== data.purchasePrice;
      offer = await client.productSupplierOffer.update({
        where: { id: existingOffer.id },
        data: {
          previousPurchasePrice: priceChanged
            ? existingOffer.purchasePrice
            : existingOffer.previousPurchasePrice,
          purchasePrice: data.purchasePrice,
          netPrice,
          purchaseFormat: data.purchaseFormat ?? existingOffer.purchaseFormat,
          referenceUnit: data.referenceUnit ?? existingOffer.referenceUnit,
          unitsPerFormat,
          referenceUnitSize,
          unitSize,
          profitMargin: data.profitMargin ?? existingOffer.profitMargin,
        },
      });

      if (priceChanged) {
        await client.productPriceHistory.create({
          data: {
            tenantId,
            productId,
            supplierId,
            albaranId,
            previousPrice: existingOffer.purchasePrice,
            newPrice: data.purchasePrice,
          },
        });
      }
    } else {
      offer = await client.productSupplierOffer.create({
        data: {
          tenantId,
          productId,
          supplierId,
          purchasePrice: data.purchasePrice,
          previousPurchasePrice: 0,
          netPrice,
          purchaseFormat: data.purchaseFormat ?? "",
          referenceUnit: data.referenceUnit ?? "kg",
          unitsPerFormat,
          referenceUnitSize,
          unitSize,
          profitMargin: data.profitMargin ?? 0,
          isPreferred: false,
        },
      });
    }

    if (offer.isPreferred) {
      await this.syncProductFromOffer(client, productId, offer);
    }

    return offer;
  }

  /**
   * Marca `offerId` como preferente (desmarcando cualquier otra del mismo
   * producto) y sincroniza los campos planos de Product desde esa oferta.
   */
  async setPreferred(
    productId: string,
    offerId: string,
    tenantId: string,
  ): Promise<ProductSupplierOffer> {
    return this.prisma.$transaction(async (tx) => {
      const offer = await tx.productSupplierOffer.findFirst({
        where: { id: offerId, productId, tenantId },
      });
      if (!offer) {
        throw new NotFoundException("Supplier offer not found");
      }

      await tx.productSupplierOffer.updateMany({
        where: { productId, isPreferred: true, id: { not: offerId } },
        data: { isPreferred: false },
      });

      const updated = await tx.productSupplierOffer.update({
        where: { id: offerId },
        data: { isPreferred: true },
      });

      const product = await tx.product.findFirst({
        where: { id: productId, tenantId },
      });
      if (product && product.purchasePrice !== updated.purchasePrice) {
        await tx.productPriceHistory.create({
          data: {
            tenantId,
            productId,
            supplierId: updated.supplierId,
            previousPrice: product.purchasePrice,
            newPrice: updated.purchasePrice,
          },
        });
      }

      await this.syncProductFromOffer(tx, productId, updated);

      return updated;
    });
  }

  /**
   * Elimina (soft-delete) una oferta. Si es la preferente y hay otras ofertas
   * activas, exige `promoteOfferId` explícito — nunca se auto-promueve una
   * oferta distinta para evitar cambios de precio sorpresa.
   */
  async removeOffer(
    offerId: string,
    tenantId: string,
    promoteOfferId?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const offer = await tx.productSupplierOffer.findFirst({
        where: { id: offerId, tenantId },
      });
      if (!offer) {
        throw new NotFoundException("Supplier offer not found");
      }

      if (offer.isPreferred) {
        const otherOffers = await tx.productSupplierOffer.count({
          where: { productId: offer.productId, id: { not: offerId } },
        });
        if (otherOffers > 0 && !promoteOfferId) {
          throw new BadRequestException(
            "Indica qué oferta promocionar antes de eliminar la preferente",
          );
        }
      }

      await tx.productSupplierOffer.delete({ where: { id: offerId } });

      if (offer.isPreferred && promoteOfferId) {
        const promoted = await tx.productSupplierOffer.update({
          where: { id: promoteOfferId },
          data: { isPreferred: true },
        });
        await this.syncProductFromOffer(tx, offer.productId, promoted);
      }
    });
  }

  private async syncProductFromOffer(
    client: PrismaClientOrTx,
    productId: string,
    offer: ProductSupplierOffer,
  ): Promise<void> {
    await client.product.update({
      where: { id: productId },
      data: {
        supplierId: offer.supplierId,
        purchasePrice: offer.purchasePrice,
        previousPurchasePrice: offer.previousPurchasePrice,
        netPrice: offer.netPrice,
        purchaseFormat: offer.purchaseFormat,
        referenceUnit: offer.referenceUnit,
        unitsPerFormat: offer.unitsPerFormat,
        referenceUnitSize: offer.referenceUnitSize,
        unitSize: offer.unitSize,
        profitMargin: offer.profitMargin,
      },
    });
  }
}
