import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { PrismaService } from "../../common/services/prisma.service";
import { TelegramBotService } from "./telegram-bot.service";
import { OcrAiService } from "./ocr-ai.service";
import { NotificationsService } from "../core/notifications.service";
import {
  DocumentReceivedDto,
  CreateDocumentDto,
  DocumentQueryDto,
  UpdateDocumentDto,
  DocumentStatus,
  ExtractedProductDto,
} from "./dto/ingesta.dto";
import { ManualAlbaranDto } from "./dto/manual-albaran.dto";

@Injectable()
export class IngestaService {
  private readonly logger = new Logger(IngestaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramBotService: TelegramBotService,
    private readonly ocrAiService: OcrAiService,
    private readonly notificationsService: NotificationsService,
    @InjectQueue("document-processing") private readonly documentQueue: Queue,
  ) {}

  async createDocument(dto: CreateDocumentDto) {
    this.logger.log(
      `Creating document: ${dto.documentType} for tenant ${dto.tenantId}`,
    );

    try {
      const document = await this.prisma.document.create({
        data: {
          tenantId: dto.tenantId,
          type: dto.documentType,
          name: dto.fileName || dto.fileUrl,
          category: "INGESTA",
          version: 1,
          createdBy: "SYSTEM",
          fileSize: 0,
          fileFormat: "PDF",
          url: dto.fileUrl,
          fileUrl: dto.fileUrl,
          fileName: dto.fileName,
          fileId: dto.fileId,
          source: dto.source,
          sourceUserId: dto.sourceUserId,
          status: DocumentStatus.PENDING,
          ocrData: dto.ocrData || null,
          aiData: dto.aiData || null,
          extractedProducts: dto.extractedProducts
            ? {
                create: dto.extractedProducts.map((ep) => ({
                  name: ep.name,
                  description: ep.description,
                  quantity: ep.quantity || 0,
                  unit: ep.unit || "ud",
                  unitPrice: ep.unitPrice || 0,
                  supplier: ep.supplier || "IMPORTADO",
                  category: ep.category || "",
                  allergens: ep.allergens || [],
                  confidence: ep.confidence || 0,
                })),
              }
            : undefined,
        },
      });

      // Enqueue para procesamiento asíncrono
      await this.enqueueForProcessing(document.id);

      return {
        success: true,
        data: document,
        message: "Document created and queued for processing",
      };
    } catch (error) {
      this.logger.error(`Error creating document: ${error.message}`);
      throw error;
    }
  }

  async findAll(query: DocumentQueryDto) {
    const where: any = {};

    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }

    if (query.documentType) {
      where.type = query.documentType;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const documents = await this.prisma.document.findMany({
      where,
      include: {
        extractedProducts: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      success: true,
      data: documents,
      count: documents.length,
    };
  }

  async findOne(id: string, tenantId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, tenantId },
      include: {
        extractedProducts: true,
      },
    });

