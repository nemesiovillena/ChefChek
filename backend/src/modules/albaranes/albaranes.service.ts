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
import { CreateAlbaranDto } from "./dto/create-albaran.dto";
import {
  UpdateAlbaranDto,
  UpdateAlbaranLineDto,
} from "./dto/update-albaran.dto";
import { AlbaranQueryDto } from "./dto/albaran-query.dto";
import { AlbaranStatus } from "@prisma/client";

@Injectable()
export class AlbaranesService {
  private readonly logger = new Logger(AlbaranesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly statusService: AlbaranStatusService,
    private readonly numberService: AlbaranNumberService,
    private readonly supplierMatching: SupplierMatchingService,
    private readonly lineMatching: LineMatchingService,
    private readonly pythonOcrService: PythonOcrService,
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
            lineAmount: line.lineAmount ?? line.quantity * line.unitPrice,
          })),
        },
      },
      include: { lines: true, supplier: true },
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
          include: { matchedProduct: true },
          orderBy: { createdAt: "asc" },
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
    await this.findOne(albaranId, tenantId);

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

  /** Assign a product match to a line (user override) */
  async matchLine(
    albaranId: string,
    lineId: string,
    productId: string,
    tenantId: string,
  ) {
    await this.findOne(albaranId, tenantId);

    // Verify product exists and belongs to tenant
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) {
      throw new NotFoundException("Producto no encontrado");
    }

    return this.prisma.albaranLine.update({
      where: { id: lineId },
      data: {
        matchedProductId: productId,
        matchStatus: "MATCH_ALTO",
        confidence: 1.0,
      },
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
    const albaran = await this.findOne(id, tenantId);

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
  ) {
    this.logger.log(
      `Creating albaran from upload for tenant ${tenantId} (${files.length} files, AI: ${aiModel || "regex"})`,
    );

    const file = files[0];
    if (!file) {
      throw new BadRequestException("No file provided");
    }

    try {
      // 1. Process file via Python OCR microservice (buffer directly, no disk save needed)
      const ocrResult = await this.pythonOcrService.processImage(
        file.buffer,
        file.originalname,
        file.mimetype,
        aiModel,
        aiApiKey,
      );

      if (!ocrResult.success || !ocrResult.document) {
        throw new Error(
          `OCR processing returned no results: ${ocrResult.error || "unknown error"}`,
        );
      }

      const document = ocrResult.document;
      const extractedProducts = document.products || [];

      this.logger.log(
        `OCR result: supplier="${document.supplier_name || "N/A"}", ` +
          `products=${extractedProducts.length}, confidence=${((document.confidence || 0) * 100).toFixed(1)}%`,
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
          supplierId: supplierMatch.supplierId,
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
          notes: `Importado desde OCR (confianza: ${((document.confidence || 0) * 100).toFixed(0)}%)`,
          lines: {
            create: extractedProducts.map((product: any) => ({
              articleNumber: product.article_number || null,
              lot: product.lot || null,
              description: product.name || product.description || "",
              quantity: product.quantity || 0,
              unit: product.unit || "ud",
              unitPrice: product.unit_price || 0,
              vatPercent: product.vat_percent ?? 10,
              priceWithVat: product.price_with_vat ?? null,
              lineAmount: (product.quantity || 0) * (product.unit_price || 0),
            })),
          },
        },
        include: { lines: true, supplier: true },
      });

      // 4. Run line matching in background (non-blocking)
      this.lineMatching.matchAllLines(albaran.id, tenantId).catch((err) => {
        this.logger.error(
          `Line matching failed for albaran ${albaran.id}: ${err.message}`,
        );
      });

      this.logger.log(
        `Albaran created from upload: ${albaran.id} with ${albaran.lines.length} lines`,
      );

      return albaran;
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
        unit: dto.unit || "und",
        unitPrice,
        vatPercent,
        lineAmount,
        articleNumber: dto.articleNumber || null,
        lot: dto.lot || null,
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
