import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { ProductSupplierOffersService } from "./product-supplier-offers.service";
import { PrismaService } from "../../common/services/prisma.service";

describe("ProductSupplierOffersService", () => {
  let service: ProductSupplierOffersService;
  let prisma: jest.Mocked<PrismaService>;

  const tenantId = "tenant-1";
  const productId = "product-1";
  const supplierId = "supplier-a";

  const baseProduct = {
    id: productId,
    tenantId,
    supplierId: "supplier-a",
    purchasePrice: 10,
    previousPurchasePrice: 0,
    netPrice: 10,
    purchaseFormat: "Caja",
    referenceUnit: "kg",
    unitsPerFormat: 1,
    referenceUnitSize: 1,
    unitSize: 1,
    profitMargin: 0,
  };

  const makeTx = () => ({
    product: { findFirst: jest.fn(), update: jest.fn() },
    productSupplierOffer: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    productPriceHistory: { create: jest.fn() },
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductSupplierOffersService,
        {
          provide: PrismaService,
          useValue: {
            product: { findFirst: jest.fn(), update: jest.fn() },
            productSupplierOffer: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            productPriceHistory: { create: jest.fn() },
            $transaction: jest.fn((fn) => fn(makeTx())),
          },
        },
      ],
    }).compile();

    service = module.get(ProductSupplierOffersService);
    prisma = module.get(PrismaService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("upsertOffer", () => {
    it("creates a new non-preferred offer without touching Product", async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(baseProduct);
      (prisma.productSupplierOffer.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      // Ya existe una oferta previa (de otro proveedor) -> la nueva no es
      // la primera, así que no se marca preferente (offerCount === 0 sería
      // el único caso que sí la marca).
      (prisma.productSupplierOffer.count as jest.Mock).mockResolvedValue(1);
      (prisma.productSupplierOffer.create as jest.Mock).mockResolvedValue({
        id: "offer-dialvi",
        productId,
        supplierId: "supplier-dialvi",
        purchasePrice: 6.53,
        previousPurchasePrice: 0,
        netPrice: 6.53,
        purchaseFormat: "",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 1,
        unitSize: 1,
        profitMargin: 0,
        isPreferred: false,
      });

      const offer = await service.upsertOffer(
        productId,
        "supplier-dialvi",
        tenantId,
        { purchasePrice: 6.53 },
      );

      expect(offer.isPreferred).toBe(false);
      expect(prisma.product.findFirst).toHaveBeenCalledWith({
        where: { id: productId, tenantId },
      });
    });

    it("throws if the product does not exist", async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.upsertOffer(productId, supplierId, tenantId, {
          purchasePrice: 6.53,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("syncs Product flat fields when the affected offer is preferred", async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(baseProduct);
      (prisma.productSupplierOffer.findFirst as jest.Mock).mockResolvedValue({
        id: "offer-a",
        productId,
        supplierId,
        purchasePrice: 10,
        previousPurchasePrice: 0,
        netPrice: 10,
        purchaseFormat: "Caja",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 1,
        unitSize: 1,
        profitMargin: 0,
        isPreferred: true,
      });
      (prisma.productSupplierOffer.update as jest.Mock).mockResolvedValue({
        id: "offer-a",
        productId,
        supplierId,
        purchasePrice: 12,
        previousPurchasePrice: 10,
        netPrice: 12,
        purchaseFormat: "Caja",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 1,
        unitSize: 1,
        profitMargin: 0,
        isPreferred: true,
      });

      await service.upsertOffer(productId, supplierId, tenantId, {
        purchasePrice: 12,
      });

      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: productId },
          data: expect.objectContaining({ purchasePrice: 12, supplierId }),
        }),
      );
      expect(prisma.productPriceHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ previousPrice: 10, newPrice: 12 }),
        }),
      );
    });

    it("mismo €/kg con distinto tamaño de caja NO crea fila de historial", async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(baseProduct);
      (prisma.productSupplierOffer.findFirst as jest.Mock).mockResolvedValue({
        id: "offer-a",
        productId,
        supplierId,
        purchasePrice: 100,
        previousPurchasePrice: 0,
        netPrice: 100,
        purchaseFormat: "Caja",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 10,
        unitSize: 10,
        profitMargin: 0,
        isPreferred: false,
      });
      (prisma.productSupplierOffer.update as jest.Mock).mockResolvedValue({
        id: "offer-a",
        productId,
        supplierId,
        purchasePrice: 50,
        previousPurchasePrice: 0,
        netPrice: 50,
        purchaseFormat: "Caja",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 5,
        unitSize: 5,
        profitMargin: 0,
        isPreferred: false,
      });

      // Caja más pequeña (10kg -> 5kg) a mitad de precio (100€ -> 50€): mismo
      // €/kg (10€/kg) — no debe registrar variación falsa en el histórico.
      await service.upsertOffer(productId, supplierId, tenantId, {
        purchasePrice: 50,
        referenceUnitSize: 5,
      });

      expect(prisma.productPriceHistory.create).not.toHaveBeenCalled();
      // El campo plano previousPurchasePrice sigue disparándose con el precio
      // crudo (contrato sin cambios, fuera de alcance de la normalización).
      expect(prisma.productSupplierOffer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ previousPurchasePrice: 100 }),
        }),
      );
    });

    it("ruido de redondeo en €/kg (caso real: jarrete de cordero) NO crea fila de historial", async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(baseProduct);
      (prisma.productSupplierOffer.findFirst as jest.Mock).mockResolvedValue({
        id: "offer-a",
        productId,
        supplierId,
        purchasePrice: 80.91,
        previousPurchasePrice: 0,
        netPrice: 80.91,
        purchaseFormat: "Caja",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 6.5,
        unitSize: 6.5,
        profitMargin: 0,
        isPreferred: false,
      });
      (prisma.productSupplierOffer.update as jest.Mock).mockResolvedValue({
        id: "offer-a",
        productId,
        supplierId,
        purchasePrice: 49.79,
        previousPurchasePrice: 80.91,
        netPrice: 49.79,
        purchaseFormat: "Caja",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 4,
        unitSize: 4,
        profitMargin: 0,
        isPreferred: false,
      });

      // 80.91/6.5 = 12.4477€/kg vs 49.79/4 = 12.4475€/kg: mismo precio real por
      // kg, la diferencia es solo redondeo de cantidad/precio a 2 decimales —
      // no debe registrarse como variación (tolerancia epsilon).
      await service.upsertOffer(productId, supplierId, tenantId, {
        purchasePrice: 49.79,
        referenceUnitSize: 4,
      });

      expect(prisma.productPriceHistory.create).not.toHaveBeenCalled();
    });

    it("€/kg realmente distinto SÍ crea fila de historial con unitSize snapshoteado", async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(baseProduct);
      (prisma.productSupplierOffer.findFirst as jest.Mock).mockResolvedValue({
        id: "offer-a",
        productId,
        supplierId,
        purchasePrice: 100,
        previousPurchasePrice: 0,
        netPrice: 100,
        purchaseFormat: "Caja",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 10,
        unitSize: 10,
        profitMargin: 0,
        isPreferred: false,
      });
      (prisma.productSupplierOffer.update as jest.Mock).mockResolvedValue({
        id: "offer-a",
        productId,
        supplierId,
        purchasePrice: 60,
        previousPurchasePrice: 100,
        netPrice: 60,
        purchaseFormat: "Caja",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 5,
        unitSize: 5,
        profitMargin: 0,
        isPreferred: false,
      });

      // 10€/kg -> 12€/kg: variación real, sí debe registrarse.
      await service.upsertOffer(productId, supplierId, tenantId, {
        purchasePrice: 60,
        referenceUnitSize: 5,
      });

      expect(prisma.productPriceHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            previousPrice: 100,
            newPrice: 60,
            previousUnitSize: 10,
            newUnitSize: 5,
          }),
        }),
      );
    });

    describe("agreedPrice (precio pactado)", () => {
      const existingOffer = {
        id: "offer-a",
        productId,
        supplierId,
        purchasePrice: 12,
        previousPurchasePrice: 10,
        netPrice: 12,
        purchaseFormat: "Caja",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 1,
        unitSize: 1,
        profitMargin: 0,
        isPreferred: false,
        agreedPrice: null,
        agreedAt: null,
        agreedUntil: null,
      };

      it("no enviar agreedPrice no toca el pacto existente", async () => {
        (prisma.product.findFirst as jest.Mock).mockResolvedValue(baseProduct);
        (prisma.productSupplierOffer.findFirst as jest.Mock).mockResolvedValue({
          ...existingOffer,
          agreedPrice: 9.5,
        });
        (prisma.productSupplierOffer.update as jest.Mock).mockResolvedValue({});

        await service.upsertOffer(productId, supplierId, tenantId, {
          purchasePrice: 12,
        });

        const data = (prisma.productSupplierOffer.update as jest.Mock).mock
          .calls[0][0].data;
        expect(data).not.toHaveProperty("agreedPrice");
        expect(data).not.toHaveProperty("agreedAt");
      });

      it("fijar un agreedPrice nuevo estampa agreedAt", async () => {
        (prisma.product.findFirst as jest.Mock).mockResolvedValue(baseProduct);
        (prisma.productSupplierOffer.findFirst as jest.Mock).mockResolvedValue(
          existingOffer,
        );
        (prisma.productSupplierOffer.update as jest.Mock).mockResolvedValue({});

        await service.upsertOffer(productId, supplierId, tenantId, {
          purchasePrice: 12,
          agreedPrice: 10.4,
        });

        const data = (prisma.productSupplierOffer.update as jest.Mock).mock
          .calls[0][0].data;
        expect(data.agreedPrice).toBe(10.4);
        expect(data.agreedAt).toBeInstanceOf(Date);
      });

      it("reenviar el mismo agreedPrice sin cambios no reestampa agreedAt", async () => {
        const oldAgreedAt = new Date("2026-01-01");
        (prisma.product.findFirst as jest.Mock).mockResolvedValue(baseProduct);
        (prisma.productSupplierOffer.findFirst as jest.Mock).mockResolvedValue({
          ...existingOffer,
          agreedPrice: 10.4,
          agreedAt: oldAgreedAt,
        });
        (prisma.productSupplierOffer.update as jest.Mock).mockResolvedValue({});

        await service.upsertOffer(productId, supplierId, tenantId, {
          purchasePrice: 12,
          agreedPrice: 10.4,
        });

        const data = (prisma.productSupplierOffer.update as jest.Mock).mock
          .calls[0][0].data;
        expect(data.agreedAt).toBe(oldAgreedAt);
      });

      it("enviar agreedPrice: null limpia el pacto (agreedPrice y agreedAt)", async () => {
        (prisma.product.findFirst as jest.Mock).mockResolvedValue(baseProduct);
        (prisma.productSupplierOffer.findFirst as jest.Mock).mockResolvedValue({
          ...existingOffer,
          agreedPrice: 10.4,
          agreedAt: new Date("2026-01-01"),
        });
        (prisma.productSupplierOffer.update as jest.Mock).mockResolvedValue({});

        await service.upsertOffer(productId, supplierId, tenantId, {
          purchasePrice: 12,
          agreedPrice: null,
        });

        const data = (prisma.productSupplierOffer.update as jest.Mock).mock
          .calls[0][0].data;
        expect(data.agreedPrice).toBeNull();
        expect(data.agreedAt).toBeNull();
      });

      it("agreedUntil se pasa como Date; ausente no lo toca", async () => {
        (prisma.product.findFirst as jest.Mock).mockResolvedValue(baseProduct);
        (prisma.productSupplierOffer.findFirst as jest.Mock).mockResolvedValue(
          existingOffer,
        );
        (prisma.productSupplierOffer.update as jest.Mock).mockResolvedValue({});

        await service.upsertOffer(productId, supplierId, tenantId, {
          purchasePrice: 12,
          agreedUntil: "2026-12-31",
        });

        const data = (prisma.productSupplierOffer.update as jest.Mock).mock
          .calls[0][0].data;
        expect(data.agreedUntil).toEqual(new Date("2026-12-31"));
      });
    });
  });

  describe("setPreferred", () => {
    it("unmarks the previous preferred offer and syncs Product", async () => {
      const tx = makeTx();
      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(tx));
      tx.productSupplierOffer.findFirst.mockResolvedValue({
        id: "offer-dialvi",
        productId,
        supplierId: "supplier-dialvi",
        isPreferred: false,
      });
      tx.productSupplierOffer.update.mockResolvedValue({
        id: "offer-dialvi",
        productId,
        supplierId: "supplier-dialvi",
        purchasePrice: 6.53,
        previousPurchasePrice: 0,
        netPrice: 6.53,
        purchaseFormat: "",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 1,
        unitSize: 1,
        profitMargin: 0,
        isPreferred: true,
      });
      tx.product.findFirst.mockResolvedValue(baseProduct);

      await service.setPreferred(productId, "offer-dialvi", tenantId);

      expect(tx.productSupplierOffer.updateMany).toHaveBeenCalledWith({
        where: { productId, isPreferred: true, id: { not: "offer-dialvi" } },
        data: { isPreferred: false },
      });
      expect(tx.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            purchasePrice: 6.53,
            supplierId: "supplier-dialvi",
            // El precio anterior a mostrar es el que tenía el producto antes
            // de este cambio (10, baseProduct), no el histórico propio de la
            // oferta recién promovida (0, nunca cambió de precio por sí sola).
            previousPurchasePrice: 10,
          }),
        }),
      );
      expect(tx.productPriceHistory.create).toHaveBeenCalled();
    });

    it("cambiar a una oferta con mismo €/kg pero distinto unitSize NO crea historial", async () => {
      const tx = makeTx();
      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(tx));
      tx.productSupplierOffer.findFirst.mockResolvedValue({
        id: "offer-b",
        productId,
        supplierId: "supplier-b",
        isPreferred: false,
      });
      tx.productSupplierOffer.update.mockResolvedValue({
        id: "offer-b",
        productId,
        supplierId: "supplier-b",
        purchasePrice: 20, // baseProduct: 10€ / unitSize 1 = 10€/kg
        previousPurchasePrice: 0,
        netPrice: 20,
        purchaseFormat: "Caja",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 2,
        unitSize: 2, // 20€ / 2kg = 10€/kg — mismo €/kg que baseProduct
        profitMargin: 0,
        isPreferred: true,
      });
      tx.product.findFirst.mockResolvedValue(baseProduct);

      await service.setPreferred(productId, "offer-b", tenantId);

      expect(tx.productPriceHistory.create).not.toHaveBeenCalled();
    });

    it("throws if the offer does not exist", async () => {
      const tx = makeTx();
      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(tx));
      tx.productSupplierOffer.findFirst.mockResolvedValue(null);

      await expect(
        service.setPreferred(productId, "missing-offer", tenantId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("removeOffer", () => {
    it("blocks removing the only preferred offer without a promotion target", async () => {
      const tx = makeTx();
      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(tx));
      tx.productSupplierOffer.findFirst.mockResolvedValue({
        id: "offer-a",
        productId,
        isPreferred: true,
      });
      tx.productSupplierOffer.count.mockResolvedValue(1);

      await expect(service.removeOffer("offer-a", tenantId)).rejects.toThrow(
        BadRequestException,
      );
      expect(tx.productSupplierOffer.update).not.toHaveBeenCalled();
    });

    it("allows removing the only offer of a product", async () => {
      const tx = makeTx();
      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(tx));
      tx.productSupplierOffer.findFirst.mockResolvedValue({
        id: "offer-a",
        productId,
        isPreferred: true,
      });
      tx.productSupplierOffer.count.mockResolvedValue(0);

      await service.removeOffer("offer-a", tenantId);

      // Soft-delete: nunca `.delete()` dentro de una transacción (el middleware
      // de soft-delete no cubre el cliente `tx`, sería borrado físico real).
      expect(tx.productSupplierOffer.update).toHaveBeenCalledWith({
        where: { id: "offer-a" },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it("promotes the given offer when removing the preferred one", async () => {
      const tx = makeTx();
      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(tx));
      tx.productSupplierOffer.findFirst.mockResolvedValue({
        id: "offer-a",
        productId,
        isPreferred: true,
      });
      tx.productSupplierOffer.count.mockResolvedValue(1);
      tx.productSupplierOffer.update.mockResolvedValue({
        id: "offer-dialvi",
        productId,
        supplierId: "supplier-dialvi",
        purchasePrice: 6.53,
        previousPurchasePrice: 0,
        netPrice: 6.53,
        purchaseFormat: "",
        referenceUnit: "kg",
        unitsPerFormat: 1,
        referenceUnitSize: 1,
        unitSize: 1,
        profitMargin: 0,
        isPreferred: true,
      });

      await service.removeOffer("offer-a", tenantId, "offer-dialvi");

      expect(tx.productSupplierOffer.update).toHaveBeenCalledWith({
        where: { id: "offer-a" },
        data: { deletedAt: expect.any(Date) },
      });
      expect(tx.productSupplierOffer.update).toHaveBeenCalledWith({
        where: { id: "offer-dialvi" },
        data: { isPreferred: true },
      });
      expect(tx.product.update).toHaveBeenCalled();
    });
  });
});
