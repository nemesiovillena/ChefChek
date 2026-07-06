import { Test, TestingModule } from "@nestjs/testing";
import { AlbaranNumberService } from "./albaran-number.service";
import { PrismaService } from "../../../common/services/prisma.service";

describe("AlbaranNumberService", () => {
  let service: AlbaranNumberService;

  const prisma = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlbaranNumberService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AlbaranNumberService>(AlbaranNumberService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("generateInternalNumber", () => {
    it("returns ALB-0001 when no previous albaran exists", async () => {
      prisma.$queryRaw.mockResolvedValue([{ max: null }]);
      await expect(service.generateInternalNumber("t1")).resolves.toBe(
        "ALB-0001",
      );
    });

    it("increments sequence from the max existing number", async () => {
      prisma.$queryRaw.mockResolvedValue([{ max: 5 }]);
      await expect(service.generateInternalNumber("t1")).resolves.toBe(
        "ALB-0006",
      );
    });

    // Los albaranes soft-borrados siguen ocupando el índice único
    // (tenantId, internalNumber): el SQL calcula el máximo sobre todas las
    // filas, así que un número de un albarán borrado nunca se reutiliza.
    it("does not reuse numbers occupied by soft-deleted albaranes", async () => {
      prisma.$queryRaw.mockResolvedValue([{ max: 2029 }]);
      await expect(service.generateInternalNumber("t1")).resolves.toBe(
        "ALB-2030",
      );
    });

    it("returns ALB-0001 when no row matches the ALB-NNNN pattern", async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      await expect(service.generateInternalNumber("t1")).resolves.toBe(
        "ALB-0001",
      );
    });
  });
});
