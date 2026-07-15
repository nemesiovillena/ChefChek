import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { PriceDeviationStatus } from "@prisma/client";
import { PriceAgreementService } from "./price-agreement.service";
import { NotificationsService } from "../../core/notifications.service";
import { PrismaService } from "../../../common/services/prisma.service";

describe("PriceAgreementService", () => {
  let service: PriceAgreementService;

  const prismaMock = {
    configuration: { findUnique: jest.fn(), upsert: jest.fn() },
    productSupplierOffer: { findFirst: jest.fn() },
    priceDeviation: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const notificationsMock = { createNotification: jest.fn() };

  const tenantId = "t1";

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PriceAgreementService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationsService, useValue: notificationsMock },
      ],
    }).compile();
    service = module.get(PriceAgreementService);
  });

  describe("detectDeviation (pura)", () => {
    it("sin agreedPrice → null (comportamiento actual intacto)", () => {
      expect(
        PriceAgreementService.detectDeviation(
          { agreedPrice: null, agreedUntil: null },
          12,
          0,
        ),
      ).toBeNull();
    });

    it("pactado caducado (agreedUntil pasado) → null, no evalúa", () => {
      const now = new Date("2026-07-15");
      const result = PriceAgreementService.detectDeviation(
        { agreedPrice: 10, agreedUntil: new Date("2026-07-01") },
        12,
        0,
        now,
      );
      expect(result).toBeNull();
    });

    it("pactado vigente (agreedUntil futuro) sí evalúa", () => {
      const now = new Date("2026-07-15");
      const result = PriceAgreementService.detectDeviation(
        { agreedPrice: 10, agreedUntil: new Date("2026-08-01") },
        12,
        0,
        now,
      );
      expect(result).not.toBeNull();
    });

    it("recibido dentro de tolerancia → null", () => {
      // pactado 10, tolerancia 5% → umbral 10.5; recibido 10.4 no desvía
      expect(
        PriceAgreementService.detectDeviation(
          { agreedPrice: 10, agreedUntil: null },
          10.4,
          5,
        ),
      ).toBeNull();
    });

    it("recibido supera tolerancia → devuelve % de desviación", () => {
      const result = PriceAgreementService.detectDeviation(
        { agreedPrice: 10, agreedUntil: null },
        12,
        0,
      );
      expect(result?.deviationPercent).toBeCloseTo(20, 5);
    });

    it("recibido igual al umbral exacto → null (no estrictamente mayor)", () => {
      expect(
        PriceAgreementService.detectDeviation(
          { agreedPrice: 10, agreedUntil: null },
          10.5,
          5,
        ),
      ).toBeNull();
    });
  });

  describe("evaluateAndRecord", () => {
    it("sin oferta encontrada → no-op (no crea desviación ni notifica)", async () => {
      prismaMock.productSupplierOffer.findFirst.mockResolvedValue(null);
      await service.evaluateAndRecord(tenantId, "offer-1", 12, {
        productName: "Salmón",
        supplierName: "Doria",
      });
      expect(prismaMock.priceDeviation.create).not.toHaveBeenCalled();
      expect(notificationsMock.createNotification).not.toHaveBeenCalled();
    });

    it("sin agreedPrice → no-op", async () => {
      prismaMock.productSupplierOffer.findFirst.mockResolvedValue({
        agreedPrice: null,
        agreedUntil: null,
      });
      await service.evaluateAndRecord(tenantId, "offer-1", 12, {
        productName: "Salmón",
        supplierName: "Doria",
      });
      expect(prismaMock.priceDeviation.create).not.toHaveBeenCalled();
    });

    it("desviación real: crea PriceDeviation + notifica con mensaje accionable", async () => {
      prismaMock.productSupplierOffer.findFirst.mockResolvedValue({
        agreedPrice: 10.4,
        agreedUntil: null,
      });
      prismaMock.configuration.findUnique.mockResolvedValue(null); // tolerancia default 0
      prismaMock.priceDeviation.create.mockResolvedValue({ id: "dev-1" });

      await service.evaluateAndRecord(tenantId, "offer-1", 12, {
        albaranId: "alb-1",
        productName: "Salmón",
        supplierName: "Doria",
        albaranLabel: "ALB-23",
      });

      expect(prismaMock.priceDeviation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          offerId: "offer-1",
          albaranId: "alb-1",
          agreedPrice: 10.4,
          receivedPrice: 12,
        }),
      });
      expect(notificationsMock.createNotification).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({ type: "PRICE_AGREEMENT_DEVIATION" }),
      );
      const [, payload] = notificationsMock.createNotification.mock.calls[0];
      expect(payload.message).toContain("10.40€");
      expect(payload.message).toContain("12.00€");
      expect(payload.message).toContain("ALB-23");
    });

    it("usa el client `tx` cuando se pasa (lee su propia escritura dentro de la misma transacción)", async () => {
      const txMock = {
        productSupplierOffer: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ agreedPrice: 5, agreedUntil: null }),
        },
        configuration: { findUnique: jest.fn().mockResolvedValue(null) },
        priceDeviation: {
          create: jest.fn().mockResolvedValue({ id: "dev-2" }),
        },
      };

      await service.evaluateAndRecord(
        tenantId,
        "offer-1",
        8,
        { productName: "Salmón", supplierName: "Doria" },
        txMock as any,
      );

      expect(txMock.productSupplierOffer.findFirst).toHaveBeenCalled();
      expect(txMock.priceDeviation.create).toHaveBeenCalled();
      expect(prismaMock.productSupplierOffer.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("getTolerance / setTolerance", () => {
    it("sin configuración → tolerancia por defecto 0", async () => {
      prismaMock.configuration.findUnique.mockResolvedValue(null);
      await expect(service.getTolerance(tenantId)).resolves.toBe(0);
    });

    it("con configuración guardada → devuelve el valor numérico", async () => {
      prismaMock.configuration.findUnique.mockResolvedValue({ value: "5" });
      await expect(service.getTolerance(tenantId)).resolves.toBe(5);
    });

    it("setTolerance hace upsert con la clave de tolerancia", async () => {
      prismaMock.configuration.upsert.mockResolvedValue({});
      await service.setTolerance(tenantId, 7, "user-1");
      expect(prismaMock.configuration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId_key: { tenantId, key: "compras.price_tolerance_percent" },
          },
        }),
      );
    });
  });

  describe("updateStatus", () => {
    it("404 si la desviación no es del tenant", async () => {
      prismaMock.priceDeviation.findFirst.mockResolvedValue(null);
      await expect(
        service.updateStatus(tenantId, "dev-1", {
          status: PriceDeviationStatus.RESUELTA,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("persiste el nuevo estado y la nota", async () => {
      prismaMock.priceDeviation.findFirst.mockResolvedValue({ id: "dev-1" });
      prismaMock.priceDeviation.update.mockResolvedValue({ id: "dev-1" });

      await service.updateStatus(tenantId, "dev-1", {
        status: PriceDeviationStatus.RECLAMADA,
        note: "Enviado email al proveedor",
      });

      expect(prismaMock.priceDeviation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "dev-1" },
          data: {
            status: PriceDeviationStatus.RECLAMADA,
            note: "Enviado email al proveedor",
          },
        }),
      );
    });
  });

  describe("findAll", () => {
    it("filtra por supplierId vía la relación offer", async () => {
      prismaMock.priceDeviation.findMany.mockResolvedValue([]);
      await service.findAll(tenantId, { supplierId: "sup-1" } as any);
      expect(prismaMock.priceDeviation.findMany.mock.calls[0][0].where).toEqual(
        expect.objectContaining({
          tenantId,
          offer: { supplierId: "sup-1" },
        }),
      );
    });
  });
});
