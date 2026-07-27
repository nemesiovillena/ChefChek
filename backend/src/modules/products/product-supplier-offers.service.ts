import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { Prisma, ProductSupplierOffer } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import { referencePriceChanged } from "../../common/utils/unit-conversions";

export interface UpsertSupplierOfferData {
  purchasePrice: number;
  netPrice?: number;
  purchaseFormat?: string;
  referenceUnit?: string;
  unitsPerFormat?: number;
  referenceUnitSize?: number;
  profitMargin?: number;
  /** Precio pactado (control de desviaciones); null limpia el pacto existente. */
  agreedPrice?: number | null;
  agreedUntil?: string | null;
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
    /**
     * Compra confirmada (albarán): este proveedor pasa a ser el preferente
     * SIEMPRE — regla de negocio "el último proveedor comprado manda en el
     * coste", pisa cualquier elección manual anterior. false para ediciones
     * manuales (modal Artículos, vincular duplicado), donde `isPreferred`
     * sigue siendo una elección explícita del usuario.
     */
    promoteToPreferred = false,
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

    // Ni el albarán OCR ni el alta manual llevan "unidades por caja" en la
    // línea: si esta es la primera oferta de este proveedor y no viene el
    // dato explícito, hereda el unitSize que el producto YA tenía correcto
    // (ej. fijado al crearlo desde el formulario) en vez de resetear a 1 —
    // sin este fallback, la primera compra confirmada de un proveedor nuevo
    // pisaba el unitSize real del producto con 1, disparando un falso "subió
    // el precio" en el badge de tendencia (precio/1 vs precio/105).
    const unitsPerFormat =
      data.unitsPerFormat ??
      existingOffer?.unitsPerFormat ??
      product.unitsPerFormat ??
      1;
    const referenceUnitSize =
      data.referenceUnitSize ??
      existingOffer?.referenceUnitSize ??
      product.referenceUnitSize ??
      1;
    const unitSize = unitsPerFormat * referenceUnitSize;
    const netPrice = data.netPrice ?? data.purchasePrice;

    if (promoteToPreferred) {
      await client.productSupplierOffer.updateMany({
        where: { productId, isPreferred: true },
        data: { isPreferred: false },
      });
    }

    let offer: ProductSupplierOffer;
    if (existingOffer) {
      // Contrato del campo plano `previousPurchasePrice` (fuera de alcance de este
      // fix): sigue disparándose con el precio crudo, como siempre.
      const rawPriceChanged =
        existingOffer.purchasePrice !== data.purchasePrice;
      offer = await client.productSupplierOffer.update({
        where: { id: existingOffer.id },
        data: {
          previousPurchasePrice: rawPriceChanged
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
          ...(promoteToPreferred ? { isPreferred: true } : {}),
          ...this.buildAgreedFields(data, existingOffer),
        },
      });
    } else {
      // Primera oferta del producto: se marca preferente para que sincronice
      // Product.supplierId/purchasePrice (de lo contrario el listado de
      // artículos, que lee product.supplier, seguiría mostrando "sin proveedor").
      const offerCount = await client.productSupplierOffer.count({
        where: { productId },
      });
      offer = await client.productSupplierOffer.create({
        data: {
          tenantId,
          productId,
          supplierId,
          purchasePrice: data.purchasePrice,
          previousPurchasePrice: 0,
          netPrice,
          purchaseFormat: data.purchaseFormat ?? "",
          // Unidad canónica del artículo por defecto, no "kg" a ciegas: evita
          // que una oferta creada sin especificar unidad (ej. aplicar un
          // catálogo) quede en una unidad distinta a la del propio artículo.
          referenceUnit: data.referenceUnit ?? product.referenceUnit,
          unitsPerFormat,
          referenceUnitSize,
          unitSize,
          profitMargin: data.profitMargin ?? 0,
          isPreferred: promoteToPreferred || offerCount === 0,
          ...this.buildAgreedFields(data, null),
        },
      });
    }

