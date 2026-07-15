import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { InvoiceService } from "./invoice.service";
import { PrismaService } from "../../../common/services/prisma.service";

describe("InvoiceService", () => {
  let service: InvoiceService;

  const prismaMock = {
    invoice: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    purchaseOrder: { findFirst: jest.fn() },
    albaran: { findFirst: jest.fn() },
  };

  const tenantId = "t1";

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(InvoiceService);
  });

  describe("create", () => {
    it("usa el proveedor explícito si se envía", async () => {
      prismaMock.invoice.create.mockResolvedValue({ id: "i1" });
      await service.create(tenantId, {
        invoiceNumber: "F-1",
        supplier: "Pescados SA",
        totalAmount: 100,
        issuedAt: "2026-07-15",
      });
      expect(prismaMock.purchaseOrder.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.invoice.create.mock.calls[0][0].data.supplier).toBe(
        "Pescados SA",
      );
    });

    it("resuelve el proveedor desde el pedido vinculado si no se envía", async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue({
        supplier: { name: "Doria foods" },
      });
      prismaMock.invoice.create.mockResolvedValue({ id: "i1" });
      await service.create(tenantId, {
        invoiceNumber: "F-1",
        totalAmount: 100,
        issuedAt: "2026-07-15",
        purchaseOrderId: "o1",
      });
      expect(prismaMock.invoice.create.mock.calls[0][0].data.supplier).toBe(
        "Doria foods",
      );
    });

    it("400 si no hay proveedor ni vínculo resoluble", async () => {
      await expect(
        service.create(tenantId, {
          invoiceNumber: "F-1",
          totalAmount: 100,
          issuedAt: "2026-07-15",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("findAll", () => {
    it("filtra por purchaseOrderId cuando se pasa", async () => {
      prismaMock.invoice.findMany.mockResolvedValue([]);
      await service.findAll(tenantId, { purchaseOrderId: "o1" });
      expect(prismaMock.invoice.findMany.mock.calls[0][0].where).toEqual({
        tenantId,
        purchaseOrderId: "o1",
      });
    });
  });
});
