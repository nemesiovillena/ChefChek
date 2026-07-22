import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { CatalogImportStatus, CatalogLineStatus } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { PythonOcrService } from "../../ocr/python-ocr.service";
import { LineMatchingService } from "../../albaranes/services/line-matching.service";
import { ProductSupplierOffersService } from "../../products/product-supplier-offers.service";
import { PriceAgreementService } from "./price-agreement.service";
import { UpdateCatalogImportLineDto } from "../dto/catalog-import.dto";

const IMPORT_INCLUDE = {
  supplier: { select: { id: true, name: true } },
  lines: {
    orderBy: { createdAt: "asc" as const },
    include: {
      // purchasePrice/unitSize/referenceUnit: para poder comparar el precio
      // del catálogo contra el precio actual del artículo ya emparejado, sin
      // necesidad de aceptar/aplicar la línea primero (comparativa de solo
      // lectura en la revisión).
      matchedProduct: {
        select: {
          id: true,
          name: true,
          purchaseFormat: true,
          purchasePrice: true,
          unitSize: true,
          referenceUnit: true,
        },
      },
    },
  },
};

/**
 * Importación de tarifas/catálogos de proveedor vía IA (PDR §F6): sube un
 * archivo, extrae líneas propuestas y matchea contra artículos existentes.
 * NADA se escribe en ofertas hasta "aplicar" — y solo las líneas ACEPTADA
 * con un `matchedProductId` asignado se aplican (a diferencia de los
 * albaranes, un catálogo nunca crea productos nuevos automáticamente: es
 * una lista de precios, no una entrada de mercancía).
 */
