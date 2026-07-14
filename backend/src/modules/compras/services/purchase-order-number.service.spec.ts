import { Test } from "@nestjs/testing";
import { PurchaseOrderNumberService } from "./purchase-order-number.service";
import { PrismaService } from "../../../common/services/prisma.service";

describe("PurchaseOrderNumberService", () => {
  let service: PurchaseOrderNumberService;
  const prismaMock = { $queryRaw: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PurchaseOrderNumberService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(PurchaseOrderNumberService);
  });

  it("genera PED-0001 cuando no hay pedidos", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ max: null }]);
    await expect(service.generateOrderNumber("t1")).resolves.toBe("PED-0001");
  });

  it("continúa la secuencia sobre TODAS las filas (incluidas soft-deleted)", async () => {
    // El MAX viene de SQL crudo que no pasa por el middleware de soft-delete,
    // así que un PED-0007 borrado sigue contando y el siguiente es PED-0008.
    prismaMock.$queryRaw.mockResolvedValue([{ max: 7 }]);
    await expect(service.generateOrderNumber("t1")).resolves.toBe("PED-0008");
  });
});
