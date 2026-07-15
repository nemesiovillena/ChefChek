import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { PurchaseAnalyticsService } from "./purchase-analytics.service";
import { PrismaService } from "../../../common/services/prisma.service";

describe("PurchaseAnalyticsService", () => {
  let service: PurchaseAnalyticsService;

  const prismaMock = {
    $queryRaw: jest.fn(),
    product: { findFirst: jest.fn() },
  };

  const tenantId = "t1";

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PurchaseAnalyticsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(PurchaseAnalyticsService);
  });

  describe("topSpend", () => {
    it("calcula % individual y acumulado sobre el TOTAL (dataset calculado a mano: 800/200 -> 80%/20%, acumulado 80/100)", async () => {
      prismaMock.$queryRaw.mockResolvedValue([
        { productId: "p1", productName: "Salmón", spend: 800 },
        { productId: "p2", productName: "Ternera", spend: 200 },
      ]);

      const result = await service.topSpend(tenantId, {});

      expect(result).toEqual([
        {
          productId: "p1",
          productName: "Salmón",
          spend: 800,
          percent: 80,
          cumulativePercent: 80,
        },
        {
          productId: "p2",
          productName: "Ternera",
          spend: 200,
          percent: 20,
          cumulativePercent: 100,
        },
      ]);
    });

    it("recorta a los 20 primeros pero el % sigue calculado contra el total de TODAS las filas", async () => {
      // 21 filas de 10 cada una = total 210; cada una debería ser 10/210 = 4.7619...%
      const rows = Array.from({ length: 21 }, (_, i) => ({
        productId: `p${i}`,
        productName: `Producto ${i}`,
        spend: 10,
      }));
      prismaMock.$queryRaw.mockResolvedValue(rows);

      const result = await service.topSpend(tenantId, {});

      expect(result).toHaveLength(20);
      expect(result[0].percent).toBeCloseTo((10 / 210) * 100, 5);
    });

    it("sin filas -> array vacío, sin división por cero", async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);
      const result = await service.topSpend(tenantId, {});
      expect(result).toEqual([]);
    });
  });

  describe("bySupplier", () => {
    it("ticket medio = total / nº pedidos (dataset a mano: 1000€ en 4 pedidos -> 250€/pedido)", async () => {
      prismaMock.$queryRaw.mockResolvedValue([
        {
          supplierId: "sup-1",
          supplierName: "Doria foods",
          orderCount: BigInt(4),
          totalAmount: 1000,
          averageLeadTimeDays: 2.5,
        },
      ]);

      const result = await service.bySupplier(tenantId, {});

      expect(result).toEqual([
        {
          supplierId: "sup-1",
          supplierName: "Doria foods",
          orderCount: 4,
          totalAmount: 1000,
          averageTicket: 250,
          averageLeadTimeDays: 2.5,
        },
      ]);
    });

    it("proveedor sin plazo medio calculable (ningún pedido con sentAt+albarán) -> null, sin romper", async () => {
      prismaMock.$queryRaw.mockResolvedValue([
        {
          supplierId: "sup-2",
          supplierName: "Makro",
          orderCount: BigInt(1),
          totalAmount: 50,
          averageLeadTimeDays: null,
        },
      ]);

      const result = await service.bySupplier(tenantId, {});
      expect(result[0].averageLeadTimeDays).toBeNull();
      expect(result[0].averageTicket).toBe(50);
    });

    it("sin pedidos para ningún proveedor -> array vacío (el proveedor simplemente no aparece, no hay fila con count=0)", async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);
      const result = await service.bySupplier(tenantId, {});
      expect(result).toEqual([]);
    });
  });

  describe("deviationsOverTime", () => {
    it("mapea bigint->number y Date->ISOString", async () => {
      const period = new Date("2026-07-13T00:00:00Z");
      prismaMock.$queryRaw.mockResolvedValue([
        { period, count: BigInt(3), averageDeviationPercent: 12.5 },
      ]);

      const result = await service.deviationsOverTime(tenantId, {});

      expect(result).toEqual([
        {
          period: period.toISOString(),
          count: 3,
          averageDeviationPercent: 12.5,
        },
      ]);
    });
  });

  describe("priceComparison", () => {
    it("404 si el artículo no es del tenant", async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);
      await expect(
        service.priceComparison(tenantId, { productId: "p-x" }),
      ).rejects.toThrow(NotFoundException);
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    it("devuelve la serie ordenada por fecha con supplierName", async () => {
      prismaMock.product.findFirst.mockResolvedValue({ id: "p1", tenantId });
      const recordedAt = new Date("2026-07-01T00:00:00Z");
      prismaMock.$queryRaw.mockResolvedValue([
        {
          supplierId: "sup-1",
          supplierName: "Doria foods",
          recordedAt,
          price: 10.4,
        },
      ]);

      const result = await service.priceComparison(tenantId, {
        productId: "p1",
      });

      expect(result).toEqual([
        {
          supplierId: "sup-1",
          supplierName: "Doria foods",
          recordedAt: recordedAt.toISOString(),
          price: 10.4,
        },
      ]);
    });
  });
});
