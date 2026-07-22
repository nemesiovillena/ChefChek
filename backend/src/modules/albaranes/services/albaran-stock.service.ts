import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { NotificationsService } from "../../core/notifications.service";
import { ProductSupplierOffersService } from "../../products/product-supplier-offers.service";
import { PriceAgreementService } from "../../compras/services/price-agreement.service";
import { LotService } from "./lot.service";
import { LineStatus, LineMatchStatus } from "@prisma/client";

function normalizeUnit(unit: string): string {
  if (!unit) {
    return "und";
  }
  const u = unit.toLowerCase().trim();
  if (u === "kg") {
    return "kg";
  }
  if (u === "l" || u === "litro" || u === "litros") {
    return "L";
  }
  return "und";
}

@Injectable()
export class AlbaranStockService {
  private readonly logger = new Logger(AlbaranStockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly productSupplierOffersService: ProductSupplierOffersService,
    private readonly priceAgreementService: PriceAgreementService,
    private readonly lotService: LotService,
  ) {}

  /**
   * Process stock entry when albaran transitions to CONFIRMADO.
   * Idempotent: skips if stock movements already exist for this albaran.
   */
  async processStockOnConfirmation(
    albaranId: string,
    tenantId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Idempotency check
      const existingMovements = await tx.stockMovement.findFirst({
        where: { reason: { contains: albaranId } },
      });
      if (existingMovements) {
        this.logger.log(`Albarán ${albaranId}: stock ya procesado, omitiendo`);
        return;
      }

      const albaran = await tx.albaran.findFirst({
        where: { id: albaranId, tenantId },
        include: { lines: true, supplier: true },
      });

      if (!albaran) {
        this.logger.warn(`Albarán ${albaranId} no encontrado`);
        return;
      }

      const confirmedLines = albaran.lines.filter(
        (l) => l.lineStatus === LineStatus.CONFIRMADO,
      );

      if (confirmedLines.length === 0) {
        this.logger.log(`Albarán ${albaranId}: sin líneas confirmadas`);
        return;
      }

      for (const line of confirmedLines) {
        const lineQuantity = Number(line.quantity);
        let lineUnitPrice = Number(line.unitPrice);
        // Opt-in del usuario: si activó "aplicar descuento al coste" y la línea
        // trae el importe neto del papel (con descuento), el coste real por
        // unidad es totalPrice/qty, no el bruto. Sin descuento o sin opt-in,
        // comportamiento idéntico al anterior (precio bruto).
        if (
          albaran.applyDiscountToCost &&
          line.totalPrice !== null &&
          lineQuantity > 0
        ) {
          lineUnitPrice = Number(line.totalPrice) / lineQuantity;
        }
        const lineUnit = line.unit || "und";

        if (line.matchedProductId) {
          // Existing product - update price and stock
          const product = await tx.product.findFirst({
            where: { id: line.matchedProductId, tenantId },
          });

          if (!product) {
            this.logger.warn(
              `Producto ${line.matchedProductId} no encontrado, omitiendo línea`,
            );
            continue;
          }

          // Producto sin proveedor: hereda el del albarán. Solo se rellena
          // cuando está vacío — nunca se pisa un proveedor ya asignado.
          if (!product.supplierId && albaran.supplierId) {
            await tx.product.update({
              where: { id: product.id },
              data: { supplierId: albaran.supplierId },
            });
            this.logger.log(
              `Proveedor ${albaran.supplierId} asignado a producto sin proveedor: ${product.name}`,
            );
          }

          const currentPrice = Number(product.purchasePrice);

          if (albaran.supplierId) {
            // Upsert de la oferta de ESTE proveedor: toda compra confirmada
            // lo marca preferente (regla de negocio — el último proveedor al
            // que se le compró rige el coste/escandallos), pisando cualquier
            // estrella manual anterior. Se llama siempre, no solo cuando
            // cambia el precio plano, para que un proveedor distinto al
            // preferente actual tome la estrella aunque el precio coincida.
            const offer = await this.productSupplierOffersService.upsertOffer(
              product.id,
              albaran.supplierId,
              tenantId,
              { purchasePrice: lineUnitPrice, netPrice: lineUnitPrice },
              tx,
              albaran.id,
              true,
            );

            if (lineUnitPrice !== currentPrice) {
              const percentageChange =
                currentPrice > 0
                  ? Math.abs(
                      ((lineUnitPrice - currentPrice) / currentPrice) * 100,
                    )
                  : 100;
              if (percentageChange > 10) {
                await this.notifyPriceChange(
                  tenantId,
                  product.name,
                  currentPrice,
                  lineUnitPrice,
                  percentageChange,
                );
              }
            }
          } else if (lineUnitPrice !== currentPrice) {
            // Fallback legacy: albarán sin proveedor asignado, no se puede
            // crear una oferta (supplierId es obligatorio en el modelo).
            const percentageChange =
              currentPrice > 0
                ? Math.abs(
                    ((lineUnitPrice - currentPrice) / currentPrice) * 100,
                  )
                : 100;

            await tx.product.update({
              where: { id: product.id },
              data: {
                previousPurchasePrice: currentPrice,
                purchasePrice: lineUnitPrice,
                netPrice: lineUnitPrice,
              },
            });

            await tx.productPriceHistory.create({
              data: {
                tenantId,
                productId: product.id,
                supplierId: null,
                albaranId: albaran.id,
                previousPrice: currentPrice,
                newPrice: lineUnitPrice,
                // Esta rama no toca unitSize (solo purchasePrice/netPrice), así
                // que antes/después es el mismo — se snapshotea igual para que
                // el frontend pueda calcular €/kg normalizado con datos completos.
                previousUnitSize: product.unitSize,
                newUnitSize: product.unitSize,
              },
            });

            if (percentageChange > 10) {
              await this.notifyPriceChange(
                tenantId,
                product.name,
                currentPrice,
                lineUnitPrice,
                percentageChange,
              );
            }
          }

          // Control de precios pactados (módulo Compras): se evalúa en TODA
          // entrega con proveedor, no solo cuando cambia el precio plano del
          // producto — un pacto se compara contra cada recepción, incluso si
          // el precio coincide con el vigente (que puede venir de la oferta
          // preferente de OTRO proveedor). No-op si no hay oferta o pacto.
          if (albaran.supplierId) {
            const offerForDeviation = await tx.productSupplierOffer.findFirst({
              where: { productId: product.id, supplierId: albaran.supplierId },
            });
            if (offerForDeviation) {
              await this.priceAgreementService.evaluateAndRecord(
                tenantId,
                offerForDeviation.id,
                lineUnitPrice,
                {
                  albaranId: albaran.id,
                  productName: product.name,
                  supplierName: albaran.supplier?.name ?? "Proveedor",
                  albaranLabel: albaran.internalNumber,
                },
                tx,
              );
            }
          }

          // Lote (si la línea trae número de lote)
          const lot = line.lot
            ? await this.lotService.createLotFromReception(tx, {
                tenantId,
                productId: product.id,
                albaranLineId: line.id,
                lotNumber: line.lot,
                quantity: lineQuantity,
                warehouseId: albaran.warehouseId,
                supplierId: albaran.supplierId,
              })
            : null;

          if (lot) {
            await tx.product.update({
              where: { id: product.id },
              data: { lot: line.lot },
            });
          }

          // Create stock movement
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              warehouseId: albaran.warehouseId,
              lotId: lot?.id,
              type: "ENTRANCE",
              quantity: lineQuantity,
              unit: normalizeUnit(lineUnit),
              reason: `Entrada desde albarán ${albaran.internalNumber} (${albaranId})`,
            },
          });

