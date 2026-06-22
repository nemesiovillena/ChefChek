import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { NotificationsService } from "../../core/notifications.service";
import { LineStatus, LineMatchStatus } from "@prisma/client";

function normalizeUnit(unit: string): string {
  if (!unit) return "und";
  const u = unit.toLowerCase().trim();
  if (u === "kg") return "kg";
  if (u === "l" || u === "litro" || u === "litros") return "L";
  return "und";
}

@Injectable()
export class AlbaranStockService {
  private readonly logger = new Logger(AlbaranStockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Process stock entry when albaran transitions to CONFIRMADO.
   * Idempotent: skips if stock movements already exist for this albaran.
   */
  async processStockOnConfirmation(albaranId: string, tenantId: string): Promise<void> {
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
        const lineUnitPrice = Number(line.unitPrice);
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

          // Update purchase price if different
          const currentPrice = Number(product.purchasePrice);
          if (lineUnitPrice !== currentPrice) {
            const percentageChange =
              currentPrice > 0
                ? Math.abs(((lineUnitPrice - currentPrice) / currentPrice) * 100)
                : 100;

            await tx.product.update({
              where: { id: product.id },
              data: {
                purchasePrice: lineUnitPrice,
                netPrice: lineUnitPrice,
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

          // Create stock movement
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              warehouseId: albaran.warehouseId,
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

          // Create stock movement
          await tx.stockMovement.create({
            data: {
              productId: newProduct.id,
              warehouseId: albaran.warehouseId,
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
    });
  }

  private async notifyPriceChange(
    tenantId: string,
    productName: string,
    oldPrice: number,
    newPrice: number,
    percentageChange: number,
  ): Promise<void> {
    const direction = newPrice > oldPrice ? "aumentado" : "disminuido";
    const alertType = percentageChange > 25 ? "ERROR" : "WARNING";

    await this.notificationsService.createNotification(tenantId, {
      type: alertType,
      title: `Cambio de precio: ${productName}`,
      message: `Precio ${direction} ${percentageChange.toFixed(1)}%. De ${oldPrice.toFixed(2)}€ a ${newPrice.toFixed(2)}€.`,
      severity: alertType,
    });
  }
}
