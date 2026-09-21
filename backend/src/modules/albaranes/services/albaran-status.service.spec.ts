import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { AlbaranStatusService } from "./albaran-status.service";
import { AlbaranStockService } from "./albaran-stock.service";
import { OrderReconciliationService } from "../../compras/services/order-reconciliation.service";
import { PrismaService } from "../../../common/services/prisma.service";
import { AlbaranStatus, LineStatus } from "@prisma/client";

describe("AlbaranStatusService", () => {
  let service: AlbaranStatusService;

  const prisma = {
    albaran: { findFirst: jest.fn(), updateMany: jest.fn() },
  };
  const stockService = { processStockOnConfirmation: jest.fn() };
  const reconciliationService = { reconcileFromAlbaran: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlbaranStatusService,
        { provide: PrismaService, useValue: prisma },
        { provide: AlbaranStockService, useValue: stockService },
        {
          provide: OrderReconciliationService,
          useValue: reconciliationService,
        },
      ],
    }).compile();

    service = module.get<AlbaranStatusService>(AlbaranStatusService);
  });

  afterEach(() => jest.clearAllMocks());

  const buildAlbaran = (overrides = {}) => ({
    id: "alb-1",
    tenantId: "t1",
    status: AlbaranStatus.PENDIENTE,
    lines: [],
    ...overrides,
  });

  describe("transitionStatus", () => {
    it("throws NotFound when the albaran does not exist", async () => {
      prisma.albaran.findFirst.mockResolvedValue(null);
      await expect(
        service.transitionStatus("x", "t1", AlbaranStatus.REVISADO),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequest on an invalid transition", async () => {
      // PENDIENTE only allows -> REVISADO, not CONFIRMADO
      prisma.albaran.findFirst.mockResolvedValue(buildAlbaran());
      await expect(
        service.transitionStatus("alb-1", "t1", AlbaranStatus.CONFIRMADO),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequest when transitioning from ARCHIVADO (none allowed)", async () => {
      prisma.albaran.findFirst.mockResolvedValue(
        buildAlbaran({ status: AlbaranStatus.ARCHIVADO }),
      );
      await expect(
        service.transitionStatus("alb-1", "t1", AlbaranStatus.PENDIENTE),
      ).rejects.toThrow(BadRequestException);
    });

    it("completes PENDIENTE -> REVISADO with no pending lines and skips stock", async () => {
      prisma.albaran.findFirst.mockResolvedValue(buildAlbaran());
      prisma.albaran.updateMany.mockResolvedValue({ count: 1 });
      await service.transitionStatus("alb-1", "t1", AlbaranStatus.REVISADO);
      expect(prisma.albaran.updateMany).toHaveBeenCalledWith({
        where: {
          id: "alb-1",
          tenantId: "t1",
          status: AlbaranStatus.PENDIENTE,
        },
        data: { status: AlbaranStatus.REVISADO },
      });
      expect(stockService.processStockOnConfirmation).not.toHaveBeenCalled();
    });

    it("throws BadRequest on REVISADO when a line is still PENDIENTE", async () => {
      prisma.albaran.findFirst.mockResolvedValue(
        buildAlbaran({ lines: [{ lineStatus: LineStatus.PENDIENTE }] }),
      );
      await expect(
        service.transitionStatus("alb-1", "t1", AlbaranStatus.REVISADO),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequest on CONFIRMADO when a confirmed line lacks a product", async () => {
      prisma.albaran.findFirst.mockResolvedValue(
        buildAlbaran({
          status: AlbaranStatus.REVISADO,
          lines: [
            { lineStatus: LineStatus.CONFIRMADO, matchedProductId: null },
          ],
        }),
      );
      await expect(
        service.transitionStatus("alb-1", "t1", AlbaranStatus.CONFIRMADO),
      ).rejects.toThrow(BadRequestException);
    });

    it("completes REVISADO -> CONFIRMADO, triggers stock processing and conciliación", async () => {
      prisma.albaran.findFirst.mockResolvedValue(
        buildAlbaran({
          status: AlbaranStatus.REVISADO,
          lines: [
            { lineStatus: LineStatus.CONFIRMADO, matchedProductId: "p1" },
          ],
        }),
      );
      prisma.albaran.updateMany.mockResolvedValue({ count: 1 });
      stockService.processStockOnConfirmation.mockResolvedValue(undefined);
      reconciliationService.reconcileFromAlbaran.mockResolvedValue(undefined);

      await service.transitionStatus("alb-1", "t1", AlbaranStatus.CONFIRMADO);

      expect(stockService.processStockOnConfirmation).toHaveBeenCalledWith(
        "alb-1",
        "t1",
      );
      // La conciliación es no-op si no hay purchaseOrderId — pero siempre se
      // invoca tras asentar el stock (el propio servicio decide si hace algo)
      expect(reconciliationService.reconcileFromAlbaran).toHaveBeenCalledWith(
        "alb-1",
        "t1",
      );
    });

    it("is idempotent: CONFIRMADO -> CONFIRMADO is a no-op (no stock, no write)", async () => {
      prisma.albaran.findFirst.mockResolvedValue(
        buildAlbaran({ status: AlbaranStatus.CONFIRMADO }),
      );
      await expect(
        service.transitionStatus("alb-1", "t1", AlbaranStatus.CONFIRMADO),
      ).resolves.toBeUndefined();
      expect(prisma.albaran.updateMany).not.toHaveBeenCalled();
      expect(stockService.processStockOnConfirmation).not.toHaveBeenCalled();
      expect(reconciliationService.reconcileFromAlbaran).not.toHaveBeenCalled();
    });

    it("throws Conflict and skips stock when another request already changed the status", async () => {
      prisma.albaran.findFirst.mockResolvedValue(
        buildAlbaran({ status: AlbaranStatus.REVISADO }),
      );
      prisma.albaran.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.transitionStatus("alb-1", "t1", AlbaranStatus.CONFIRMADO),
      ).rejects.toThrow(ConflictException);
      expect(stockService.processStockOnConfirmation).not.toHaveBeenCalled();
    });

    it("reverts to REVISADO when stock processing fails, so the confirm can be retried", async () => {
      prisma.albaran.findFirst.mockResolvedValue(
        buildAlbaran({ status: AlbaranStatus.REVISADO }),
      );
      prisma.albaran.updateMany.mockResolvedValue({ count: 1 });
      stockService.processStockOnConfirmation.mockRejectedValue(
        new Error("Transaction already closed"),
      );

      await expect(
        service.transitionStatus("alb-1", "t1", AlbaranStatus.CONFIRMADO),
      ).rejects.toThrow("Transaction already closed");

      expect(prisma.albaran.updateMany).toHaveBeenLastCalledWith({
        where: {
          id: "alb-1",
          tenantId: "t1",
          status: AlbaranStatus.CONFIRMADO,
        },
        data: { status: AlbaranStatus.REVISADO },
      });
      expect(reconciliationService.reconcileFromAlbaran).not.toHaveBeenCalled();
    });

    it("reverts to REVISADO when conciliación fails after stock was posted", async () => {
      prisma.albaran.findFirst.mockResolvedValue(
        buildAlbaran({ status: AlbaranStatus.REVISADO }),
      );
      prisma.albaran.updateMany.mockResolvedValue({ count: 1 });
      stockService.processStockOnConfirmation.mockResolvedValue(undefined);
      reconciliationService.reconcileFromAlbaran.mockRejectedValue(
        new Error("boom"),
      );

      await expect(
        service.transitionStatus("alb-1", "t1", AlbaranStatus.CONFIRMADO),
      ).rejects.toThrow("boom");
      expect(prisma.albaran.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: { status: AlbaranStatus.REVISADO } }),
      );
    });
  });
});