          // Upsert stock
          const existingStock = await tx.stock.findFirst({
            where: {
              productId: product.id,
              warehouseId: albaran.warehouseId || null,
              tenantId,
            },
          });

          if (existingStock) {
            await tx.stock.update({
              where: { id: existingStock.id },
              data: { quantity: { increment: lineQuantity } },
            });
          } else {
            await tx.stock.create({
              data: {
                tenantId,
                productId: product.id,
                warehouseId: albaran.warehouseId,
                quantity: lineQuantity,
              },
            });
          }

          this.logger.log(
            `Stock actualizado: ${product.name} +${lineQuantity} ${lineUnit}`,
          );
        } else {
          // NUEVO product - create product, update line, and add stock
          const newProduct = await tx.product.create({
            data: {
              tenantId,
              name: line.description,
              description: `Creado desde albarán ${albaran.internalNumber}`,
              purchaseFormat: lineUnit,
              referenceUnit: normalizeUnit(lineUnit),
              unitsPerFormat: 1,
              referenceUnitSize: 1,
              unitSize: 1,
              purchasePrice: lineUnitPrice,
              netPrice: lineUnitPrice,
              supplierId: albaran.supplierId,
              wastePercentage: 0,
              yieldFactor: 1.0,
              allergens: [],
              lot: line.lot || null,
            },
          });

          // Update line with new product
          await tx.albaranLine.update({
            where: { id: line.id },
            data: {
              matchedProductId: newProduct.id,
              matchStatus: LineMatchStatus.MATCH_ALTO,
            },
          });

          // Lote (si la línea trae número de lote)
          const newProductLot = line.lot
            ? await this.lotService.createLotFromReception(tx, {
                tenantId,
                productId: newProduct.id,
                albaranLineId: line.id,
                lotNumber: line.lot,
                quantity: lineQuantity,
                warehouseId: albaran.warehouseId,
                supplierId: albaran.supplierId,
              })
            : null;

          // Create stock movement
          await tx.stockMovement.create({
            data: {
              productId: newProduct.id,
              warehouseId: albaran.warehouseId,
              lotId: newProductLot?.id,
              type: "ENTRANCE",
              quantity: lineQuantity,
              unit: normalizeUnit(lineUnit),
              reason: `Entrada desde albarán ${albaran.internalNumber} (${albaranId})`,
            },
          });

          // Create stock record
          await tx.stock.create({
            data: {
              tenantId,
              productId: newProduct.id,
              warehouseId: albaran.warehouseId,
              quantity: lineQuantity,
            },
          });

          this.logger.log(
            `Producto creado: ${newProduct.name} con stock ${lineQuantity} ${lineUnit}`,
          );
        }
      }

      this.logger.log(
        `Albarán ${albaranId}: procesadas ${confirmedLines.length} líneas`,
      );

      // Generate supplier OCR layout hints from confirmed lines
      if (albaran.supplierId) {
        await this.generateSupplierHints(tx, albaran, confirmedLines, tenantId);
      }
    });
  }

  /**
   * Generate and save OCR layout hints for a supplier based on confirmed albaran lines.
   * Merges with existing hints (increments observationCount, updates exampleLines).
   */
  private async generateSupplierHints(
    tx: any,
    albaran: any,
    confirmedLines: any[],
    tenantId: string,
  ): Promise<void> {
    try {
      const supplier = await tx.supplier.findFirst({
        where: { id: albaran.supplierId, tenantId },
      });
      if (!supplier) {
        return;
      }

      // Build column order from confirmed lines
      const hasArticleNumber = confirmedLines.some((l: any) => l.articleNumber);
      const columnOrder: string[] = [];
      if (hasArticleNumber) {
        columnOrder.push("codigo");
      }
      columnOrder.push("descripcion", "cantidad", "unidad", "precio", "total");

      // Collect typical units
      const units = [
        ...new Set(confirmedLines.map((l: any) => l.unit || "und")),
      ];

      // Most frequent VAT
      const vatCounts: Record<number, number> = {};
      confirmedLines.forEach((l: any) => {
        const vat = Number(l.vatPercent) || 10;
        vatCounts[vat] = (vatCounts[vat] || 0) + 1;
      });
      const typicalVat = Object.entries(vatCounts).sort(
        (a, b) => b[1] - a[1],
      )[0];

      // Build example lines from confirmed data
      const exampleLines = confirmedLines.slice(0, 3).map((l: any) => ({
        raw: l.description, // Best available raw text
        parsed: {
          name: l.description,
          qty: Number(l.quantity),
          unit: l.unit || "und",
          price: Number(l.unitPrice),
        },
      }));

      // Merge with existing hints
      const existingHints = (supplier.ocrLayoutHints as any) || {};
      const newHints = {
        supplierName: supplier.name,
        columnOrder,
        typicalUnits: units,
        vatPercent: Number(typicalVat?.[0] || 10),
        exampleLines,
        observationCount: (existingHints.observationCount || 0) + 1,
        lastUpdated: new Date().toISOString(),
        // Preserve existing fields if not overwritten
        ...(existingHints.tableMarker
          ? { tableMarker: existingHints.tableMarker }
          : {}),
        ...(existingHints.priceDecimalSeparator
          ? { priceDecimalSeparator: existingHints.priceDecimalSeparator }
          : {}),
      };

      await tx.supplier.update({
        where: { id: supplier.id },
        data: { ocrLayoutHints: newHints },
      });

      this.logger.log(
        `Hints actualizados para proveedor ${supplier.name} (obs: ${newHints.observationCount})`,
      );
    } catch (err) {
      // Non-critical — don't fail the stock processing
      this.logger.warn(`Error generando hints de proveedor: ${err.message}`);
    }
  }

  private async notifyPriceChange(
    tenantId: string,
    productName: string,
    oldPrice: number,
    newPrice: number,
    percentageChange: number,
  ): Promise<void> {
    await this.notificationsService.notifyPriceChange(
      tenantId,
      productName,
      oldPrice,
      newPrice,
      percentageChange,
    );
  }
}
