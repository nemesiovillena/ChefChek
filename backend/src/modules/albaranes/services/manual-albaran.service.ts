import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { AlbaranNumberService } from "./albaran-number.service";
import { NotificationsService } from "../../core/notifications.service";
import { ProductSupplierOffersService } from "../../products/product-supplier-offers.service";
import { LotService } from "./lot.service";
import { ManualAlbaranDto } from "../dto/manual-albaran.dto";

/**
 * Alta manual de albarán: crea/actualiza productos, genera un Albarán en
 * estado REVISADO y registra la entrada de stock.
 *
 * Reubicado desde el módulo `ingesta` (eliminado). Conserva la lógica original
 * de productos + albarán + stock; sólo se ha retirado el registro `Document`
 * del pipeline paralelo (ya no se consume en ningún sitio).
 *
 * El `reason` del movimiento de stock incluye el id del albarán: es la clave
 * de idempotencia que usa AlbaranStockService al confirmar, para no duplicar
 * existencias si este albarán manual se confirma después.
 */
@Injectable()
export class ManualAlbaranService {
  private readonly logger = new Logger(ManualAlbaranService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly albaranNumberService: AlbaranNumberService,
    private readonly notificationsService: NotificationsService,
    private readonly productSupplierOffersService: ProductSupplierOffersService,
    private readonly lotService: LotService,
  ) {}

  async process(
    dto: ManualAlbaranDto,
    requestTenantId?: string,
    userId?: string,
  ) {
    const tenantId = dto.tenantId || requestTenantId || "";
    if (!tenantId) {
      throw new BadRequestException("tenantId is required");
    }
    if (!userId) {
      throw new BadRequestException("userId is required");
    }

    const dateStr = dto.date || new Date().toISOString();

    // Find or create supplier
    let supplierId: string | null = dto.supplierId || null;
    const supplierName = dto.supplierName || "IMPORTADO";
    if (!supplierId && supplierName && supplierName !== "IMPORTADO") {
      const supplier = await this.findOrCreateSupplier(supplierName, tenantId);
      supplierId = supplier?.id || null;
    }

    // 1ª pasada: crear/actualizar productos. El stock se mueve después de
    // crear el albarán, para que los movimientos lo referencien y el
    // confirmado posterior (AlbaranStockService, idempotente por albaranId
    // en `reason`) no duplique existencias.
    const results = { created: 0, updated: 0, movements: 0 };
    const processedLines: {
      line: ManualAlbaranDto["lines"][number];
      productId: string | null;
    }[] = [];

    for (const line of dto.lines) {
      let productId = line.productId || null;

      // Normalize unit for referenceUnit
      const normalizedUnit =
        line.unit === "kg"
          ? "kg"
          : line.unit === "L" || line.unit === "l"
            ? "L"
            : "und";

      if (productId) {
        // Update existing product price
        const existing = await this.prisma.product.findFirst({
          where: { id: productId, tenantId },
        });
        if (existing && line.price > 0) {
          const priceChangePercentage =
            existing.purchasePrice > 0
              ? Math.abs(
                  ((line.price - existing.purchasePrice) /
                    existing.purchasePrice) *
                    100,
                )
              : 0;

          if (supplierId) {
            // Upsert de la oferta de este proveedor. Si es la preferente del
            // producto, sincroniza el precio plano; si es otro proveedor,
            // solo actualiza su oferta sin tocar el precio vigente.
            const offer = await this.productSupplierOffersService.upsertOffer(
              existing.id,
              supplierId,
              tenantId,
              { purchasePrice: line.price, netPrice: line.price },
            );
            if (offer.isPreferred && priceChangePercentage > 10) {
              await this.notifyPriceChange(
                tenantId,
                existing,
                line.price,
                priceChangePercentage,
              );
            }
          } else {
            // Fallback legacy: sin proveedor conocido no se puede crear oferta.
            await this.prisma.product.update({
              where: { id: existing.id },
              data: { purchasePrice: line.price, netPrice: line.price },
            });

            if (priceChangePercentage > 10) {
              await this.notifyPriceChange(
                tenantId,
                existing,
                line.price,
                priceChangePercentage,
              );
            }
          }
          results.updated++;
        }
        if (existing && line.lot) {
          await this.prisma.product.update({
            where: { id: existing.id },
            data: { lot: line.lot },
          });
        }
      } else {
        // Check if product with same name already exists
        const existingByName = await this.prisma.product.findFirst({
          where: { tenantId, name: line.name },
        });

        if (existingByName) {
          productId = existingByName.id;
          if (line.price > 0) {
            if (supplierId) {
              await this.productSupplierOffersService.upsertOffer(
                existingByName.id,
                supplierId,
                tenantId,
                { purchasePrice: line.price, netPrice: line.price },
              );
            } else {
              await this.prisma.product.update({
                where: { id: existingByName.id },
                data: { purchasePrice: line.price, netPrice: line.price },
              });
            }
          }
          if (line.lot) {
            await this.prisma.product.update({
              where: { id: existingByName.id },
              data: { lot: line.lot },
            });
          }
          results.updated++;
        } else {
          // Create new product. El categoryId del selector tiene prioridad;
          // el nombre libre queda como fallback (flujos antiguos).
          const category = line.categoryId
            ? await this.prisma.category.findFirst({
                where: { id: line.categoryId, tenantId },
              })
            : line.category
              ? await this.findOrCreateCategory(line.category, tenantId)
              : null;

          const product = await this.prisma.product.create({
            data: {
              tenantId,
              name: line.name,
              description: "",
              purchaseFormat: line.unit || "ud",
              referenceUnit: normalizedUnit,
              unitsPerFormat: 1,
              referenceUnitSize: 1,
              unitSize: 1,
              purchasePrice: line.price,
              netPrice: line.price,
              categoryId: category?.id || null,
              supplierId: supplierId,
              wastePercentage: 0,
              yieldFactor: 1.0,
              allergens: [],
              lot: line.lot || null,
            },
          });
          productId = product.id;
          results.created++;
        }
      }

      processedLines.push({ line, productId });
    }

    // 2ª pasada: crear la cabecera del albarán, para que aparezca en el
    // listado y sea consultable/editable como los de OCR. REVISADO (no
    // CONFIRMADO) para permitir edición posterior. Las líneas se crean en
    // la 3ª pasada, una a una.
    const internalNumber =
      await this.albaranNumberService.generateInternalNumber(tenantId);
    const baseTotal = processedLines.reduce(
      (sum, { line }) => sum + line.quantity * line.price,
      0,
    );
    const albaran = await this.prisma.albaran.create({
      data: {
        tenantId,
        internalNumber,
        supplierId,
        albaranNumber: dto.reference || `MANUAL-${Date.now()}`,
        date: new Date(dateStr),
        grossAmount: baseTotal,
        base: baseTotal,
        vatTotal: 0,
        total: baseTotal,
        status: "REVISADO",
        notes: "Entrada manual de mercancía",
      },
    });

    // 3ª pasada: crea cada línea individualmente (id real disponible al
    // instante, sin depender del orden en que Prisma devolvería un
    // `include` tras un `create` anidado en lote — no garantizado) y, si
    // aplica, movimientos de stock/lote. `reason` incluye el id del
    // albarán: es lo que usa AlbaranStockService como clave de idempotencia.
    for (const { line, productId } of processedLines) {
      const createdLine = await this.prisma.albaranLine.create({
        data: {
          albaranId: albaran.id,
          description: line.name,
          quantity: line.quantity,
          unit: line.unit,
          unitPrice: line.price,
          vatPercent: 0,
          lineAmount: line.quantity * line.price,
          matchedProductId: productId,
          matchStatus: "MATCH_ALTO",
          lineStatus: "CONFIRMADO",
          confidence: 1.0,
          lot: line.lot || null,
        },
      });

      if (!productId || line.quantity <= 0) {
        continue;
      }

      const lot = line.lot
        ? await this.lotService.createLotFromReception(this.prisma, {
            tenantId,
            productId,
            albaranLineId: createdLine.id,
            lotNumber: line.lot,
            quantity: line.quantity,
            supplierId,
          })
        : null;

      await this.prisma.stockMovement.create({
        data: {
          productId,
          lotId: lot?.id,
          type: "ENTRANCE",
          quantity: line.quantity,
          unit: line.unit,
          reason: `Entrada albarán manual ${internalNumber} [${albaran.id}]`,
        },
      });

      // Update stock quantity
      const stock = await this.prisma.stock.findFirst({
        where: { productId, tenantId },
      });
      if (stock) {
        await this.prisma.stock.update({
          where: { id: stock.id },
          data: { quantity: stock.quantity + line.quantity },
        });
      } else {
        await this.prisma.stock.create({
          data: {
            tenantId,
            productId,
            quantity: line.quantity,
            minimumStock: 0,
            reorderLevel: 0,
          },
        });
      }
      results.movements++;
    }

    this.logger.log(
      `Manual albarán ${internalNumber} (${albaran.id}): ${results.created} created, ${results.updated} updated, ${results.movements} stock movements`,
    );

    return {
      success: true,
      data: {
        albaranId: albaran.id,
        internalNumber,
        ...results,
      },
    };
  }

