import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { OfferResolutionService } from "./offer-resolution.service";
import { PrismaService } from "../../../common/services/prisma.service";

describe("OfferResolutionService", () => {
  let service: OfferResolutionService;

  const prismaMock = {
    productSupplierOffer: { findFirst: jest.fn(), findMany: jest.fn() },
    offerLocationSetting: {
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
    product: { findFirst: jest.fn() },
    location: { findFirst: jest.fn() },
  };

  const tenantId = "t1";
  const productId = "p1";

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        OfferResolutionService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(OfferResolutionService);
  });

  it("con supplierId fijo devuelve directamente la oferta de ese proveedor (pedido ya atado)", async () => {
    prismaMock.productSupplierOffer.findFirst.mockResolvedValue({
      id: "offer-sup",
    });
    const result = await service.resolveActiveOffer(tenantId, productId, {
      supplierId: "sup-1",
      locationId: "loc-1", // debe ignorarse: supplierId manda
    });
    expect(result).toEqual({ id: "offer-sup" });
    expect(prismaMock.productSupplierOffer.findFirst).toHaveBeenCalledWith({
      where: { tenantId, productId, supplierId: "sup-1" },
    });
    expect(prismaMock.offerLocationSetting.findFirst).not.toHaveBeenCalled();
  });

  it("sin supplierId, con override habilitado en el local → devuelve esa oferta", async () => {
    prismaMock.offerLocationSetting.findFirst.mockResolvedValue({
      offer: { id: "offer-override", isPreferred: false },
    });
    const result = await service.resolveActiveOffer(tenantId, productId, {
      locationId: "loc-1",
    });
    expect(result).toEqual({ id: "offer-override", isPreferred: false });
    expect(prismaMock.productSupplierOffer.findFirst).not.toHaveBeenCalled();
  });

  it("sin supplierId, sin override en el local → cae a la oferta preferente", async () => {
    prismaMock.offerLocationSetting.findFirst.mockResolvedValue(null);
    prismaMock.productSupplierOffer.findFirst.mockResolvedValue({
      id: "offer-preferred",
      isPreferred: true,
    });
    const result = await service.resolveActiveOffer(tenantId, productId, {
      locationId: "loc-2",
    });
    expect(result).toEqual({ id: "offer-preferred", isPreferred: true });
    expect(prismaMock.productSupplierOffer.findFirst).toHaveBeenCalledWith({
      where: { tenantId, productId, isPreferred: true },
    });
  });

  it("sin locationId ni supplierId → oferta preferente directamente", async () => {
    prismaMock.productSupplierOffer.findFirst.mockResolvedValue({
      id: "offer-preferred",
    });
    const result = await service.resolveActiveOffer(tenantId, productId);
    expect(result).toEqual({ id: "offer-preferred" });
    expect(prismaMock.offerLocationSetting.findFirst).not.toHaveBeenCalled();
  });

  it("local Y sin override sigue usando la preferente aunque local X tenga una activa", async () => {
    // Simula que loc-X tiene override pero consultamos loc-Y (sin fila)
    prismaMock.offerLocationSetting.findFirst.mockImplementation(
      ({ where }: any) =>
        where.locationId === "loc-X" ? { offer: { id: "offer-B" } } : null,
    );
    prismaMock.productSupplierOffer.findFirst.mockResolvedValue({
      id: "offer-preferred",
    });

    const forY = await service.resolveActiveOffer(tenantId, productId, {
      locationId: "loc-Y",
    });
    expect(forY).toEqual({ id: "offer-preferred" });

    const forX = await service.resolveActiveOffer(tenantId, productId, {
      locationId: "loc-X",
    });
    expect(forX).toEqual({ id: "offer-B" });
  });

  describe("compareOffers", () => {
    it("404 si el artículo no es del tenant", async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);
      await expect(service.compareOffers(tenantId, productId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("normaliza precio por unitSize y marca el mejor (caja 5kg vs kg)", async () => {
      prismaMock.product.findFirst.mockResolvedValue({ id: productId });
      prismaMock.productSupplierOffer.findMany.mockResolvedValue([
        {
          id: "offer-caja",
          supplierId: "sup-a",
          supplier: { id: "sup-a", name: "Proveedor Caja" },
          purchasePrice: 50, // caja de 5kg → 10€/kg
          purchaseFormat: "Caja 5kg",
          referenceUnit: "kg",
          unitSize: 5,
          isPreferred: true,
          agreedPrice: null,
        },
        {
          id: "offer-kg",
          supplierId: "sup-b",
          supplier: { id: "sup-b", name: "Proveedor Kg" },
          purchasePrice: 9, // 9€/kg directo → más barato
          purchaseFormat: "kg",
          referenceUnit: "kg",
          unitSize: 1,
          isPreferred: false,
          agreedPrice: null,
        },
      ]);

      const result = await service.compareOffers(tenantId, productId);

      const caja = result.find((r) => r.offerId === "offer-caja")!;
      const kg = result.find((r) => r.offerId === "offer-kg")!;
      expect(caja.referencePrice).toBe(10);
      expect(kg.referencePrice).toBe(9);
      expect(caja.isBestPrice).toBe(false);
      expect(kg.isBestPrice).toBe(true);
    });

    it("con locationId marca isActiveForLocation según resolveActiveOffer", async () => {
      prismaMock.product.findFirst.mockResolvedValue({ id: productId });
      prismaMock.productSupplierOffer.findMany.mockResolvedValue([
        {
          id: "offer-a",
          supplierId: "sup-a",
          supplier: { id: "sup-a", name: "A" },
          purchasePrice: 10,
          purchaseFormat: "kg",
          referenceUnit: "kg",
          unitSize: 1,
          isPreferred: true,
          agreedPrice: null,
        },
        {
          id: "offer-b",
          supplierId: "sup-b",
          supplier: { id: "sup-b", name: "B" },
          purchasePrice: 8,
          purchaseFormat: "kg",
          referenceUnit: "kg",
          unitSize: 1,
          isPreferred: false,
          agreedPrice: null,
        },
      ]);
      // Override activo para offer-b en loc-1
      prismaMock.offerLocationSetting.findFirst.mockResolvedValue({
        offer: { id: "offer-b" },
      });

      const result = await service.compareOffers(tenantId, productId, "loc-1");

      expect(
        result.find((r) => r.offerId === "offer-a")!.isActiveForLocation,
      ).toBe(false);
      expect(
        result.find((r) => r.offerId === "offer-b")!.isActiveForLocation,
      ).toBe(true);
    });

    it("sin ofertas devuelve array vacío", async () => {
      prismaMock.product.findFirst.mockResolvedValue({ id: productId });
      prismaMock.productSupplierOffer.findMany.mockResolvedValue([]);
      await expect(service.compareOffers(tenantId, productId)).resolves.toEqual(
        [],
      );
    });
  });

  describe("setLocationOverride", () => {
    const offer = { id: "offer-1", productId, tenantId };
    const location = { id: "loc-1", tenantId };

    it("404 si la oferta no es del tenant", async () => {
      prismaMock.productSupplierOffer.findFirst.mockResolvedValue(null);
      await expect(
        service.setLocationOverride(tenantId, "offer-1", "loc-1", true),
      ).rejects.toThrow(NotFoundException);
    });

    it("404 si el local no es del tenant", async () => {
      prismaMock.productSupplierOffer.findFirst.mockResolvedValue(offer);
      prismaMock.location.findFirst.mockResolvedValue(null);
      await expect(
        service.setLocationOverride(tenantId, "offer-1", "loc-1", true),
      ).rejects.toThrow(NotFoundException);
    });

    it("enabled=false borra el override (vuelve a la preferente)", async () => {
      prismaMock.productSupplierOffer.findFirst.mockResolvedValue(offer);
      prismaMock.location.findFirst.mockResolvedValue(location);
      await service.setLocationOverride(tenantId, "offer-1", "loc-1", false);
      expect(prismaMock.offerLocationSetting.deleteMany).toHaveBeenCalledWith({
        where: { offerId: "offer-1", locationId: "loc-1" },
      });
      expect(prismaMock.offerLocationSetting.upsert).not.toHaveBeenCalled();
    });

    it("enabled=true desactiva overrides de otras ofertas del mismo producto/local y activa esta", async () => {
      prismaMock.productSupplierOffer.findFirst.mockResolvedValue(offer);
      prismaMock.location.findFirst.mockResolvedValue(location);
      await service.setLocationOverride(tenantId, "offer-1", "loc-1", true);

      expect(prismaMock.offerLocationSetting.deleteMany).toHaveBeenCalledWith({
        where: {
          locationId: "loc-1",
          offer: { tenantId, productId, id: { not: "offer-1" } },
        },
      });
      expect(prismaMock.offerLocationSetting.upsert).toHaveBeenCalledWith({
        where: {
          offerId_locationId: { offerId: "offer-1", locationId: "loc-1" },
        },
        create: {
          tenantId,
          offerId: "offer-1",
          locationId: "loc-1",
          enabled: true,
        },
        update: { enabled: true },
      });
    });
  });
});
