import { Test } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  CatalogImportStatus,
  CatalogLineStatus,
  LineMatchStatus,
} from "@prisma/client";
import { CatalogImportService } from "./catalog-import.service";
import { PythonOcrService } from "../../ocr/python-ocr.service";
import { LineMatchingService } from "../../albaranes/services/line-matching.service";
import { ProductSupplierOffersService } from "../../products/product-supplier-offers.service";
import { PriceAgreementService } from "./price-agreement.service";
import { PrismaService } from "../../../common/services/prisma.service";

describe("CatalogImportService", () => {
  let service: CatalogImportService;

  const txMock = {
    product: { findFirst: jest.fn() },
    catalogImport: { update: jest.fn() },
  };
  const prismaMock = {
    supplier: { findFirst: jest.fn() },
    catalogImport: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    catalogImportLine: { create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(async (fn: any) => fn(txMock)),
  };
  const pythonOcrMock = { processCatalog: jest.fn() };
  const lineMatchingMock = { matchLine: jest.fn() };
  const offersServiceMock = { upsertOffer: jest.fn() };
  const priceAgreementMock = { evaluateAndRecord: jest.fn() };

  const tenantId = "t1";
  const supplierId = "sup-1";

  beforeEach(async () => {
    // resetAllMocks (no solo clearAllMocks): también vacía las colas de
    // mockResolvedValueOnce que un test anterior no haya consumido del todo,
    // evitando fugas entre tests que comparten los mismos mocks.
    jest.resetAllMocks();
    prismaMock.$transaction = jest.fn(async (fn: any) => fn(txMock));
    const module = await Test.createTestingModule({
      providers: [
        CatalogImportService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PythonOcrService, useValue: pythonOcrMock },
        { provide: LineMatchingService, useValue: lineMatchingMock },
        { provide: ProductSupplierOffersService, useValue: offersServiceMock },
        { provide: PriceAgreementService, useValue: priceAgreementMock },
      ],
    }).compile();
    service = module.get(CatalogImportService);
  });

  const pendingImport = (lines: any[]) => ({
    id: "cat-1",
    tenantId,
    supplierId,
    status: CatalogImportStatus.PENDIENTE,
    supplier: { id: supplierId, name: "Doria foods" },
    lines,
  });

  describe("createFromUpload", () => {
    it("404 si el proveedor no es del tenant", async () => {
      prismaMock.supplier.findFirst.mockResolvedValue(null);
      await expect(
        service.createFromUpload(
          tenantId,
          supplierId,
          "u1",
          {
            buffer: Buffer.from(""),
            filename: "f.jpg",
            mimetype: "image/jpeg",
          },
          "gemini-2.0-flash",
          "key",
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("400 si la extracción de IA falla (mensaje claro, sin fallback silencioso)", async () => {
      prismaMock.supplier.findFirst.mockResolvedValue({ id: supplierId });
      pythonOcrMock.processCatalog.mockResolvedValue({
        success: false,
        error_message: "API key inválida",
        products: [],
      });
      await expect(
        service.createFromUpload(
          tenantId,
          supplierId,
          "u1",
          {
            buffer: Buffer.from(""),
            filename: "f.jpg",
            mimetype: "image/jpeg",
          },
          "gemini-2.0-flash",
          "bad-key",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("400 si la IA no extrae ningún artículo", async () => {
      prismaMock.supplier.findFirst.mockResolvedValue({ id: supplierId });
      pythonOcrMock.processCatalog.mockResolvedValue({
        success: true,
        products: [],
      });
      await expect(
        service.createFromUpload(
          tenantId,
          supplierId,
          "u1",
          {
            buffer: Buffer.from(""),
            filename: "f.jpg",
            mimetype: "image/jpeg",
          },
          "gemini-2.0-flash",
          "key",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("crea la importación y matchea cada línea extraída", async () => {
      prismaMock.supplier.findFirst.mockResolvedValue({ id: supplierId });
      pythonOcrMock.processCatalog.mockResolvedValue({
        success: true,
        supplier_name: "Doria foods",
        products: [
          {
            article_number: "A1",
            name: "Salmón",
            purchase_format: "Caja 5kg",
            unit_price: 50,
          },
          {
            article_number: null,
            name: "Producto rarísimo",
            purchase_format: null,
            unit_price: 3,
          },
        ],
      });
      prismaMock.catalogImport.create.mockResolvedValue({ id: "cat-1" });
      lineMatchingMock.matchLine
        .mockResolvedValueOnce({
          matchedProductId: "prod-1",
          matchStatus: LineMatchStatus.MATCH_ALTO,
          confidence: 0.95,
        })
        .mockResolvedValueOnce({
          matchedProductId: null,
          matchStatus: LineMatchStatus.NUEVO,
          confidence: 0,
        });
      prismaMock.catalogImportLine.create.mockResolvedValue({});
      prismaMock.catalogImport.findFirst.mockResolvedValue(pendingImport([]));

      await service.createFromUpload(
        tenantId,
        supplierId,
        "u1",
        { buffer: Buffer.from(""), filename: "f.jpg", mimetype: "image/jpeg" },
        "gemini-2.0-flash",
        "key",
      );

      expect(lineMatchingMock.matchLine).toHaveBeenCalledTimes(2);
      expect(prismaMock.catalogImportLine.create).toHaveBeenCalledTimes(2);
      const firstLineData =
        prismaMock.catalogImportLine.create.mock.calls[0][0].data;
      expect(firstLineData.matchedProductId).toBe("prod-1");
      expect(firstLineData.matchStatus).toBe(LineMatchStatus.MATCH_ALTO);
    });
  });

  describe("updateLine", () => {
    it("400 si se acepta una línea sin artículo asignado", async () => {
      prismaMock.catalogImport.findFirst.mockResolvedValue(
        pendingImport([{ id: "line-1", matchedProductId: null }]),
      );
      await expect(
        service.updateLine(tenantId, "cat-1", "line-1", {
          lineStatus: CatalogLineStatus.ACEPTADA,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("permite aceptar si se asigna matchedProductId en el mismo momento", async () => {
      prismaMock.catalogImport.findFirst.mockResolvedValue(
        pendingImport([{ id: "line-1", matchedProductId: null }]),
      );
      prismaMock.catalogImportLine.update.mockResolvedValue({});
      await service.updateLine(tenantId, "cat-1", "line-1", {
        lineStatus: CatalogLineStatus.ACEPTADA,
        matchedProductId: "prod-2",
      });
      expect(prismaMock.catalogImportLine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lineStatus: CatalogLineStatus.ACEPTADA,
            matchedProductId: "prod-2",
          }),
        }),
      );
    });

    it("400 si la importación ya no está PENDIENTE", async () => {
      prismaMock.catalogImport.findFirst.mockResolvedValue({
        ...pendingImport([]),
        status: CatalogImportStatus.APLICADO,
      });
      await expect(
        service.updateLine(tenantId, "cat-1", "line-1", {
          lineStatus: CatalogLineStatus.RECHAZADA,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("apply", () => {
    it("400 si no hay líneas ACEPTADA", async () => {
      prismaMock.catalogImport.findFirst.mockResolvedValue(
        pendingImport([{ id: "l1", lineStatus: CatalogLineStatus.PROPUESTA }]),
      );
      await expect(service.apply(tenantId, "cat-1", "u1")).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("líneas RECHAZADA nunca se aplican (solo ACEPTADA)", async () => {
      prismaMock.catalogImport.findFirst.mockResolvedValue(
        pendingImport([
          {
            id: "l1",
            lineStatus: CatalogLineStatus.ACEPTADA,
            matchedProductId: "prod-1",
            unitPrice: 12,
            purchaseFormat: "kg",
          },
          {
            id: "l2",
            lineStatus: CatalogLineStatus.RECHAZADA,
            matchedProductId: "prod-2",
            unitPrice: 99,
          },
        ]),
      );
      txMock.product.findFirst.mockResolvedValue({ name: "Salmón" });
      offersServiceMock.upsertOffer.mockResolvedValue({ id: "offer-1" });
      prismaMock.catalogImport.update.mockResolvedValue({});
      prismaMock.catalogImport.findFirst
        .mockResolvedValueOnce(
          pendingImport([
            {
              id: "l1",
              lineStatus: CatalogLineStatus.ACEPTADA,
              matchedProductId: "prod-1",
              unitPrice: 12,
              purchaseFormat: "kg",
            },
            {
              id: "l2",
              lineStatus: CatalogLineStatus.RECHAZADA,
              matchedProductId: "prod-2",
              unitPrice: 99,
            },
          ]),
        )
        .mockResolvedValueOnce(pendingImport([]));

      await service.apply(tenantId, "cat-1", "u1");

      expect(offersServiceMock.upsertOffer).toHaveBeenCalledTimes(1);
      expect(offersServiceMock.upsertOffer).toHaveBeenCalledWith(
        "prod-1",
        supplierId,
        tenantId,
        expect.objectContaining({ purchasePrice: 12 }),
        txMock,
      );
    });

    it("400 si una línea ACEPTADA no tiene artículo asignado", async () => {
      prismaMock.catalogImport.findFirst.mockResolvedValue(
        pendingImport([
          {
            id: "l1",
            lineStatus: CatalogLineStatus.ACEPTADA,
            matchedProductId: null,
            unitPrice: 12,
          },
        ]),
      );
      await expect(service.apply(tenantId, "cat-1", "u1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("aplica: upsertOffer + evaluateAndRecord por línea + marca APLICADO", async () => {
      const acceptedLine = {
        id: "l1",
        lineStatus: CatalogLineStatus.ACEPTADA,
        matchedProductId: "prod-1",
        unitPrice: 12,
        purchaseFormat: "kg",
      };
      prismaMock.catalogImport.findFirst
        .mockResolvedValueOnce(pendingImport([acceptedLine]))
        .mockResolvedValueOnce(pendingImport([acceptedLine]));
      txMock.product.findFirst.mockResolvedValue({ name: "Salmón" });
      offersServiceMock.upsertOffer.mockResolvedValue({ id: "offer-1" });
      prismaMock.catalogImport.update.mockResolvedValue({});

      await service.apply(tenantId, "cat-1", "u1");

      expect(priceAgreementMock.evaluateAndRecord).toHaveBeenCalledWith(
        tenantId,
        "offer-1",
        12,
        expect.objectContaining({
          productName: "Salmón",
          supplierName: "Doria foods",
        }),
        txMock,
      );
      expect(txMock.catalogImport.update).toHaveBeenCalledWith({
        where: { id: "cat-1" },
        data: { status: CatalogImportStatus.APLICADO },
      });
    });
  });

  describe("discard", () => {
    it("400 si ya no está PENDIENTE", async () => {
      prismaMock.catalogImport.findFirst.mockResolvedValue({
        ...pendingImport([]),
        status: CatalogImportStatus.DESCARTADO,
      });
      await expect(service.discard(tenantId, "cat-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("marca DESCARTADO", async () => {
      prismaMock.catalogImport.findFirst.mockResolvedValue(pendingImport([]));
      prismaMock.catalogImport.update.mockResolvedValue({
        status: "DESCARTADO",
      });
      await service.discard(tenantId, "cat-1");
      expect(prismaMock.catalogImport.update).toHaveBeenCalledWith({
        where: { id: "cat-1" },
        data: { status: CatalogImportStatus.DESCARTADO },
      });
    });
  });
});
