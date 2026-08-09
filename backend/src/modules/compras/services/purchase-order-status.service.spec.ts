import { Test } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PurchaseOrderStatus } from "@prisma/client";
import { PurchaseOrderStatusService } from "./purchase-order-status.service";
import { PrismaService } from "../../../common/services/prisma.service";
import { NotificationsService } from "../../core/notifications.service";

describe("PurchaseOrderStatusService", () => {
  let service: PurchaseOrderStatusService;

  const prismaMock = {
    purchaseOrder: { findFirst: jest.fn(), update: jest.fn() },
    purchaseOrderEvent: { create: jest.fn() },
    albaran: { count: jest.fn() },
    purchaseOrderLine: { findFirst: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as any)),
  };
  const notificationsMock = { createNotification: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PurchaseOrderStatusService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationsService, useValue: notificationsMock },
      ],
    }).compile();
    service = module.get(PurchaseOrderStatusService);
  });

  const order = (status: PurchaseOrderStatus, sentAt: Date | null = null) => ({
    id: "o1",
    tenantId: "t1",
    orderNumber: "PED-0001",
    status,
    sentAt,
    supplier: { name: "Proveedor Test" },
  });

  it("404 si el pedido no es del tenant", async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);
    await expect(
      service.transition("t1", "o1", PurchaseOrderStatus.ENVIADO),
    ).rejects.toThrow(NotFoundException);
  });

  it("rechaza transiciones inválidas (BORRADOR → RECIBIDO)", async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue(
      order(PurchaseOrderStatus.BORRADOR),
    );
    await expect(
      service.transition("t1", "o1", PurchaseOrderStatus.RECIBIDO),
    ).rejects.toThrow(BadRequestException);
  });

  it("rechaza salir de estados terminales (RECIBIDO, CANCELADO)", async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue(
      order(PurchaseOrderStatus.RECIBIDO),
    );
    await expect(
      service.transition("t1", "o1", PurchaseOrderStatus.CANCELADO),
    ).rejects.toThrow(BadRequestException);
  });

  it("BORRADOR → ENVIADO manual fija sentAt/sentBy y registra evento", async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue(
      order(PurchaseOrderStatus.BORRADOR),
    );
    prismaMock.purchaseOrder.update.mockResolvedValue({});
    prismaMock.purchaseOrderEvent.create.mockResolvedValue({});

    await service.transition("t1", "o1", PurchaseOrderStatus.ENVIADO, "u1");

    expect(prismaMock.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PurchaseOrderStatus.ENVIADO,
          sentBy: "u1",
          sentAt: expect.any(Date),
        }),
      }),
    );
    expect(prismaMock.purchaseOrderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "STATUS_CHANGED",
        payload: { from: "BORRADOR", to: "ENVIADO" },
      }),
    });
  });

  it("ENVIADO → RECIBIDO_PARCIAL no toca sentAt (ya fijado)", async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue(
      order(PurchaseOrderStatus.ENVIADO, new Date("2026-07-01")),
    );
    prismaMock.purchaseOrder.update.mockResolvedValue({});
    prismaMock.purchaseOrderEvent.create.mockResolvedValue({});

    await service.transition(
      "t1",
      "o1",
      PurchaseOrderStatus.RECIBIDO_PARCIAL,
      "u1",
    );

    const data = prismaMock.purchaseOrder.update.mock.calls[0][0].data;
    expect(data.sentAt).toBeUndefined();
    expect(notificationsMock.createNotification).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ type: "PARTIAL_ORDER_RECEIVED" }),
    );
  });

  it("BORRADOR → ENVIADO no dispara la alerta de recepción parcial", async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue(
      order(PurchaseOrderStatus.BORRADOR),
    );
    prismaMock.purchaseOrder.update.mockResolvedValue({});
    prismaMock.purchaseOrderEvent.create.mockResolvedValue({});

    await service.transition("t1", "o1", PurchaseOrderStatus.ENVIADO, "u1");

    expect(notificationsMock.createNotification).not.toHaveBeenCalled();
  });

  describe("revertToDraft", () => {
    it("404 si el pedido no es del tenant", async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);
      await expect(
        service.revertToDraft("t1", "o1", "u1", "motivo de prueba largo"),
      ).rejects.toThrow(NotFoundException);
    });

    it("rechaza revertir desde BORRADOR/PENDIENTE_ENVIO (no aplica)", async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(
        order(PurchaseOrderStatus.BORRADOR),
      );
      await expect(
        service.revertToDraft("t1", "o1", "u1", "motivo de prueba largo"),
      ).rejects.toThrow(BadRequestException);
    });

    it("bloquea si hay albarán vinculado", async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(
        order(PurchaseOrderStatus.RECIBIDO),
      );
      prismaMock.albaran.count.mockResolvedValue(1);
      prismaMock.purchaseOrderLine.findFirst.mockResolvedValue(null);

      await expect(
        service.revertToDraft("t1", "o1", "u1", "motivo de prueba largo"),
      ).rejects.toThrow(ConflictException);
    });

    it("bloquea si alguna línea tiene receivedQuantity", async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(
        order(PurchaseOrderStatus.RECIBIDO),
      );
      prismaMock.albaran.count.mockResolvedValue(0);
      prismaMock.purchaseOrderLine.findFirst.mockResolvedValue({
        id: "l1",
        receivedQuantity: 4,
      });

      await expect(
        service.revertToDraft("t1", "o1", "u1", "motivo de prueba largo"),
      ).rejects.toThrow(ConflictException);
    });

    it("revierte RECIBIDO → BORRADOR sin albarán/recepción, limpia sentAt y registra evento", async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(
        order(PurchaseOrderStatus.RECIBIDO, new Date("2026-08-03")),
      );
      prismaMock.albaran.count.mockResolvedValue(0);
      prismaMock.purchaseOrderLine.findFirst.mockResolvedValue(null);
      prismaMock.purchaseOrder.update.mockResolvedValue({});
      prismaMock.purchaseOrderEvent.create.mockResolvedValue({});

      await service.revertToDraft(
        "t1",
        "o1",
        "u1",
        "el usuario lo marco por error",
      );

      expect(prismaMock.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PurchaseOrderStatus.BORRADOR,
            sentAt: null,
            sentVia: null,
            sentBy: null,
          }),
        }),
      );
      expect(prismaMock.purchaseOrderEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "STATUS_CHANGED",
          channel: "ADMIN_REVERT",
          payload: {
            from: "RECIBIDO",
            to: "BORRADOR",
            reason: "el usuario lo marco por error",
          },
        }),
      });
    });
  });
});
