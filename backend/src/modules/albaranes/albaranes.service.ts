import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { AlbaranStatusService } from "./services/albaran-status.service";
import { AlbaranNumberService } from "./services/albaran-number.service";
import { SupplierMatchingService } from "./services/supplier-matching.service";
import { LineMatchingService } from "./services/line-matching.service";
import { PythonOcrService } from "../ocr/python-ocr.service";
import { OcrConfigService } from "../ocr-config/ocr-config.service";
import { ProductSupplierOffersService } from "../products/product-supplier-offers.service";
import { CreateAlbaranDto } from "./dto/create-albaran.dto";
import {
  UpdateAlbaranDto,
  UpdateAlbaranLineDto,
  CorrectAlbaranLinePriceDto,
} from "./dto/update-albaran.dto";
import { AlbaranQueryDto } from "./dto/albaran-query.dto";
import { AlbaranStatus, LineStatus, PurchaseOrderStatus } from "@prisma/client";

@Injectable()
export class AlbaranesService {
  private readonly logger = new Logger(AlbaranesService.name);

  // Prefijos autogenerados cuando no hay número real (usuario no lo rellenó
  // en el alta manual, o el OCR no lo detectó). No son números de proveedor:
  // compararlos daría un "duplicado" en cada nuevo albarán sin número.
  private static readonly SYNTHETIC_NUMBER_PREFIXES = [
    "MANUAL-",
    "OCR-",
    "FALLBACK-",
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly statusService: AlbaranStatusService,
    private readonly numberService: AlbaranNumberService,
    private readonly supplierMatching: SupplierMatchingService,
    private readonly lineMatching: LineMatchingService,
    private readonly pythonOcrService: PythonOcrService,
    private readonly ocrConfigService: OcrConfigService,
    private readonly productSupplierOffersService: ProductSupplierOffersService,
  ) {}

  /** Create albaran with lines from manual entry */
  async create(dto: CreateAlbaranDto, tenantId: string) {
    const internalNumber =
      await this.numberService.generateInternalNumber(tenantId);

    return this.prisma.albaran.create({
      data: {
        tenantId,
        internalNumber,
        supplierId: dto.supplierId,
        albaranNumber: dto.albaranNumber,
        date: dto.date ? new Date(dto.date) : new Date(),
        grossAmount: dto.grossAmount ?? 0,
        base: dto.base ?? 0,
        vatTotal: dto.vatTotal ?? 0,
        vatBreakdown: dto.vatBreakdown ?? undefined,
        total: dto.total ?? 0,
        warehouseId: dto.warehouseId,
        purchaseOrderId: dto.purchaseOrderId,
        notes: dto.notes,
        applyDiscountToCost: dto.applyDiscountToCost ?? false,
        lines: {
          create: dto.lines.map((line) => ({
            articleNumber: line.articleNumber,
            lot: line.lot,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit ?? "ud",
            unitPrice: line.unitPrice,
            vatPercent: line.vatPercent ?? 10,
            priceWithVat: line.priceWithVat,
            // Importe neto del papel (con descuento si lo hay). Se persiste para
            // mostrarlo y, si el usuario activa applyDiscountToCost, usarlo de base
            // de coste al confirmar. lineAmount sigue siendo el bruto qty × precio.
            totalPrice: line.totalPrice ?? null,
            lineAmount: line.lineAmount ?? line.quantity * line.unitPrice,
          })),
        },
      },
      include: { lines: true, supplier: true },
    });
  }