  private async notifyPriceChange(
    tenantId: string,
    product: any,
    newPrice: number,
    percentageChange: number,
  ) {
    const direction =
      newPrice > product.purchasePrice ? "aumentado" : "disminuido";
    const alertType = percentageChange > 25 ? "ERROR" : "WARNING";

    await this.notificationsService.createNotification(tenantId, {
      type: alertType,
      title: `Cambio de precio significativo: ${product.name}`,
      message: `El precio de ${product.name} ha ${direction} un ${percentageChange.toFixed(1)}%. De ${product.purchasePrice}€ a ${newPrice}€.`,
      severity: alertType,
    });
  }

  private async findOrCreateCategory(
    categoryName: string | undefined,
    tenantId: string,
  ) {
    if (!categoryName) {
      return null;
    }

    let category = await this.prisma.category.findFirst({
      where: { tenantId, name: categoryName },
    });

    if (!category) {
      category = await this.prisma.category.create({
        data: {
          tenantId,
          name: categoryName,
          slug: categoryName.toLowerCase().replace(/\s+/g, "-"),
          description: "Categoría creada automáticamente desde albarán manual",
        },
      });
    }

    return category;
  }

  private async findOrCreateSupplier(
    supplierName: string | undefined,
    tenantId: string,
  ) {
    if (!supplierName || supplierName === "IMPORTADO") {
      return null;
    }

    let supplier = await this.prisma.supplier.findFirst({
      where: { tenantId, name: supplierName },
    });

    if (!supplier) {
      supplier = await this.prisma.supplier.create({
        data: {
          tenantId,
          name: supplierName,
        },
      });
    }

    return supplier;
  }
}