    if (!document) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Document not found",
        },
      };
    }

    return {
      success: true,
      data: document,
    };
  }

  async updateStatus(id: string, dto: UpdateDocumentDto, tenantId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, tenantId },
    });

    if (!document) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Document not found",
        },
      };
    }

    try {
      const updated = await this.prisma.document.update({
        where: { id },
        data: {
          status: dto.status,
          errorMessage: dto.errorMessage,
          ocrData: dto.ocrData,
          aiData: dto.aiData,
          ...(dto.extractedProducts && {
            extractedProducts: {
              deleteMany: {},
              create: dto.extractedProducts.map((ep) => ({
                name: ep.name,
                description: ep.description,
                quantity: ep.quantity || 0,
                unit: ep.unit || "ud",
                unitPrice: ep.unitPrice || 0,
                supplier: ep.supplier || "IMPORTADO",
                category: ep.category || "",
                allergens: ep.allergens || [],
                confidence: ep.confidence || 0,
              })),
            },
          }),
        },
      });

      // Si el procesamiento completó con éxito, actualizar en cascada
      if (dto.status === DocumentStatus.COMPLETED && dto.extractedProducts) {
        await this.updateCascadingCosts(dto.extractedProducts, tenantId);
      }

      return {
        success: true,
        data: updated,
        message: "Document updated successfully",
      };
    } catch (error) {
      this.logger.error(`Error updating document: ${error.message}`);
      throw error;
    }
  }

  async processDocument(id: string) {
    this.logger.log(`Processing document: ${id}`);

    const document = await this.prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      throw new Error("Document not found");
    }

    try {
      // Actualizar estado a PROCESSING
      await this.prisma.document.update({
        where: { id },
        data: { status: DocumentStatus.PROCESSING },
      });

      // Paso 1: OCR para extraer texto del documento
      const ocrResult = await this.ocrAiService.extractText(document.fileUrl);

      // Paso 2: AI para procesar y extraer datos estructurados
      const aiResult = await this.ocrAiService.processDocumentData(
        ocrResult.text,
        document.tenantId,
        ocrResult,
      );

      // Paso 3: Actualizar documento con resultados
      await this.prisma.document.update({
        where: { id },
        data: {
          status: DocumentStatus.COMPLETED,
          ocrData: { text: ocrResult.text, confidence: ocrResult.confidence },
          aiData: aiResult as any,
          extractedProducts: aiResult.extractedProducts
            ? {
                create: aiResult.extractedProducts.map((ep) => ({
                  name: ep.name,
                  description: ep.description,
                  quantity: ep.quantity || 0,
                  unit: ep.unit || "ud",
                  unitPrice: ep.unitPrice || 0,
                  supplier: ep.supplier || "IMPORTADO",
                  category: ep.category || "",
                  allergens: ep.allergens || [],
                  confidence: ep.confidence || 0,
                })),
              }
            : undefined,
        },
      });

      // Paso 4: Actualizar en cascada costos
      if (aiResult.extractedProducts && aiResult.extractedProducts.length > 0) {
        await this.updateCascadingCosts(
          aiResult.extractedProducts,
          document.tenantId,
        );
      }

      this.logger.log(`Document processed successfully: ${id}`);

      return {
        success: true,
        message: "Document processed successfully",
        extractedProductsCount: aiResult.extractedProducts?.length || 0,
      };
    } catch (error) {
      this.logger.error(`Error processing document ${id}: ${error.message}`);

      await this.prisma.document.update({
        where: { id },
        data: {
          status: DocumentStatus.FAILED,
          errorMessage: error.message,
        },
      });

      throw error;
    }
  }

  private async enqueueForProcessing(documentId: string) {
    this.logger.log(`Enqueueing document for processing: ${documentId}`);

    try {
      // Get document details for queue job
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // Add job to Bull queue
      await this.documentQueue.add(
        "process-document",
        {
          documentId,
          tenantId: document.tenantId,
          fileUrl: document.url,
          retryCount: 0,
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );

      this.logger.log(`Document ${documentId} queued for processing`);
    } catch (error) {
      this.logger.error(
        `Error enqueuing document ${documentId}: ${error.message}`,
      );
      throw error;
    }
  }

  private async updateCascadingCosts(
    extractedProducts: ExtractedProductDto[],
    tenantId: string,
  ) {
    this.logger.log(
      `Updating cascading costs for ${extractedProducts.length} products in tenant ${tenantId}`,
    );

    try {
      for (const product of extractedProducts) {
        // Buscar si el producto ya existe
        const existingProduct = await this.prisma.product.findFirst({
          where: {
            tenantId,
            name: product.name,
          },
        });

        if (existingProduct) {
          // Actualizar precio si existe y se proporcionó nuevo precio
          if (product.unitPrice && product.unitPrice > 0) {
            const priceChangePercentage = Math.abs(
              ((product.unitPrice - existingProduct.netPrice) /
                existingProduct.netPrice) *
                100,
            );

            const updatedProduct = await this.prisma.product.update({
              where: { id: existingProduct.id },
              data: { netPrice: product.unitPrice },
            });

            this.logger.log(
              `Updated product price: ${existingProduct.name} -> ${product.unitPrice}€ (${priceChangePercentage.toFixed(1)}% change)`,
            );

            // Notify on significant price changes (>10%)
            if (priceChangePercentage > 10) {
              await this.notifyPriceChange(
                tenantId,
                existingProduct,
                product.unitPrice,
                priceChangePercentage,
              );
            }
          }
        } else {
          // Crear nuevo producto si no existe y se tienen datos suficientes
          if (product.name && product.unitPrice && product.unitPrice > 0) {
            const category = await this.findOrCreateCategory(
              product.category,
              tenantId,
            );

            // Mapear alérgenos de strings a IDs
            const allergenIds: number[] = [];
            if (product.allergens && product.allergens.length > 0) {
              // Por ahora, crear IDs basados en hash del nombre
              // En producción, buscaría en la tabla de alérgenos
              product.allergens.forEach((a, i) => {
                allergenIds.push(
                  a
                    .split("")
                    .reduce((acc, char) => acc + char.charCodeAt(0), 0),
                );
              });
            }

            const supplier = await this.findOrCreateSupplier(
              product.supplier || "IMPORTADO",
              tenantId,
            );

            await this.prisma.product.create({
              data: {
                tenantId,
                name: product.name,
                description: product.description || "",
                purchaseFormat: product.unit || "ud",
                referenceUnit:
                  product.unit === "kg"
                    ? "kg"
                    : product.unit === "L" || product.unit === "l"
                      ? "L"
                      : "und",
                unitsPerFormat: 1,
                referenceUnitSize: 1,
                unitSize: 1,
                purchasePrice: product.unitPrice,
                netPrice: product.unitPrice,
                categoryId: category?.id || null,
                supplierId: supplier?.id || null,
                wastePercentage: 0,
                yieldFactor: 1.0,
                allergens: allergenIds,
              },
            });

            this.logger.log(`Created new product: ${product.name}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error updating cascading costs: ${error.message}`);
      // No lanzar error - actualización en cascada no debe fallar el flujo principal
    }
  }

  private async notifyPriceChange(
    tenantId: string,
    product: any,
    newPrice: number,
    percentageChange: number,
  ) {
    const direction = newPrice > product.netPrice ? "aumentado" : "disminuido";
    const alertType = percentageChange > 25 ? "ERROR" : "WARNING";

    await this.notificationsService.createNotification(tenantId, {
      type: alertType,
      title: `Cambio de precio significativo: ${product.name}`,
      message: `El precio de ${product.name} ha ${direction} un ${percentageChange.toFixed(1)}%. De ${product.netPrice}€ a ${newPrice}€.`,
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
          description: `Categoría creada automáticamente desde ingesta`,
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

  async getProcessingStats(tenantId: string) {
    const [pending, processing, completed, failed] = await Promise.all([
      this.prisma.document.count({
        where: { tenantId, status: DocumentStatus.PENDING },
      }),
      this.prisma.document.count({
        where: { tenantId, status: DocumentStatus.PROCESSING },
      }),
      this.prisma.document.count({
        where: { tenantId, status: DocumentStatus.COMPLETED },
      }),
      this.prisma.document.count({
        where: { tenantId, status: DocumentStatus.FAILED },
      }),
    ]);

    const documents = await this.prisma.document.findMany({
      where: { tenantId },
      include: {
        extractedProducts: true,
      },
    });

    const totalProcessed = completed;
    const successfulExtractions = documents.filter(
      (d) => d.status === DocumentStatus.COMPLETED && d.ocrData,
    ).length;
    const needsReview = documents.filter(
      (d) =>
        d.ocrData &&
        (d.ocrData as any).confidence &&
        (d.ocrData as any).confidence < 0.8,
    ).length;
    const averageConfidence =
      documents.length > 0
        ? documents.reduce(
            (sum, d) => sum + ((d.ocrData as any)?.confidence || 0),
            0,
          ) / documents.length
        : 0;
    const averageProcessingTime =
      documents.length > 0
        ? documents.reduce(
            (sum, d) => sum + (d.updatedAt.getTime() - d.createdAt.getTime()),
            0,
          ) / documents.length
        : 0;

    const totalProductsCreated = documents.reduce(
      (sum, d) => sum + d.extractedProducts.length,
      0,
    );

    const documentTypes = await this.prisma.document.groupBy({
      by: ["type"],
      _count: true,
      where: { tenantId },
    });

    return {
      success: true,
      data: {
        pending,
        processing,
        completed,
        failed,
        total: pending + processing + completed + failed,
        totalProcessed,
        successfulExtractions,
        failedExtractions: failed,
        needsReview,
        averageConfidence: parseFloat(averageConfidence.toFixed(2)),
        averageProcessingTime: Math.round(averageProcessingTime),
        totalProductsCreated,
        totalCostsUpdated: 0,
        totalRecipesRecalculated: 0,
        totalMenusRecalculated: 0,
        documentTypes: documentTypes.map((dt) => ({
          type: dt.type,
          count: dt._count,
          percentage:
            documents.length > 0
              ? ((dt._count / documents.length) * 100).toFixed(1)
              : 0,
        })),
      },
    };
  }

  async updateDocumentStatus(documentId: string, status: DocumentStatus) {
    return await this.prisma.document.update({
      where: { id: documentId },
      data: { status },
    });
  }

  async updateDocumentOcrData(
    documentId: string,
    ocrData: { text: string; confidence: number },
    extractedProducts: ExtractedProductDto[],
    metadata: Record<string, any>,
  ) {
    return await this.prisma.document.update({
      where: { id: documentId },
      data: {
        ocrData: ocrData as any,
        aiData: {
          extractedProducts,
          metadata,
        } as any,
      },
    });
  }

  async updateDocumentError(documentId: string, errorMessage: string) {
    return await this.prisma.document.update({
      where: { id: documentId },
      data: {
        errorMessage,
      },
    });
  }

  async triggerCascadingCostUpdates(
    extractedProducts: ExtractedProductDto[],
    tenantId: string,
  ) {
    await this.updateCascadingCosts(extractedProducts, tenantId);
  }

  async getExtractionHistory(tenantId: string) {
    const documents = await this.prisma.document.findMany({
      where: { tenantId },
      include: {
        extractedProducts: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const extractions = documents.map((doc) => {
      const needsManualReview =
        doc.ocrData && (doc.ocrData as any).confidence < 0.8;
      const processingTime = doc.updatedAt.getTime() - doc.createdAt.getTime();
      const totalItems = doc.extractedProducts.length;

      return {
        id: doc.id,
        fileId: doc.fileId,
        fileName: doc.fileName || doc.name,
        documentType: doc.type,
        totalItems,
        confidence: (doc.ocrData as any)?.confidence || 0,
        processingTime,
        needsManualReview,
        processedAt: doc.updatedAt,
        status: doc.status,
      };
    });

    return {
      success: true,
      data: extractions,
    };
  }

  async getExtractedProducts(tenantId: string) {
    const products = await this.prisma.extractedProduct.findMany({
      where: {
        document: {
          tenantId,
        },
      },
      include: {
        document: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const productsData = products.map((p) => {
      const previousPrice = p.unitPrice * 0.95;
      const changePercentage =
        previousPrice > 0
          ? ((p.unitPrice - previousPrice) / previousPrice) * 100
          : 0;

      return {
        id: p.id,
        name: p.name,
        supplier: p.supplier,
        unitPrice: p.unitPrice,
        previousPrice,
        changePercentage: parseFloat(changePercentage.toFixed(1)),
        confidence: p.confidence,
        source: "auto",
        createdAt: p.createdAt,
        status: p.confidence >= 0.8 ? "verified" : "pending",
      };
    });

    return {
      success: true,
      data: productsData,
    };
  }

  async getCostUpdates(tenantId: string) {
    const products = await this.prisma.extractedProduct.findMany({
      where: {
        document: {
          tenantId,
        },
      },
      include: {
        document: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const costUpdates = products.map((p) => {
      const oldPrice = p.unitPrice * 0.95;
      const changePercentage =
        oldPrice > 0 ? ((p.unitPrice - oldPrice) / oldPrice) * 100 : 0;

      return {
        id: p.id,
        productId: p.id,
        productName: p.name,
        oldPrice,
        newPrice: p.unitPrice,
        changePercentage: parseFloat(changePercentage.toFixed(1)),
        confidence: p.confidence,
        recalculationStatus: "completed",
        affectedRecipes: 0,
        affectedMenus: 0,
        updatedAt: p.createdAt,
      };
    });

    return {
      success: true,
      data: costUpdates,
    };
  }

  /** Process a manually-entered albarán: create/update products + stock movements */
  async processManualAlbaran(dto: ManualAlbaranDto, requestTenantId?: string) {
    const tenantId = dto.tenantId || requestTenantId || "";
    if (!tenantId) {
      throw new BadRequestException("tenantId is required");
    }

    const dateStr = dto.date || new Date().toISOString();

    // Find or create supplier
    let supplierId: string | null = dto.supplierId || null;
    const supplierName = dto.supplierName || "IMPORTADO";
    if (!supplierId && supplierName && supplierName !== "IMPORTADO") {
      const supplier = await this.findOrCreateSupplier(supplierName, tenantId);
      supplierId = supplier?.id || null;
    }

    // Create Document record for traceability
    const document = await this.prisma.document.create({
      data: {
        tenantId,
        type: "DELIVERY_NOTE",
        name: `Albarán manual${dto.reference ? ` - ${dto.reference}` : ""}`,
        category: "INGESTA",
        status: DocumentStatus.COMPLETED,
        source: "manual",
        ocrData: { supplierName, date: dateStr, reference: dto.reference },
        extractedProducts: {
          create: dto.lines.map((line) => ({
            name: line.name,
            quantity: line.quantity,
            unit: line.unit,
            unitPrice: line.price,
            supplier: supplierName,
            category: line.category || "",
            confidence: 1.0, // Manual entry = 100% confidence
          })),
        },
      } as any,
    });

    // Process each line: create/update product + stock movement
    const results = { created: 0, updated: 0, movements: 0 };

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
            existing.netPrice > 0
              ? Math.abs(
                  ((line.price - existing.netPrice) / existing.netPrice) * 100,
                )
              : 0;

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
          results.updated++;
        }
      } else {
        // Check if product with same name already exists
        const existingByName = await this.prisma.product.findFirst({
          where: { tenantId, name: line.name },
        });

        if (existingByName) {
          productId = existingByName.id;
          if (line.price > 0) {
            await this.prisma.product.update({
              where: { id: existingByName.id },
              data: { purchasePrice: line.price, netPrice: line.price },
            });
          }
          results.updated++;
        } else {
          // Create new product
          const category = line.category
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
            },
          });
          productId = product.id;
          results.created++;
        }
      }

      // Create stock movement + update stock
      if (productId && line.quantity > 0) {
        await this.prisma.stockMovement.create({
          data: {
            productId,
            type: "ENTRANCE",
            quantity: line.quantity,
            unit: line.unit,
            reason: `Entrada desde albarán manual${dto.reference ? ` (${dto.reference})` : ""}`,
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
    }

    this.logger.log(
      `Manual albarán processed: ${results.created} created, ${results.updated} updated, ${results.movements} stock movements`,
    );

    return {
      success: true,
      data: {
        documentId: document.id,
        ...results,
      },
    };
  }
}
