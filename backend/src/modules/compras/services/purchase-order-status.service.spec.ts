import { Test } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PurchaseOrderStatus } from "@prisma/client";
import { PurchaseOrderStatusService } from "./purchase-order-status.service";
import { PrismaService } from "../../../common/services/prisma.service";

describe("PurchaseOrderStatusService", () => {
  let service: PurchaseOrderStatusService;

  const prismaMock = {
    purchaseOrder: { findFirst: jest.fn(), update: jest.fn() },
    purchaseOrderEvent: { create: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as any)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PurchaseOrderStatusService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(PurchaseOrderStatusService);
  });

  const order = (status: PurchaseOrderStatus, sentAt: Date | null = null) => ({
    id: "o1",
    tenantId: "t1",
    status,
    sentAt,
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
  });
});