    // Sin este bloque, ninguna oferta nueva/actualizada quedaba en el
    // Histórico de precios salvo la que ya era preferente de siempre.
    if (promoteToPreferred) {
      // ¿Primera compra real del artículo? Una fila previa de historial
      // vinculada a un albarán (albaranId not null = compra confirmada) es la
      // señal de que ya hubo una compra con traza.
      const priorPurchase = await client.productPriceHistory.findFirst({
        where: { productId, albaranId: { not: null } },
        select: { id: true },
      });

      // Sin priorPurchase no basta para decidir "sin precio previo real": un
      // producto creado días/semanas antes (manual, catálogo, oferta sin
      // histórico) puede llevar un product.purchasePrice > 0 perfectamente
      // válido aunque nunca haya tenido una compra confirmada por albarán —
      // bug real detectado (precio 7.25→9.5 de una compra se perdía porque
      // caía siempre en la rama baseline). Solo tratamos como línea base sin
      // comparación cuando el producto de verdad no tiene precio (0) o fue
      // creado como parte de ESTE MISMO albarán: un artículo recién creado
      // desde el propio albarán porta un purchasePrice = bruto de la creación
      // inline (create-product-inline prefija con line.unitPrice); al
      // confirmar con applyDiscountToCost activo, lineUnitPrice pasa a ser el
      // neto (totalPrice/qty) y la comparación bruto→neto generaría un badge
      // espurio -X% igual al descuento de la factura, aunque no exista compra
      // previa real distinta de esta.
      let isSameAlbaranInlineCreation = false;
      if (!priorPurchase && product.purchasePrice > 0 && albaranId) {
        const currentAlbaran = await client.albaran.findUnique({
          where: { id: albaranId },
          select: { createdAt: true },
        });
        isSameAlbaranInlineCreation =
          !!currentAlbaran && product.createdAt >= currentAlbaran.createdAt;
      }

      if (
        !priorPurchase &&
        (product.purchasePrice <= 0 || isSameAlbaranInlineCreation)
      ) {
        // Sin precio previo real: baseline. newPrice queda como precio de
        // arranque para que la SIGUIENTE compra sí tenga contra qué comparar.
        await client.productPriceHistory.create({
          data: {
            tenantId,
            productId,
            supplierId,
            albaranId,
            previousPrice: 0,
            newPrice: data.purchasePrice,
            previousUnitSize: null,
            newUnitSize: unitSize,
          },
        });
      } else if (
        // Compras posteriores: tendencia real contra el precio plano vigente
        // del artículo ANTES de esta compra (sea de quien sea el proveedor).
        referencePriceChanged(
          product.purchasePrice,
          product.unitSize,
          data.purchasePrice,
          unitSize,
        )
      ) {
        await client.productPriceHistory.create({
          data: {
            tenantId,
            productId,
            supplierId,
            albaranId,
            previousPrice: product.purchasePrice,
            newPrice: data.purchasePrice,
            previousUnitSize: product.unitSize,
            newUnitSize: unitSize,
          },
        });
      }
    } else if (existingOffer) {
      // Trigger del historial: normalizado a €/kg (con tolerancia) — evita filas/
      // badges falsos cuando solo cambia el tamaño de caja/formato pero el precio
      // real por kg es el mismo.
      if (
        referencePriceChanged(
          existingOffer.purchasePrice,
          existingOffer.unitSize,
          data.purchasePrice,
          unitSize,
        )
      ) {
        await client.productPriceHistory.create({
          data: {
            tenantId,
            productId,
            supplierId,
            albaranId,
            previousPrice: existingOffer.purchasePrice,
            newPrice: data.purchasePrice,
            previousUnitSize: existingOffer.unitSize,
            newUnitSize: unitSize,
          },
        });
      }
    } else if (offer.isPreferred) {
      // Primera oferta del producto (aún no había ninguna, de ningún
      // proveedor): comparamos contra el precio plano vigente del artículo
      // (normalizado a €/kg) para no crear una fila si coincide con lo que
      // ya tenía (ej. producto creado con un precio estimado igual al real).
      if (
        referencePriceChanged(
          product.purchasePrice,
          product.unitSize,
          data.purchasePrice,
          unitSize,
        )
      ) {
        await client.productPriceHistory.create({
          data: {
            tenantId,
            productId,
            supplierId,
            albaranId,
            previousPrice: product.purchasePrice,
            newPrice: data.purchasePrice,
            previousUnitSize: product.unitSize,
            newUnitSize: unitSize,
          },
        });
      }
    } else {
      // Segundo (o siguiente) proveedor para un artículo que ya tenía
      // preferente de otro, SIN promoteToPreferred (alta manual): no hay
      // "precio anterior" de ESTE proveedor con el que comparar (nunca
      // ofertó antes) — comparar contra product.purchasePrice sería contra
      // el precio de OTRO proveedor y generaría una fila engañosa. Se
      // registra sin comparación, igual que `previousPurchasePrice: 0`.
      await client.productPriceHistory.create({
        data: {
          tenantId,
          productId,
          supplierId,
          albaranId,
          previousPrice: 0,
          newPrice: data.purchasePrice,
          previousUnitSize: null,
          newUnitSize: unitSize,
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
      // Dos ofertas de proveedor distintas pueden tener unitSize distinto (cajas de
      // tamaño diferente): comparar €/kg normalizado, no purchasePrice crudo.
      if (
        product &&
        referencePriceChanged(
          product.purchasePrice,
          product.unitSize,
          updated.purchasePrice,
          updated.unitSize,
        )
      ) {
        await tx.productPriceHistory.create({
          data: {
            tenantId,
            productId,
            supplierId: updated.supplierId,
            previousPrice: product.purchasePrice,
            newPrice: updated.purchasePrice,
            previousUnitSize: product.unitSize,
            newUnitSize: updated.unitSize,
          },
        });
      }

      // El "precio anterior" a mostrar en Product es el precio vigente antes
      // de este cambio de preferente — no el histórico interno de la nueva
      // oferta (que puede ser 0 si nunca cambió de precio por su cuenta).
      await this.syncProductFromOffer(tx, productId, {
        ...updated,
        previousPurchasePrice:
          product?.purchasePrice ?? updated.previousPurchasePrice,
      });

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

      // NUNCA `tx.productSupplierOffer.delete(...)`: el middleware de soft-delete
      // extiende el cliente base (`this.prisma`), no el cliente de transacción
      // (`tx`) — un delete aquí sería un borrado físico real pese al comentario
      // de este método. Ver PrismaService (modelsWithSoftDelete).
      await tx.productSupplierOffer.update({
        where: { id: offerId },
        data: { deletedAt: new Date() },
      });

      if (offer.isPreferred && promoteOfferId) {
        const promoted = await tx.productSupplierOffer.update({
          where: { id: promoteOfferId },
          data: { isPreferred: true },
        });
        await this.syncProductFromOffer(tx, offer.productId, promoted);
      }
    });
  }

  /**
   * Campos de precio pactado a fusionar en el create/update de la oferta.
   * Ausente (`undefined`) = no tocar; `null` explícito = limpiar el pacto.
   * `agreedAt` se estampa solo cuando `agreedPrice` cambia de verdad, para no
   * "reactivar" un pacto sin cambios reales en cada guardado del formulario.
   */
  private buildAgreedFields(
    data: UpsertSupplierOfferData,
    existingOffer: ProductSupplierOffer | null,
  ) {
    const fields: {
      agreedPrice?: number | null;
      agreedAt?: Date | null;
      agreedUntil?: Date | null;
    } = {};

    if (data.agreedPrice !== undefined) {
      fields.agreedPrice = data.agreedPrice;
      fields.agreedAt =
        data.agreedPrice === null
          ? null
          : data.agreedPrice !== existingOffer?.agreedPrice
            ? new Date()
            : existingOffer.agreedAt;
    }
    if (data.agreedUntil !== undefined) {
      fields.agreedUntil = data.agreedUntil ? new Date(data.agreedUntil) : null;
    }
    return fields;
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
        // NO se sincroniza referenceUnit: es la unidad canónica del artículo
        // (rige costeo/recetas/comparativa) y nunca debe cambiar por marcar
        // preferente una oferta que llegó con una unidad distinta.
        unitsPerFormat: offer.unitsPerFormat,
        referenceUnitSize: offer.referenceUnitSize,
        unitSize: offer.unitSize,
        profitMargin: offer.profitMargin,
      },
    });
  }
}
