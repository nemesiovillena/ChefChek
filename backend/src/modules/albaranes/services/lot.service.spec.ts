import { Test, TestingModule } from "@nestjs/testing";
import { LotService } from "./lot.service";

describe("LotService", () => {
  let service: LotService;
  let client: { lot: { create: jest.Mock } };

  beforeEach(async () => {
    client = { lot: { create: jest.fn().mockResolvedValue({ id: "lot-1" }) } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [LotService],
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
});