  /**
   * Advisory-only: busca un albarán ya existente (no borrado) del mismo
   * proveedor con el mismo número. No bloquea la creación, solo informa —
   * el mismo número puede repetirse legítimamente entre proveedores
   * distintos, o el usuario puede querer corregir un alta anterior mal
   * hecha. `excludeId` evita el falso positivo del propio albarán al editar.
   */
  async checkDuplicate(
    tenantId: string,
    supplierId: string | undefined,
    albaranNumber: string | undefined,
    excludeId?: string,
  ) {
    const trimmed = (albaranNumber ?? "").trim();
    if (!supplierId || !trimmed) {
      return null;
    }
    if (
      AlbaranesService.SYNTHETIC_NUMBER_PREFIXES.some((prefix) =>
        trimmed.startsWith(prefix),
      )
    ) {
      return null;
    }

    return this.prisma.albaran.findFirst({
      where: {
        tenantId,
        supplierId,
        albaranNumber: { equals: trimmed, mode: "insensitive" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: {
        id: true,
        albaranNumber: true,
        date: true,
        status: true,
        total: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /** List albaranes with filters and pagination */
  async findAll(query: AlbaranQueryDto, tenantId: string) {
    const where: any = { tenantId };

    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }
    if (query.status) {
      where.status = query.status;
    } else {
      // Los archivados solo se muestran pidiéndolos explícitamente (pestaña Archivados)
      where.status = { not: AlbaranStatus.ARCHIVADO };
    }
    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) {
        where.date.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.date.lte = new Date(query.dateTo);
      }
    }
    if (query.search) {
      where.OR = [
        { albaranNumber: { contains: query.search, mode: "insensitive" } },
        { internalNumber: { contains: query.search, mode: "insensitive" } },
        { notes: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.albaran.findMany({
        where,
        include: { supplier: true, _count: { select: { lines: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.albaran.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Get single albaran with lines and matched products */
  async findOne(id: string, tenantId: string) {
    const albaran = await this.prisma.albaran.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        warehouse: true,
        purchaseOrder: {
          select: { id: true, orderNumber: true, status: true },
        },
        lines: {
          include: { matchedProduct: true, suggestedProduct: true },
          orderBy: [{ lineOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!albaran) {
      throw new NotFoundException("Albarán no encontrado");
    }
    return albaran;
  }

  /** Update albaran header (only in PENDIENTE/REVISADO) */
  async update(id: string, dto: UpdateAlbaranDto, tenantId: string) {
    const albaran = await this.findOne(id, tenantId);

    if (
      albaran.status === AlbaranStatus.CONFIRMADO ||
      albaran.status === AlbaranStatus.ARCHIVADO
    ) {
      throw new BadRequestException(
        "No se puede editar un albarán confirmado o archivado",
      );
    }

    return this.prisma.albaran.update({
      where: { id },
      data: {
        supplierId: dto.supplierId,
        albaranNumber: dto.albaranNumber,
        notes: dto.notes,
        warehouseId: dto.warehouseId,
        // undefined (no viene en el body) no toca el campo; null desvincula
        purchaseOrderId: dto.purchaseOrderId,
        applyDiscountToCost: dto.applyDiscountToCost,
      },
      include: { lines: true, supplier: true, purchaseOrder: true },
    });
  }

  /** Update a single line */
  async updateLine(
    albaranId: string,
    lineId: string,
    dto: UpdateAlbaranLineDto,
    tenantId: string,
  ) {
    const albaran = await this.findOne(albaranId, tenantId);

    // Edición genérica solo antes de confirmar: en un albarán confirmado el
    // precio ya se propagó a oferta/coste/histórico/pedido y este endpoint
    // no re-sincroniza nada (dejaría costes desincronizados en silencio).
    // La corrección post-confirmación pasa por correctConfirmedLinePrice.
    if (
      albaran.status === AlbaranStatus.CONFIRMADO ||
      albaran.status === AlbaranStatus.ARCHIVADO
    ) {
      throw new BadRequestException(
        "No se puede editar una línea de un albarán confirmado o archivado. " +
          "Usa la corrección de precio.",
      );
    }

    const line = await this.prisma.albaranLine.findFirst({
      where: { id: lineId, albaranId },
    });
    if (!line) {
      throw new NotFoundException("Línea no encontrada");
    }

    const updateData: any = {};
    if (dto.articleNumber !== undefined) {
      updateData.articleNumber = dto.articleNumber;
    }
    if (dto.lot !== undefined) {
      updateData.lot = dto.lot;
    }
    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }
    if (dto.quantity !== undefined) {
      updateData.quantity = parseFloat(dto.quantity);
      // Recalculate lineAmount when quantity changes
      const price =
        dto.unitPrice !== undefined
          ? parseFloat(dto.unitPrice)
          : line.unitPrice;
      updateData.lineAmount = updateData.quantity * price;
    }
    if (dto.unit !== undefined) {
      updateData.unit = dto.unit;
    }
    if (dto.unitPrice !== undefined) {
      const price = parseFloat(dto.unitPrice);
      updateData.unitPrice = price;
      // Recalculate lineAmount when price changes (unless quantity already updated it)
      if (dto.quantity === undefined) {
        updateData.lineAmount = line.quantity * price;
      }
    }
    if (dto.vatPercent !== undefined) {
      updateData.vatPercent = parseFloat(dto.vatPercent);
      // Recalculate priceWithVat if not explicitly provided
      const unitPrice =
        dto.unitPrice !== undefined
          ? parseFloat(dto.unitPrice)
          : line.unitPrice;
      updateData.priceWithVat = unitPrice * (1 + updateData.vatPercent / 100);
    }
    if (dto.priceWithVat !== undefined) {
      updateData.priceWithVat = parseFloat(dto.priceWithVat);
    }
    if (dto.matchedProductId !== undefined) {
      updateData.matchedProductId = dto.matchedProductId;
    }

    return this.prisma.albaranLine.update({
      where: { id: lineId },
      data: updateData,
    });
  }

  /**
   * Corrige el precio de una línea de un albarán YA confirmado y re-sincroniza
   * lo que la confirmación asentó con el precio erróneo: la oferta del
   * proveedor (vuelve a quedar preferente), el coste plano del artículo, el
   * histórico de precios y el precio recibido del pedido vinculado. No toca
   * stock ni lotes — la corrección es de precio; la cantidad no cambia.
   */
  async correctConfirmedLinePrice(
    albaranId: string,
    lineId: string,
    dto: CorrectAlbaranLinePriceDto,
    tenantId: string,
  ) {
    const albaran = await this.findOne(albaranId, tenantId);

    if (albaran.status !== AlbaranStatus.CONFIRMADO) {
      throw new BadRequestException(
        "Solo se pueden corregir precios de albaranes confirmados",
      );
    }

    const line = albaran.lines.find((l) => l.id === lineId);
    if (!line) {
      throw new NotFoundException("Línea no encontrada");
    }
    if (line.lineStatus !== LineStatus.CONFIRMADO) {
      throw new BadRequestException(
        "Solo se pueden corregir líneas confirmadas",
      );
    }
    if (!line.matchedProductId) {
      throw new BadRequestException(
        "La línea no tiene artículo vinculado: no hay coste que corregir",
      );
    }

    const unitPrice = parseFloat(dto.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new BadRequestException("Precio corregido no válido");
    }
    // Neto del papel: null explícito lo limpia; ausente conserva el actual.
    const totalPrice =
      dto.totalPrice === undefined
        ? line.totalPrice
        : dto.totalPrice === null
          ? null
          : parseFloat(dto.totalPrice);
    if (
      totalPrice !== null &&
      (!Number.isFinite(totalPrice) || totalPrice < 0)
    ) {
      throw new BadRequestException("Importe neto no válido");
    }

    const quantity = Number(line.quantity);
    // Mismo coste efectivo que asentó la confirmación (albaran-stock.service):
    // con "aplicar descuento al coste" y neto del papel, manda el neto/qty.
    const effectivePrice =
      albaran.applyDiscountToCost && totalPrice !== null && quantity > 0
        ? totalPrice / quantity
        : unitPrice;

    const productId = line.matchedProductId;
    const supplierId = albaran.supplierId;

    return this.prisma.$transaction(async (tx) => {
      const updatedLine = await tx.albaranLine.update({
        where: { id: lineId },
        data: {
          unitPrice,
          lineAmount: quantity * unitPrice,
          totalPrice,
        },
      });

      if (supplierId) {
        // Reusa el pipeline de la confirmación: upsert de oferta + preferencia
        // + sync del artículo + fila de histórico con traza al albarán.
        await this.productSupplierOffersService.upsertOffer(
          productId,
          supplierId,
          tenantId,
          { purchasePrice: effectivePrice, netPrice: effectivePrice },
          tx,
          albaranId,
          true,
        );
      } else {
        // Albarán sin proveedor (raro): fallback plano, igual que en la
        // confirmación — no existe oferta donde escribir.
        const product = await tx.product.findFirst({
          where: { id: productId, tenantId },
        });
        if (!product) {
          throw new NotFoundException("Artículo no encontrado");
        }
        const currentPrice = Number(product.purchasePrice);
        await tx.product.update({
          where: { id: product.id },
          data: {
            previousPurchasePrice: currentPrice,
            purchasePrice: effectivePrice,
            netPrice: effectivePrice,
          },
        });
        await tx.productPriceHistory.create({
          data: {
            tenantId,
            productId: product.id,
            supplierId: null,
            albaranId,
            previousPrice: currentPrice,
            newPrice: effectivePrice,
            previousUnitSize: product.unitSize,
            newUnitSize: product.unitSize,
          },
        });
      }

      // Pedido vinculado: re-vuelca el precio recibido en su formato de
      // compra (misma conversión que la conciliación: unitPrice × uds/formato).
      if (albaran.purchaseOrderId) {
        const product = await tx.product.findFirst({
          where: { id: productId, tenantId },
          select: { unitsPerFormat: true },
        });
        const unitsPerFormat = Math.max(product?.unitsPerFormat ?? 1, 1);
        await tx.purchaseOrderLine.updateMany({
          where: { orderId: albaran.purchaseOrderId, productId },
          data: { receivedPrice: unitPrice * unitsPerFormat },
        });
      }

      return updatedLine;
    });
  }

  /** Assign a product match to a line (user override) */
  async matchLine(
    albaranId: string,
    lineId: string,
    productId: string,
    tenantId: string,
    userId?: string,
  ) {
    const albaran = await this.findOne(albaranId, tenantId);

    const line = albaran.lines.find((l) => l.id === lineId);
    if (!line) {
      throw new NotFoundException("Línea no encontrada");
    }

    // Verify product exists and belongs to tenant
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) {
      throw new NotFoundException("Producto no encontrado");
    }

    const updatedLine = await this.prisma.albaranLine.update({
      where: { id: lineId },
      data: {
        matchedProductId: productId,
        matchStatus: "MATCH_ALTO",
        confidence: 1.0,
      },
    });

    // Recuerda esta corrección para el mismo proveedor: la próxima vez que
    // escriba el mismo texto no hará falta repetir el match a mano.
    if (albaran.supplierId) {
      await this.lineMatching.rememberAlias({
        tenantId,
        supplierId: albaran.supplierId,
        description: line.description,
        productId,
        confirmedBy: userId,
      });
    }

    return updatedLine;
  }

  /**
   * Discard the auto-suggested product for a line (user says "not this
   * one"). Persiste el descarte: matchAllLines no debe volver a rellenar
   * suggestedProductId para esta línea en un re-match futuro.
   */
  async dismissSuggestion(albaranId: string, lineId: string, tenantId: string) {
    await this.findOne(albaranId, tenantId);

    const line = await this.prisma.albaranLine.findFirst({
      where: { id: lineId, albaranId },
    });
    if (!line) {
      throw new NotFoundException("Línea no encontrada");
    }

    return this.prisma.albaranLine.update({
      where: { id: lineId },
      data: { suggestedProductId: null, suggestionDismissed: true },
    });
  }

  /** Confirm or reject a line */
  async setLineStatus(
    albaranId: string,
    lineId: string,
    status: "CONFIRMADO" | "RECHAZADO",
    tenantId: string,
  ) {
    await this.findOne(albaranId, tenantId);

    const line = await this.prisma.albaranLine.findFirst({
      where: { id: lineId, albaranId },
    });
    if (!line) {
      throw new NotFoundException("Línea no encontrada");
    }

    if (status === "CONFIRMADO" && !line.matchedProductId) {
      throw new BadRequestException(
        "No se puede confirmar una línea sin producto asignado",
      );
    }

    return this.prisma.albaranLine.update({
      where: { id: lineId },
      data: { lineStatus: status },
    });
  }

  /** Transition albaran status */
  async updateStatus(id: string, newStatus: AlbaranStatus, tenantId: string) {
    await this.statusService.transitionStatus(id, tenantId, newStatus);
    return this.findOne(id, tenantId);
  }

  /** Delete albaran (only PENDIENTE or REVISADO) */
  async remove(id: string, tenantId: string) {
    let albaran;
    try {
      albaran = await this.findOne(id, tenantId);
    } catch (err) {
      // findOne() usa findFirst, que el middleware de soft-delete filtra por
      // deletedAt = null, así que NO distingue "no existe" de "ya borrado".
      // Hacemos el borrado idempotente: si el albarán ya está en la papelera,
      // respondemos éxito en vez de 404, para que un reintento (timeout de red,
      // doble-clic o pestaña con caché de React Query) no se traduzca en error.
      if (err instanceof NotFoundException) {
        const [existing] = await this.prisma.$queryRaw<
          { deletedAt: Date | null }[]
        >`SELECT "deletedAt" FROM albaranes WHERE id = ${id} AND "tenantId" = ${tenantId} LIMIT 1`;
        if (existing) {
          return { id, alreadyDeleted: true, deletedAt: existing.deletedAt };
        }
      }
      throw err;
    }

    if (
      albaran.status === AlbaranStatus.CONFIRMADO ||
      albaran.status === AlbaranStatus.ARCHIVADO
    ) {
      throw new BadRequestException(
        "No se puede eliminar un albarán confirmado o archivado",
      );
    }

    return this.prisma.albaran.delete({ where: { id } });
  }

  /** Create albaran from OCR upload */
  async createFromUpload(
    files: Express.Multer.File[],
    tenantId: string,
    aiModel?: string,
    aiApiKey?: string,
    purchaseOrderId?: string,
  ) {
    this.logger.log(
      `Creating albaran from upload for tenant ${tenantId} (${files.length} files, AI: ${aiModel || "regex"})`,
    );

    if (!files || files.length === 0) {
      throw new BadRequestException("No file provided");
    }

    // Subida desde el detalle de un pedido: valida que el pedido admita
    // recepción y usa su proveedor como respaldo si el OCR no matchea uno.
    let purchaseOrder: { id: string; supplierId: string } | null = null;
    if (purchaseOrderId) {
      purchaseOrder = await this.prisma.purchaseOrder.findFirst({
        where: {
          id: purchaseOrderId,
          tenantId,
          status: {
            in: [
              PurchaseOrderStatus.ENVIADO,
              PurchaseOrderStatus.RECIBIDO_PARCIAL,
            ],
          },
        },
        select: { id: true, supplierId: true },
      });
      if (!purchaseOrder) {
        throw new BadRequestException(
          "El pedido de compra no existe o no está en un estado que admita recepción",
        );
      }
    }

    try {
      // 1. Resolver motor IA + API key: prioriza lo que envíe el cliente
      //    (backward compat con localStorage) y, si no trae nada, usa la config
      //    guardada del tenant (multi-device: un móvil sin key usa la IA igual).
      const { aiModel: effModel, aiApiKey: effKey } =
        await this.ocrConfigService.resolveForUpload(tenantId, {
          aiModel,
          aiApiKey,
        });

      // 2. Process every file via Python OCR microservice (secuencial: el
      //    microservicio es un proceso único con timeouts de 120s/request,
      //    paralelizar no aporta nada para el caso típico de 2-3 hojas).
      //    Un fallo de un archivo se captura localmente y no debe tirar todo
      //    el upload al fallback vacío si al menos uno tuvo éxito — es
      //    justo el bug que se corrige aquí (antes solo se usaba files[0]
      //    y el resto se descartaba en silencio).
      const successfulDocuments: Array<{ filename: string; document: any }> =
        [];
      const failedFiles: Array<{ filename: string; reason: string }> = [];

      for (const uploadedFile of files) {
        try {
          const ocrResult = await this.pythonOcrService.processImage(
            uploadedFile.buffer,
            uploadedFile.originalname,
            uploadedFile.mimetype,
            effModel,
            effKey,
          );
          if (ocrResult.success && ocrResult.document) {
            successfulDocuments.push({
              filename: uploadedFile.originalname,
              document: ocrResult.document,
            });
          } else {
            failedFiles.push({
              filename: uploadedFile.originalname,
              reason: ocrResult.error || "OCR sin éxito",
            });
          }
        } catch (err: any) {
          failedFiles.push({
            filename: uploadedFile.originalname,
            reason: err.message,
          });
        }
      }

      if (successfulDocuments.length === 0) {
        throw new Error(
          `OCR falló en los ${files.length} archivo(s): ` +
            failedFiles.map((f) => `${f.filename} (${f.reason})`).join(", "),
        );
      }

      const document = this.mergeOcrDocuments(successfulDocuments);
      const extractedProducts = document.products || [];

      this.logger.log(
        `OCR result: supplier="${document.supplier_name || "N/A"}", ` +
          `products=${extractedProducts.length}, confidence=${((document.confidence || 0) * 100).toFixed(1)}%, ` +
          `files=${successfulDocuments.length}/${files.length} OK` +
          (failedFiles.length > 0
            ? `, fallos=${failedFiles.map((f) => f.filename).join(", ")}`
            : ""),
      );

      // 2. Match supplier from OCR-detected data
      const supplierMatch = await this.supplierMatching.matchSupplier({
        cifNif: document.supplier_cif || document.cif_code,
        name: document.supplier_name,
        tenantId,
      });

      // 2a. Auto-fill supplier data from OCR (address, phone, email, sanitary registry)
      if (supplierMatch.supplierId) {
        await this.supplierMatching.enrichSupplierFromOcr(
          supplierMatch.supplierId,
          {
            legalName: document.supplier_name,
            address: document.supplier_address,
            phone: document.supplier_phone,
            email: document.supplier_email,
            sanitaryRegistry: document.supplier_sanitary_registry,
          },
        );
      }

      // 2b. If supplier has OCR layout hints, refine extraction
      if (supplierMatch.supplierId) {
        const supplier = await this.prisma.supplier.findFirst({
          where: { id: supplierMatch.supplierId, tenantId },
          select: { ocrLayoutHints: true },
        });
        if (supplier?.ocrLayoutHints && document.raw_text) {
          this.logger.log(
            `Refinando OCR con hints de proveedor (obs: ${(supplier.ocrLayoutHints as any)?.observationCount})`,
          );
          const refinedResult = await this.pythonOcrService.refineExtraction(
            document.raw_text,
            supplier.ocrLayoutHints,
            aiModel,
            aiApiKey,
          );
          if (refinedResult.success && refinedResult.document) {
            // Override initial extraction with refined data
            Object.assign(document, refinedResult.document);
            this.logger.log(
              `OCR refinado: ${refinedResult.document.products?.length || 0} productos`,
            );
          }
        }
      }

      // Registrar el modelo que hizo la extracción (se muestra en la UI);
      // se estampa después del refine para que Object.assign no lo pise
      if ((document as any).extraction_method === "ai" && aiModel) {
        (document as any).extraction_model = aiModel;
      }

      // 3. Create albaran with lines
      const internalNumber =
        await this.numberService.generateInternalNumber(tenantId);
      const albaran = await this.prisma.albaran.create({
        data: {
          tenantId,
          internalNumber,
          // Si el OCR no matchea proveedor, el del pedido de origen es mejor
          // dato que dejarlo vacío: ya sabemos a quién se le compró.
          supplierId: supplierMatch.supplierId ?? purchaseOrder?.supplierId,
          purchaseOrderId: purchaseOrder?.id,
          albaranNumber: document.document_number || `OCR-${Date.now()}`,
          date: document.document_date
            ? new Date(document.document_date)
            : new Date(),
          grossAmount: document.gross_amount ?? 0,
          base: document.tax_base ?? document.gross_amount ?? 0,
          vatTotal: document.vat_total ?? 0,
          vatBreakdown: document.vat_breakdown ?? undefined,
          total: document.total_amount || 0,
          ocrRawData: document as any,
          notes:
            `Importado desde OCR (confianza: ${((document.confidence || 0) * 100).toFixed(0)}%)` +
            (failedFiles.length > 0
              ? ` Aviso: ${failedFiles.length} de ${files.length} archivo(s) no se pudieron procesar (${failedFiles.map((f) => `${f.filename}: ${f.reason}`).join("; ")}) — revisa si faltan líneas.`
              : ""),
          lines: {
            // lineOrder preserva el orden del documento: createdAt no sirve de
            // desempate (create anidado = misma transacción = mismo now() para
            // todas las líneas), y el matching en segundo plano reordena
            // físicamente las filas al hacer UPDATE por línea.
            create: extractedProducts.map((product: any, index: number) => ({
              articleNumber: product.article_number || null,
              lot: product.lot || null,
              description: product.name || product.description || "",
              quantity: product.quantity || 0,
              unit: product.unit || "ud",
              unitPrice: product.unit_price || 0,
              vatPercent: product.vat_percent ?? 10,
              priceWithVat: product.price_with_vat ?? null,
              // Importe neto leído del papel por el OCR (sin IVA, con descuento).
              // El OCR puede traer qty/unit_price que no cuadran con este total
              // cuando hay un descuento; el papel manda para mostrar el neto.
              totalPrice: product.total_price ?? null,
              lineAmount: (product.quantity || 0) * (product.unit_price || 0),
              lineOrder: index,
            })),
          },
        },
        include: { lines: true, supplier: true },
      });

      // 4. Run line matching antes de responder: el resumen que se muestra
      // justo tras subir el archivo (subir/page.tsx) lee matchStatus/confidence
      // de esta respuesta, así que si corriera en background (como antes)
      // esos campos saldrían vacíos y el badge mostraría siempre "Nuevo".
      await this.lineMatching
        .matchAllLines(albaran.id, tenantId)
        .catch((err) => {
          this.logger.error(
            `Line matching failed for albaran ${albaran.id}: ${err.message}`,
          );
        });

      const matchedAlbaran = await this.prisma.albaran.findFirst({
        where: { id: albaran.id, tenantId },
        include: { lines: true, supplier: true },
      });

      this.logger.log(
        `Albaran created from upload: ${albaran.id} with ${albaran.lines.length} lines`,
      );

      return matchedAlbaran ?? albaran;
    } catch (error) {
      this.logger.error(
        `Failed to create albaran from upload: ${error.message}`,
      );

      // Create a pending albaran with minimal data as fallback
      const internalNumber =
        await this.numberService.generateInternalNumber(tenantId);
      const albaran = await this.prisma.albaran.create({
        data: {
          tenantId,
          internalNumber,
          supplierId: purchaseOrder?.supplierId,
          purchaseOrderId: purchaseOrder?.id,
          albaranNumber: `FALLBACK-${Date.now()}`,
          date: new Date(),
          base: 0,
          vatTotal: 0,
          total: 0,
          notes: `Error en OCR: ${error.message}. Requiere revisión manual.`,
          status: AlbaranStatus.PENDIENTE,
        },
        include: { lines: true },
      });

      this.logger.warn(
        `Created fallback albaran ${albaran.id} due to OCR failure`,
      );
      return albaran;
    }
  }

  /**
   * Fusiona los documentos OCR de varios archivos (p.ej. las hojas 1 y 2 de
   * un mismo albarán de papel) en un único documento: productos concatenados
   * en orden de subida, campos de cabecera con "primer valor no vacío gana"
   * (no se asume que la cabecera esté siempre en la primera hoja), confianza
   * media, y raw_text concatenado para que el refine por layout hints siga
   * viendo todo el texto. Con un solo documento de entrada, el resultado es
   * observacionalmente idéntico al documento original (no-regresión).
   */
  private mergeOcrDocuments(
    successfulDocuments: Array<{ filename: string; document: any }>,
  ): any {
    const merged: any = { ...successfulDocuments[0].document };

    merged.products = successfulDocuments.flatMap(
      (d) => d.document.products || [],
    );

    const headerFields = [
      "supplier_name",
      "supplier_cif",
      "cif_code",
      "supplier_address",
      "supplier_phone",
      "supplier_email",
      "supplier_sanitary_registry",
      "document_number",
      "document_date",
      "gross_amount",
      "tax_base",
      "vat_total",
      "vat_breakdown",
      "total_amount",
    ];
    for (const field of headerFields) {
      if (!merged[field]) {
        const withValue = successfulDocuments.find((d) => d.document[field]);
        if (withValue) {
          merged[field] = withValue.document[field];
        }
      }
    }

    const confidences = successfulDocuments.map(
      (d) => d.document.confidence || 0,
    );
    merged.confidence =
      confidences.reduce((sum, c) => sum + c, 0) / confidences.length;

    merged.raw_text = successfulDocuments
      .map((d) => d.document.raw_text || "")
      .filter(Boolean)
      .join("\n\n--- página siguiente ---\n\n");

    return merged;
  }

  /**
   * Add a manual line to an existing albarán.
   * Only allowed when albarán is PENDIENTE or REVISADO.
   */
  async addLine(albaranId: string, dto: any, tenantId: string) {
    const albaran = await this.prisma.albaran.findFirst({
      where: { id: albaranId, tenantId },
      include: { lines: true },
    });

    if (!albaran) {
      throw new NotFoundException("Albarán no encontrado");
    }

    if (albaran.status !== "PENDIENTE" && albaran.status !== "REVISADO") {
      throw new BadRequestException(
        "No se pueden añadir líneas a un albarán confirmado o archivado",
      );
    }

    const quantity = Number(dto.quantity) || 0;
    const unitPrice = Number(dto.unitPrice) || 0;
    const vatPercent = Number(dto.vatPercent) || 10;
    const lineAmount = quantity * unitPrice;

    const line = await this.prisma.albaranLine.create({
      data: {
        albaranId,
        description: dto.description,
        quantity,
        unit: dto.unit || "kilo",
        unitPrice,
        vatPercent,
        lineAmount,
        articleNumber: dto.articleNumber || null,
        lot: dto.lot || null,
        // Añadida al final del documento, detrás de las líneas existentes
        lineOrder: albaran.lines.length,
      },
    });

    // Recalculate albaran totals from all lines
    const allLines = [...albaran.lines, line];
    const base = allLines.reduce((sum, l) => sum + Number(l.lineAmount), 0);
    const vatTotal = allLines.reduce(
      (sum, l) => sum + Number(l.lineAmount) * (Number(l.vatPercent) / 100),
      0,
    );
    const total = base + vatTotal;

    await this.prisma.albaran.update({
      where: { id: albaranId },
      data: { base, vatTotal, total },
    });

    return { success: true, data: line };
  }
}