@Injectable()
export class CatalogImportService {
  private readonly logger = new Logger(CatalogImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pythonOcrService: PythonOcrService,
    private readonly lineMatchingService: LineMatchingService,
    private readonly productSupplierOffersService: ProductSupplierOffersService,
    private readonly priceAgreementService: PriceAgreementService,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.catalogImport.findMany({
      where: { tenantId },
      include: {
        supplier: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(tenantId: string, id: string) {
    const catalogImport = await this.prisma.catalogImport.findFirst({
      where: { id, tenantId },
      include: IMPORT_INCLUDE,
    });
    if (!catalogImport) {
      throw new NotFoundException("Importación de catálogo no encontrada");
    }
    return catalogImport;
  }

  /**
   * Crea el registro en estado PROCESANDO y devuelve al instante: la
   * extracción real (potencialmente varios minutos en catálogos de decenas
   * de páginas) se lanza en background sin bloquear la respuesta HTTP. El
   * frontend hace polling de `findOne` mientras el estado sea PROCESANDO.
   */
  async createFromUpload(
    tenantId: string,
    supplierId: string,
    userId: string | undefined,
    file: { buffer: Buffer; filename: string; mimetype: string },
    aiModel: string,
    aiApiKey: string,
  ) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });
    if (!supplier) {
      throw new NotFoundException("Proveedor no encontrado");
    }

    const catalogImport = await this.prisma.catalogImport.create({
      data: {
        tenantId,
        supplierId,
        aiModel,
        createdBy: userId,
        status: CatalogImportStatus.PROCESANDO,
      },
    });

    this.processInBackground(
      tenantId,
      catalogImport.id,
      file,
      aiModel,
      aiApiKey,
    ).catch((error) => {
      this.logger.error(
        `Fallo no controlado procesando catálogo ${catalogImport.id}: ${error}`,
      );
    });

    return this.findOne(tenantId, catalogImport.id);
  }

  private async processInBackground(
    tenantId: string,
    catalogImportId: string,
    file: { buffer: Buffer; filename: string; mimetype: string },
    aiModel: string,
    aiApiKey: string,
  ) {
    try {
      const extraction = await this.pythonOcrService.processCatalog(
        file.buffer,
        file.filename,
        file.mimetype,
        aiModel,
        aiApiKey,
      );

      if (!extraction.success) {
        await this.markError(
          catalogImportId,
          extraction.error_message ||
            "No se pudo extraer el catálogo. Comprueba el modelo y la API key de IA.",
        );
        return;
      }
      if (extraction.products.length === 0) {
        await this.markError(
          catalogImportId,
          "La IA no encontró artículos en el documento.",
        );
        return;
      }

      for (const product of extraction.products) {
        const match = await this.lineMatchingService.matchLine({
          description: product.name,
          articleNumber: product.article_number ?? undefined,
          tenantId,
        });
        await this.prisma.catalogImportLine.create({
          data: {
            catalogImportId,
            rawName: product.name,
            articleNumber: product.article_number,
            purchaseFormat: product.purchase_format,
            unitPrice: product.unit_price,
            matchedProductId: match.matchedProductId,
            matchStatus: match.matchStatus,
            confidence: match.confidence,
          },
        });
      }

      await this.prisma.catalogImport.update({
        where: { id: catalogImportId },
        data: { status: CatalogImportStatus.PENDIENTE, errorMessage: null },
      });
    } catch (error: any) {
      await this.markError(
        catalogImportId,
        error?.message || "Error inesperado procesando el catálogo",
      );
    }
  }

  private async markError(catalogImportId: string, message: string) {
    await this.prisma.catalogImport.update({
      where: { id: catalogImportId },
      data: { status: CatalogImportStatus.ERROR, errorMessage: message },
    });
  }

  /** Acepta/rechaza una línea propuesta, o reasigna manualmente su artículo. */
  async updateLine(
    tenantId: string,
    catalogImportId: string,
    lineId: string,
    dto: UpdateCatalogImportLineDto,
  ) {
    const catalogImport = await this.assertEditable(tenantId, catalogImportId);
    const line = catalogImport.lines.find((l) => l.id === lineId);
    if (!line) {
      throw new NotFoundException("Línea no encontrada");
    }
    if (
      dto.lineStatus === CatalogLineStatus.ACEPTADA &&
      !dto.matchedProductId &&
      !line.matchedProductId
    ) {
      throw new BadRequestException(
        "Asigna un artículo antes de aceptar esta línea.",
      );
    }

    return this.prisma.catalogImportLine.update({
      where: { id: lineId },
      data: {
        lineStatus: dto.lineStatus,
        ...(dto.matchedProductId
          ? { matchedProductId: dto.matchedProductId }
          : {}),
      },
      include: {
        matchedProduct: {
          select: {
            id: true,
            name: true,
            purchaseFormat: true,
            purchasePrice: true,
            unitSize: true,
            referenceUnit: true,
          },
        },
      },
    });
  }

  /**
   * Aplica las líneas ACEPTADA: crea/actualiza la oferta del proveedor por
   * artículo y evalúa desviaciones de precio pactado. Transaccional —si algo
   * falla, no se aplica nada. Marca la importación como APLICADO.
   */
  async apply(
    tenantId: string,
    catalogImportId: string,
    userId: string | undefined,
  ) {
    const catalogImport = await this.assertEditable(tenantId, catalogImportId);
    const acceptedLines = catalogImport.lines.filter(
      (l) => l.lineStatus === CatalogLineStatus.ACEPTADA,
    );
    if (acceptedLines.length === 0) {
      throw new BadRequestException(
        "No hay líneas aceptadas que aplicar. Marca al menos una como ACEPTADA.",
      );
    }
    const withoutProduct = acceptedLines.filter((l) => !l.matchedProductId);
    if (withoutProduct.length > 0) {
      throw new BadRequestException(
        `${withoutProduct.length} línea(s) aceptada(s) sin artículo asignado.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const line of acceptedLines) {
        const product = await tx.product.findFirst({
          where: { id: line.matchedProductId!, tenantId },
          select: { name: true },
        });
        if (!product) {
          throw new BadRequestException(
            `Artículo ${line.matchedProductId} no encontrado`,
          );
        }

        const offer = await this.productSupplierOffersService.upsertOffer(
          line.matchedProductId!,
          catalogImport.supplierId,
          tenantId,
          {
            purchasePrice: line.unitPrice,
            purchaseFormat: line.purchaseFormat ?? undefined,
          },
          tx,
        );

        await this.priceAgreementService.evaluateAndRecord(
          tenantId,
          offer.id,
          line.unitPrice,
          {
            productName: product.name,
            supplierName: catalogImport.supplier.name,
          },
          tx,
        );
      }

      await tx.catalogImport.update({
        where: { id: catalogImportId },
        data: { status: CatalogImportStatus.APLICADO },
      });
    });

    return this.findOne(tenantId, catalogImportId);
  }

  async discard(tenantId: string, catalogImportId: string) {
    await this.assertEditable(tenantId, catalogImportId);
    return this.prisma.catalogImport.update({
      where: { id: catalogImportId },
      data: { status: CatalogImportStatus.DESCARTADO },
    });
  }

  /**
   * Borra (soft-delete) el registro de la importación, sea cual sea su
   * estado. No afecta a las ofertas de proveedor ya aplicadas: eso vive en
   * `ProductSupplierOffer`, no en el `CatalogImport`.
   */
  async remove(tenantId: string, catalogImportId: string) {
    await this.findOne(tenantId, catalogImportId);
    await this.prisma.catalogImport.delete({ where: { id: catalogImportId } });
  }

  private async assertEditable(tenantId: string, catalogImportId: string) {
    const catalogImport = await this.findOne(tenantId, catalogImportId);
    if (catalogImport.status !== CatalogImportStatus.PENDIENTE) {
      throw new BadRequestException(
        `La importación ya está ${catalogImport.status.toLowerCase()}; no admite más cambios.`,
      );
    }
    return catalogImport;
  }
}
