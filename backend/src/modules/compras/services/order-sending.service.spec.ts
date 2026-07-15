import { Test } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PurchaseOrderStatus } from "@prisma/client";
import { OrderSendingService } from "./order-sending.service";
import { PurchaseOrderPdfService } from "./purchase-order-pdf.service";
import { MailService } from "../../mail/mail.service";
import { PrismaService } from "../../../common/services/prisma.service";

describe("OrderSendingService", () => {
  let service: OrderSendingService;

  const prismaMock = {
    purchaseOrder: { findFirst: jest.fn(), update: jest.fn() },
    purchaseOrderEvent: { create: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as any)),
  };
  const mailMock = { sendMail: jest.fn() };
  const pdfMock = { generate: jest.fn() };

  const tenantId = "t1";
  const baseOrder = {
    id: "o1",
    tenantId,
    orderNumber: "PED-0001",
    status: PurchaseOrderStatus.BORRADOR,
    notes: null,
    supplier: {
      name: "Pescados SA",
      email: "pedidos@pescados.example",
      phone: "912 345 678",
      whatsapp: "612 345 678",
      orderMethods: ["EMAIL", "WHATSAPP", "PHONE"],
    },
    location: null,
    lines: [
      {
        productId: "p1",
        quantity: 3,
        unit: "Caja 5kg",
        product: { name: "Salmón" },
      },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        OrderSendingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MailService, useValue: mailMock },
        { provide: PurchaseOrderPdfService, useValue: pdfMock },
      ],
    }).compile();
    service = module.get(OrderSendingService);
  });

  describe("getSendPreview", () => {
    it("construye texto, canales y wa.me con prefijo 34 para móviles de 9 dígitos", async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(baseOrder);
      const preview = await service.getSendPreview(tenantId, "o1");

      expect(preview.channels).toEqual(["EMAIL", "WHATSAPP", "PHONE"]);
      expect(preview.text).toContain("Pedido PED-0001");
      expect(preview.text).toContain("• Salmón: 3 Caja 5kg");
      expect(preview.whatsappUrl).toMatch(
        /^https:\/\/wa\.me\/34612345678\?text=/,
      );
      expect(preview.email).toBe("pedidos@pescados.example");
    });

    it("404 si el pedido no es del tenant", async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);
      await expect(service.getSendPreview(tenantId, "x")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("send", () => {
    it("400 si el canal no está en orderMethods del proveedor", async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(baseOrder);
      await expect(service.send(tenantId, "o1", "u1", "WEB")).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.purchaseOrder.update).not.toHaveBeenCalled();
    });

    it("400 si el pedido no está en estado enviable", async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue({
        ...baseOrder,
        status: PurchaseOrderStatus.RECIBIDO,
      });
      await expect(service.send(tenantId, "o1", "u1", "EMAIL")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("EMAIL: genera PDF, envía por SMTP y marca ENVIADO con evento SENT", async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(baseOrder);
      pdfMock.generate.mockResolvedValue(Buffer.from("pdf"));
      mailMock.sendMail.mockResolvedValue({ messageId: "x" });
      prismaMock.purchaseOrder.update.mockResolvedValue({ id: "o1" });
      prismaMock.purchaseOrderEvent.create.mockResolvedValue({});

      await service.send(tenantId, "o1", "u1", "EMAIL");

      expect(mailMock.sendMail).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          to: "pedidos@pescados.example",
          subject: "Pedido PED-0001",
          attachments: [expect.objectContaining({ filename: "PED-0001.pdf" })],
        }),
      );
      expect(prismaMock.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PurchaseOrderStatus.ENVIADO,
            sentVia: "EMAIL",
            sentBy: "u1",
          }),
        }),
      );
      expect(prismaMock.purchaseOrderEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: "SENT", channel: "EMAIL" }),
      });
    });

    it("EMAIL con fallo SMTP: NO marca ENVIADO (error visible)", async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(baseOrder);
      pdfMock.generate.mockResolvedValue(Buffer.from("pdf"));
      mailMock.sendMail.mockRejectedValue(
        new BadRequestException("No se pudo enviar el email: auth failed"),
      );

      await expect(service.send(tenantId, "o1", "u1", "EMAIL")).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.purchaseOrder.update).not.toHaveBeenCalled();
    });

    it("WHATSAPP: registra envío manual sin pasar por SMTP", async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue({
        ...baseOrder,
        status: PurchaseOrderStatus.PENDIENTE_ENVIO,
      });
      prismaMock.purchaseOrder.update.mockResolvedValue({ id: "o1" });
      prismaMock.purchaseOrderEvent.create.mockResolvedValue({});

      await service.send(tenantId, "o1", "u1", "WHATSAPP");

      expect(mailMock.sendMail).not.toHaveBeenCalled();
      expect(prismaMock.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sentVia: "WHATSAPP" }),
        }),
      );
    });
  });
});
