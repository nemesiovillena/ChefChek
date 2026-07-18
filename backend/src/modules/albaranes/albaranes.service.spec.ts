import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AlbaranesService } from "./albaranes.service";
import { PrismaService } from "../../common/services/prisma.service";
import { AlbaranStatusService } from "./services/albaran-status.service";
import { AlbaranNumberService } from "./services/albaran-number.service";
import { SupplierMatchingService } from "./services/supplier-matching.service";
import { LineMatchingService } from "./services/line-matching.service";
import { PythonOcrService } from "../ocr/python-ocr.service";
import { AlbaranStatus } from "@prisma/client";

describe("AlbaranesService", () => {
  let service: AlbaranesService;

  const prisma = {
    albaran: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    albaranLine: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    product: { findFirst: jest.fn() },
    supplier: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const numberService = {
    generateInternalNumber: jest.fn().mockResolvedValue("ALB-0001"),
  };
  const statusService = {
    transitionStatus: jest.fn().mockResolvedValue(undefined),
  };
  const supplierMatching = {
    matchSupplier: jest.fn(),
    enrichSupplierFromOcr: jest.fn().mockResolvedValue(undefined),
  };
  const lineMatching = {
    matchAllLines: jest.fn().mockResolvedValue(undefined),
    rememberAlias: jest.fn().mockResolvedValue(undefined),
  };
  const pythonOcrService = {
    processImage: jest.fn(),
    refineExtraction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlbaranesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AlbaranStatusService, useValue: statusService },
        { provide: AlbaranNumberService, useValue: numberService },
        { provide: SupplierMatchingService, useValue: supplierMatching },
        { provide: LineMatchingService, useValue: lineMatching },
        { provide: PythonOcrService, useValue: pythonOcrService },
      ],
    }).compile();

    service = module.get<AlbaranesService>(AlbaranesService);
  });

  afterEach(() => jest.clearAllMocks());

  const albaran = (overrides = {}) => ({
    id: "alb-1",
    tenantId: "t1",
    status: AlbaranStatus.PENDIENTE,
    lines: [],
    ...overrides,
  });

  describe("create", () => {
    it("creates an albaran with explicit date and maps lines", async () => {
      prisma.albaran.create.mockResolvedValue({ id: "alb-1" });
      const dto = {
        supplierId: "s1",
        albaranNumber: "A-1",
        date: "2024-01-01",
        grossAmount: 100,
        base: 100,
        vatTotal: 10,
        total: 110,
        warehouseId: "w1",
        notes: "n",
        lines: [{ description: "x", quantity: 2, unitPrice: 5 }],
      };

      await service.create(dto as any, "t1");

      expect(numberService.generateInternalNumber).toHaveBeenCalledWith("t1");
      expect(prisma.albaran.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "t1",
          supplierId: "s1",
          date: new Date("2024-01-01"),
          lines: { create: expect.any(Array) },
        }),
        include: { lines: true, supplier: true },
      });
    });

    it("defaults date to now when not provided", async () => {
      prisma.albaran.create.mockResolvedValue({ id: "alb-2" });
      const before = Date.now();

      await service.create(
        { lines: [{ description: "y", quantity: 1, unitPrice: 2 }] } as any,
        "t1",
      );

      const callArg = prisma.albaran.create.mock.calls[0][0];
      expect(callArg.data.date.getTime()).toBeGreaterThanOrEqual(before);
    });
  });

  describe("findAll", () => {
    beforeEach(() => {
      prisma.albaran.findMany.mockResolvedValue([{ id: "a" }]);
      prisma.albaran.count.mockResolvedValue(1);
    });

    it("uses default page/limit with empty query", async () => {
      const res = await service.findAll({} as any, "t1");
      const callArg = prisma.albaran.findMany.mock.calls[0][0];
      expect(callArg.skip).toBe(0);
      expect(callArg.take).toBe(20);
      expect(res.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });

    it("excludes archived albaranes when no status filter is given", async () => {
      await service.findAll({} as any, "t1");
      const { where } = prisma.albaran.findMany.mock.calls[0][0];
      expect(where.status).toEqual({ not: AlbaranStatus.ARCHIVADO });
    });

    it("returns archived albaranes when status ARCHIVADO is requested", async () => {
      await service.findAll({ status: AlbaranStatus.ARCHIVADO } as any, "t1");
      const { where } = prisma.albaran.findMany.mock.calls[0][0];
      expect(where.status).toBe(AlbaranStatus.ARCHIVADO);
    });

    it("applies supplierId, status, search, date range and pagination", async () => {
      await service.findAll(
        {
          supplierId: "s1",
          status: AlbaranStatus.REVISADO,
          search: "foo",
          dateFrom: "2024-01-01",
          dateTo: "2024-02-01",
          page: 2,
          limit: 5,
        } as any,
        "t1",
      );

      const { where, skip, take } = prisma.albaran.findMany.mock.calls[0][0];
      expect(where.supplierId).toBe("s1");
      expect(where.status).toBe(AlbaranStatus.REVISADO);
      expect(where.OR).toHaveLength(3);
      expect(where.date.gte).toEqual(new Date("2024-01-01"));
      expect(where.date.lte).toEqual(new Date("2024-02-01"));
      expect(skip).toBe(5);
      expect(take).toBe(5);
    });

    it("builds date filter with only dateFrom", async () => {
      await service.findAll({ dateFrom: "2024-01-01" } as any, "t1");
      const { date } = prisma.albaran.findMany.mock.calls[0][0].where;
      expect(date.gte).toEqual(new Date("2024-01-01"));
      expect(date.lte).toBeUndefined();
    });

    it("builds date filter with only dateTo", async () => {
      await service.findAll({ dateTo: "2024-02-01" } as any, "t1");
      const { date } = prisma.albaran.findMany.mock.calls[0][0].where;
      expect(date.lte).toEqual(new Date("2024-02-01"));
      expect(date.gte).toBeUndefined();
    });
  });

  describe("findOne", () => {
    it("returns the albaran when found", async () => {
      prisma.albaran.findFirst.mockResolvedValue({ id: "alb-1" });
      await expect(service.findOne("alb-1", "t1")).resolves.toEqual({
        id: "alb-1",
      });
    });

    it("throws NotFound when not found", async () => {
      prisma.albaran.findFirst.mockResolvedValue(null);
      await expect(service.findOne("x", "t1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    it("throws BadRequest when albaran is CONFIRMADO", async () => {
      prisma.albaran.findFirst.mockResolvedValue(
        albaran({ status: AlbaranStatus.CONFIRMADO }),
      );
      await expect(service.update("alb-1", {} as any, "t1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws BadRequest when albaran is ARCHIVADO", async () => {
      prisma.albaran.findFirst.mockResolvedValue(
        albaran({ status: AlbaranStatus.ARCHIVADO }),
      );
      await expect(service.update("alb-1", {} as any, "t1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("updates header when status allows it", async () => {
      prisma.albaran.findFirst.mockResolvedValue(albaran());
      prisma.albaran.update.mockResolvedValue({ id: "alb-1" });

      await service.update("alb-1", { notes: "updated" } as any, "t1");

      expect(prisma.albaran.update).toHaveBeenCalledWith({
        where: { id: "alb-1" },
        data: expect.objectContaining({ notes: "updated" }),
        include: { lines: true, supplier: true, purchaseOrder: true },
      });
    });

    it("permite vincular un pedido de compra (purchaseOrderId)", async () => {
      prisma.albaran.findFirst.mockResolvedValue(albaran());
      prisma.albaran.update.mockResolvedValue({ id: "alb-1" });

      await service.update("alb-1", { purchaseOrderId: "o1" } as any, "t1");

      expect(prisma.albaran.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ purchaseOrderId: "o1" }),
        }),
      );
    });

    it("permite desvincular el pedido enviando purchaseOrderId null", async () => {
      prisma.albaran.findFirst.mockResolvedValue(albaran());
      prisma.albaran.update.mockResolvedValue({ id: "alb-1" });

      await service.update("alb-1", { purchaseOrderId: null } as any, "t1");

      expect(prisma.albaran.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ purchaseOrderId: null }),
        }),
      );
    });
  });

  describe("updateLine", () => {
    const existingLine = {
      id: "l1",
      albaranId: "alb-1",
      quantity: 2,
      unitPrice: 5,
      vatPercent: 10,
    };

    it("throws NotFound when line does not exist", async () => {
      prisma.albaran.findFirst.mockResolvedValue(albaran());
      prisma.albaranLine.findFirst.mockResolvedValue(null);
      await expect(
        service.updateLine("alb-1", "l1", {} as any, "t1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("recalculates lineAmount using existing unitPrice when only quantity changes", async () => {
      prisma.albaran.findFirst.mockResolvedValue(albaran());
      prisma.albaranLine.findFirst.mockResolvedValue(existingLine);
      prisma.albaranLine.update.mockResolvedValue({ id: "l1" });

      await service.updateLine("alb-1", "l1", { quantity: "4" } as any, "t1");

      const { data } = prisma.albaranLine.update.mock.calls[0][0];
      expect(data.quantity).toBe(4);
      expect(data.lineAmount).toBe(20);
    });

    it("recalculates lineAmount using both quantity and unitPrice", async () => {
      prisma.albaran.findFirst.mockResolvedValue(albaran());
      prisma.albaranLine.findFirst.mockResolvedValue(existingLine);
      prisma.albaranLine.update.mockResolvedValue({ id: "l1" });

      await service.updateLine(
        "alb-1",
        "l1",
        { quantity: "3", unitPrice: "10" } as any,
        "t1",
      );

      const { data } = prisma.albaranLine.update.mock.calls[0][0];
      expect(data.lineAmount).toBe(30);
      expect(data.unitPrice).toBe(10);
    });

    it("recalculates lineAmount from existing quantity when only unitPrice changes", async () => {
      prisma.albaran.findFirst.mockResolvedValue(albaran());
      prisma.albaranLine.findFirst.mockResolvedValue(existingLine);
      prisma.albaranLine.update.mockResolvedValue({ id: "l1" });

      await service.updateLine("alb-1", "l1", { unitPrice: "7" } as any, "t1");

      const { data } = prisma.albaranLine.update.mock.calls[0][0];
      expect(data.unitPrice).toBe(7);
      expect(data.lineAmount).toBe(14);
    });

    it("recalculates priceWithVat from existing unitPrice when only vatPercent changes", async () => {
      prisma.albaran.findFirst.mockResolvedValue(albaran());
      prisma.albaranLine.findFirst.mockResolvedValue(existingLine);
      prisma.albaranLine.update.mockResolvedValue({ id: "l1" });

      await service.updateLine(
        "alb-1",
        "l1",
        { vatPercent: "21" } as any,
        "t1",
      );

      const { data } = prisma.albaranLine.update.mock.calls[0][0];
      expect(data.vatPercent).toBe(21);
      expect(data.priceWithVat).toBeCloseTo(5 * 1.21);
    });

    it("recalculates priceWithVat using new unitPrice when vatPercent and unitPrice change", async () => {
      prisma.albaran.findFirst.mockResolvedValue(albaran());
      prisma.albaranLine.findFirst.mockResolvedValue(existingLine);
      prisma.albaranLine.update.mockResolvedValue({ id: "l1" });

      await service.updateLine(
        "alb-1",
        "l1",
        { vatPercent: "10", unitPrice: "20" } as any,
        "t1",
      );

      const { data } = prisma.albaranLine.update.mock.calls[0][0];
      expect(data.priceWithVat).toBeCloseTo(20 * 1.1);
    });

    it("accepts explicit priceWithVat, matchedProductId and simple fields", async () => {
      prisma.albaran.findFirst.mockResolvedValue(albaran());
      prisma.albaranLine.findFirst.mockResolvedValue(existingLine);
      prisma.albaranLine.update.mockResolvedValue({ id: "l1" });

      await service.updateLine(
        "alb-1",
        "l1",
        {
          articleNumber: "ART",
          lot: "L1",
          description: "desc",
          unit: "kg",
          priceWithVat: "30",
          matchedProductId: "p1",
        } as any,
        "t1",
      );

      expect(prisma.albaranLine.update.mock.calls[0][0].data).toMatchObject({
        articleNumber: "ART",
        lot: "L1",
        description: "desc",
        unit: "kg",
        priceWithVat: 30,
        matchedProductId: "p1",
      });
    });
  });

  describe("matchLine", () => {
    const line = { id: "l1", description: "Jarrete de cordero" };

    it("throws NotFound when the line does not belong to the albaran", async () => {
      prisma.albaran.findFirst.mockResolvedValue(albaran());
      await expect(
        service.matchLine("alb-1", "l1", "p1", "t1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NotFound when product does not exist", async () => {
      prisma.albaran.findFirst.mockResolvedValue(albaran({ lines: [line] }));
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(
        service.matchLine("alb-1", "l1", "p1", "t1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("assigns product match with high confidence", async () => {
      prisma.albaran.findFirst.mockResolvedValue(albaran({ lines: [line] }));
      prisma.product.findFirst.mockResolvedValue({ id: "p1" });
      prisma.albaranLine.update.mockResolvedValue({ id: "l1" });

      await service.matchLine("alb-1", "l1", "p1", "t1");

      expect(prisma.albaranLine.update).toHaveBeenCalledWith({
        where: { id: "l1" },
        data: {
          matchedProductId: "p1",
          matchStatus: "MATCH_ALTO",
          confidence: 1.0,
        },
      });
      expect(lineMatching.rememberAlias).not.toHaveBeenCalled();
    });

    it("remembers a supplier alias when the albaran has a resolved supplier", async () => {
      prisma.albaran.findFirst.mockResolvedValue(
        albaran({ lines: [line], supplierId: "sup-1" }),
      );
      prisma.product.findFirst.mockResolvedValue({ id: "p1" });
      prisma.albaranLine.update.mockResolvedValue({ id: "l1" });

      await service.matchLine("alb-1", "l1", "p1", "t1", "user-1");

      expect(lineMatching.rememberAlias).toHaveBeenCalledWith({
        tenantId: "t1",
        supplierId: "sup-1",
        description: "Jarrete de cordero",
        productId: "p1",
        confirmedBy: "user-1",
      });
    });
  });

  describe("setLineStatus", () => {
    it("throws NotFound when line does not exist", async () => {
      prisma.albaran.findFirst.mockResolvedValue(albaran());
      prisma.albaranLine.findFirst.mockResolvedValue(null);
      await expect(
        service.setLineStatus("alb-1", "l1", "CONFIRMADO", "t1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequest when confirming a line without matched product", async () => {
      prisma.albaran.findFirst.mockResolvedValue(albaran());
      prisma.albaranLine.findFirst.mockResolvedValue({
        id: "l1",
        matchedProductId: null,
      });
      await expect(
        service.setLineStatus("alb-1", "l1", "CONFIRMADO", "t1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("updates line status when valid", async () => {
      prisma.albaran.findFirst.mockResolvedValue(albaran());
      prisma.albaranLine.findFirst.mockResolvedValue({
        id: "l1",
        matchedProductId: "p1",
      });
      prisma.albaranLine.update.mockResolvedValue({ id: "l1" });

      await service.setLineStatus("alb-1", "l1", "CONFIRMADO", "t1");

      expect(prisma.albaranLine.update).toHaveBeenCalledWith({
        where: { id: "l1" },
        data: { lineStatus: "CONFIRMADO" },
      });
    });
  });

  describe("updateStatus", () => {
    it("delegates to statusService and reloads the albaran", async () => {
      prisma.albaran.findFirst.mockResolvedValue({
        id: "alb-1",
        status: AlbaranStatus.REVISADO,
      });

      await service.updateStatus("alb-1", AlbaranStatus.REVISADO, "t1");

      expect(statusService.transitionStatus).toHaveBeenCalledWith(
        "alb-1",
        "t1",
        AlbaranStatus.REVISADO,
      );
    });
  });

  describe("remove", () => {
    it("throws BadRequest when CONFIRMADO", async () => {
      prisma.albaran.findFirst.mockResolvedValue(
        albaran({ status: AlbaranStatus.CONFIRMADO }),
      );
      await expect(service.remove("alb-1", "t1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("deletes when status allows it", async () => {
      prisma.albaran.findFirst.mockResolvedValue(albaran());
      prisma.albaran.delete.mockResolvedValue({ id: "alb-1" });

      await service.remove("alb-1", "t1");

      expect(prisma.albaran.delete).toHaveBeenCalledWith({
        where: { id: "alb-1" },
      });
    });

    it("is idempotent: returns success when already soft-deleted", async () => {
      // findOne (findFirst) filtra los soft-deleted → lanza NotFound aun existiendo
      prisma.albaran.findFirst.mockResolvedValue(null);
      // SQL crudo salta el soft-delete y confirma que SÍ está en la papelera
      const deletedAt = new Date("2026-07-16T14:36:16.999Z");
      prisma.$queryRaw.mockResolvedValue([{ deletedAt }]);

      const result = await service.remove("alb-1", "t1");

      expect(result).toEqual({
        id: "alb-1",
        alreadyDeleted: true,
        deletedAt,
      });
      // No se ejecuta un segundo borrado sobre algo ya borrado
      expect(prisma.albaran.delete).not.toHaveBeenCalled();
    });

    it("throws NotFound when the albaran does not exist at all", async () => {
      prisma.albaran.findFirst.mockResolvedValue(null);
      // SQL crudo no encuentra la fila: no existe (ni viva ni borrada)
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(service.remove("alb-1", "t1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("addLine", () => {
    it("throws NotFound when albaran does not exist", async () => {
      prisma.albaran.findFirst.mockResolvedValue(null);
      await expect(
        service.addLine("alb-1", { description: "x" } as any, "t1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequest when status is not PENDIENTE/REVISADO", async () => {
      prisma.albaran.findFirst.mockResolvedValue(
        albaran({ status: AlbaranStatus.CONFIRMADO, lines: [] }),
      );
      await expect(
        service.addLine("alb-1", { description: "x" } as any, "t1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("creates the line and recalculates albaran totals", async () => {
      const existingLine = { lineAmount: 100, vatPercent: 10 };
      prisma.albaran.findFirst.mockResolvedValue(
        albaran({ lines: [existingLine] }),
      );
      const createdLine = {
        id: "l2",
        quantity: 2,
        unitPrice: 5,
        lineAmount: 10,
        vatPercent: 10,
      };
      prisma.albaranLine.create.mockResolvedValue(createdLine);
      prisma.albaran.update.mockResolvedValue({ id: "alb-1" });

      const res = await service.addLine(
        "alb-1",
        { description: "new", quantity: 2, unitPrice: 5 } as any,
        "t1",
      );

      expect(res).toEqual({ success: true, data: createdLine });
      expect(prisma.albaran.update).toHaveBeenCalledWith({
        where: { id: "alb-1" },
        data: expect.objectContaining({ base: 110 }),
      });
    });
  });

  describe("createFromUpload", () => {
    const file = () =>
      ({
        buffer: Buffer.from("x"),
        originalname: "a.pdf",
        mimetype: "application/pdf",
      }) as any;

    it("throws BadRequest when no files provided", async () => {
      await expect(service.createFromUpload([], "t1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("creates albaran from successful OCR without supplier match", async () => {
      pythonOcrService.processImage.mockResolvedValue({
        success: true,
        document: {
          products: [{ name: "Tomate", quantity: 2, unit_price: 3 }],
        },
      });
      supplierMatching.matchSupplier.mockResolvedValue({ supplierId: null });
      prisma.albaran.create.mockResolvedValue({ id: "alb-ocr", lines: [] });

      await service.createFromUpload([file()], "t1");

      expect(supplierMatching.enrichSupplierFromOcr).not.toHaveBeenCalled();
      expect(prisma.supplier.findFirst).not.toHaveBeenCalled();
      expect(prisma.albaran.create).toHaveBeenCalled();
      expect(lineMatching.matchAllLines).toHaveBeenCalled();
    });

    it("refines extraction when supplier has OCR layout hints and raw text", async () => {
      pythonOcrService.processImage.mockResolvedValue({
        success: true,
        document: {
          products: [{ name: "x", quantity: 1, unit_price: 1 }],
          raw_text: "RAW",
        },
      });
      supplierMatching.matchSupplier.mockResolvedValue({ supplierId: "s1" });
      prisma.supplier.findFirst.mockResolvedValue({
        ocrLayoutHints: { observationCount: 1 },
      });
      pythonOcrService.refineExtraction.mockResolvedValue({
        success: true,
        document: {
          products: [{ name: "refined", quantity: 5, unit_price: 2 }],
        },
      });
      prisma.albaran.create.mockResolvedValue({ id: "alb-r", lines: [] });

      await service.createFromUpload([file()], "t1");

      expect(pythonOcrService.refineExtraction).toHaveBeenCalled();
      expect(supplierMatching.enrichSupplierFromOcr).toHaveBeenCalledWith(
        "s1",
        expect.any(Object),
      );
    });

    it("skips refine override when refined result is unsuccessful", async () => {
      pythonOcrService.processImage.mockResolvedValue({
        success: true,
        document: { products: [], raw_text: "RAW" },
      });
      supplierMatching.matchSupplier.mockResolvedValue({ supplierId: "s1" });
      prisma.supplier.findFirst.mockResolvedValue({
        ocrLayoutHints: { observationCount: 1 },
      });
      pythonOcrService.refineExtraction.mockResolvedValue({ success: false });
      prisma.albaran.create.mockResolvedValue({ id: "alb-r2", lines: [] });

      await service.createFromUpload([file()], "t1");

      expect(pythonOcrService.refineExtraction).toHaveBeenCalled();
    });

    it("creates fallback albaran when OCR returns no document", async () => {
      pythonOcrService.processImage.mockResolvedValue({
        success: false,
        error: "boom",
      });
      prisma.albaran.create.mockResolvedValue({ id: "alb-fb", lines: [] });

      await service.createFromUpload([file()], "t1");

      const { data } = prisma.albaran.create.mock.calls[0][0];
      expect(data.status).toBe(AlbaranStatus.PENDIENTE);
      expect(data.albaranNumber).toContain("FALLBACK-");
    });

    it("creates fallback albaran when OCR throws", async () => {
      pythonOcrService.processImage.mockRejectedValue(new Error("network"));
      prisma.albaran.create.mockResolvedValue({ id: "alb-fb2", lines: [] });

      await service.createFromUpload([file()], "t1");

      expect(prisma.albaran.create.mock.calls[0][0].data.notes).toContain(
        "Error en OCR",
      );
    });
  });
});
