import { Test, TestingModule } from "@nestjs/testing";
import { LotService } from "./lot.service";
import { PrismaService } from "../../../common/services/prisma.service";

describe("LotService", () => {
  let service: LotService;
  let client: { lot: { create: jest.Mock } };
  let prismaMock: {
    lot: { findMany: jest.Mock; count: jest.Mock };
    albaranLine: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    client = { lot: { create: jest.fn().mockResolvedValue({ id: "lot-1" }) } };
    prismaMock = {
      lot: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      albaranLine: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [LotService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<LotService>(LotService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("creates a lot when lotNumber is present", async () => {
    const result = await service.createLotFromReception(client as any, {
      tenantId: "tenant-1",
      productId: "product-1",
      albaranLineId: "line-1",
      lotNumber: "  L2024-0456  ",
      quantity: 10,
      warehouseId: "warehouse-1",
      supplierId: "supplier-1",
    });

    expect(client.lot.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        productId: "product-1",
        albaranLineId: "line-1",
        lotNumber: "L2024-0456",
        quantity: 10,
        warehouseId: "warehouse-1",
        supplierId: "supplier-1",
      },
    });
    expect(result).toEqual({ id: "lot-1" });
  });

  it.each([undefined, null, "", "   "])(
    "returns null and does not call create when lotNumber is %p",
    async (lotNumber) => {
      const result = await service.createLotFromReception(client as any, {
        tenantId: "tenant-1",
        productId: "product-1",
        albaranLineId: "line-1",
        lotNumber: lotNumber as unknown as string,
        quantity: 10,
      });

      expect(result).toBeNull();
      expect(client.lot.create).not.toHaveBeenCalled();
    },
  );

  it("defaults warehouseId and supplierId to null when omitted", async () => {
    await service.createLotFromReception(client as any, {
      tenantId: "tenant-1",
      productId: "product-1",
      albaranLineId: "line-1",
      lotNumber: "L1",
      quantity: 5,
    });

    expect(client.lot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        warehouseId: null,
        supplierId: null,
      }),
    });
  });

  describe("findLots", () => {
    const lotRow = (over: Record<string, any> = {}) => ({
      lotNumber: "A1",
      quantity: 3,
      expiryDate: null,
      product: { name: "CR.AÑOJO LOMO ALTO" },
      supplier: { name: "Mar Menor" },
      albaranLine: {
        unit: "kg",
        albaran: {
          albaranNumber: "12345",
          internalNumber: "000123",
          date: new Date("2026-08-24T00:00:00.000Z"),
        },
      },
      ...over,
    });

    it("mapea registros Lot y aplica límite 10 cuando no hay rango", async () => {
      prismaMock.lot.findMany.mockResolvedValueOnce([lotRow()]);

      const rows = await service.findLots({
        tenantId: "t1",
        productIds: ["p1"],
      });

      expect(rows).toEqual([
        {
          productName: "CR.AÑOJO LOMO ALTO",
          lotNumber: "A1",
          supplierName: "Mar Menor",
          albaranNumber: "12345",
          albaranInternalNumber: "000123",
          albaranDate: "2026-08-24T00:00:00.000Z",
          quantity: 3,
          unit: "kg",
          expiryDate: null,
          source: "lot_record",
        },
      ]);
      expect(prismaMock.lot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });

    it("sin rango: pasa where con tenantId + productId in y filtra por proveedor", async () => {
      await service.findLots({
        tenantId: "t1",
        productIds: ["p1", "p2"],
        supplierName: "mar menor",
      });
      const arg = prismaMock.lot.findMany.mock.calls[0][0];
      expect(arg.where).toEqual(
        expect.objectContaining({
          tenantId: "t1",
          productId: { in: ["p1", "p2"] },
          supplier: { name: { contains: "mar menor", mode: "insensitive" } },
        }),
      );
    });

    it("con rango de fechas: aplica el tope duro (200) y filtra por Albaran.date", async () => {
      const from = new Date("2026-08-17T00:00:00.000Z");
      const to = new Date("2026-08-23T23:59:59.999Z");
      await service.findLots({ tenantId: "t1", productIds: ["p1"], from, to });

      const arg = prismaMock.lot.findMany.mock.calls[0][0];
      expect(arg.take).toBe(200);
      expect(arg.where.albaranLine).toEqual({
        albaran: { date: { gte: from, lte: to } },
      });
    });

    it("búsqueda inversa: igualdad exacta si count>0, si no contains", async () => {
      prismaMock.lot.count.mockResolvedValueOnce(1);
      await service.findLots({ tenantId: "t1", lotNumber: "A1" });
      expect(prismaMock.lot.findMany.mock.calls[0][0].where.lotNumber).toEqual({
        equals: "A1",
        mode: "insensitive",
      });

      prismaMock.lot.findMany.mockClear();
      prismaMock.lot.count.mockResolvedValueOnce(0);
      await service.findLots({ tenantId: "t1", lotNumber: "Z9" });
      expect(prismaMock.lot.findMany.mock.calls[0][0].where.lotNumber).toEqual({
        contains: "Z9",
        mode: "insensitive",
      });
    });

    it("incluye líneas con lot en crudo sin registro Lot (source raw_line)", async () => {
      prismaMock.albaranLine.findMany.mockResolvedValueOnce([
        {
          lot: "  260708 ",
          quantity: 2,
          unit: "ud",
          description: "LOMO S/H",
          matchedProduct: { name: "CR.AÑOJO LOMO ALTO" },
          albaran: {
            albaranNumber: "999",
            internalNumber: "000999",
            date: new Date("2026-08-20T00:00:00.000Z"),
            supplier: { name: "Mar Menor" },
          },
        },
      ]);

      const rows = await service.findLots({
        tenantId: "t1",
        productIds: ["p1"],
      });

      const raw = rows.find((r) => r.source === "raw_line");
      expect(raw).toMatchObject({
        productName: "CR.AÑOJO LOMO ALTO",
        lotNumber: "260708", // recortado, aunque el OCR trajo "  260708 "
        albaranNumber: "999",
        expiryDate: null,
        source: "raw_line",
      });
      expect(prismaMock.albaranLine.findMany.mock.calls[0][0].where).toEqual(
        expect.objectContaining({
          lotRecord: { is: null },
          matchedProductId: { in: ["p1"] },
        }),
      );
    });

    it("ordena el resultado combinado por fecha de albarán descendente", async () => {
      prismaMock.lot.findMany.mockResolvedValueOnce([
        lotRow({
          lotNumber: "OLD",
          albaranLine: {
            unit: "kg",
            albaran: {
              albaranNumber: "1",
              internalNumber: "1",
              date: new Date("2026-08-01T00:00:00.000Z"),
            },
          },
        }),
      ]);
      prismaMock.albaranLine.findMany.mockResolvedValueOnce([
        {
          lot: "NEW",
          quantity: 1,
          unit: "kg",
          description: "x",
          matchedProduct: { name: "x" },
          albaran: {
            albaranNumber: "2",
            internalNumber: "2",
            date: new Date("2026-08-28T00:00:00.000Z"),
            supplier: { name: "s" },
          },
        },
      ]);

      const rows = await service.findLots({
        tenantId: "t1",
        productIds: ["p1"],
      });
      expect(rows.map((r) => r.lotNumber)).toEqual(["NEW", "OLD"]);
    });
  });
});
