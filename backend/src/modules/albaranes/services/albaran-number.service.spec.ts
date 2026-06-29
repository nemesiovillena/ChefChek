import { Test, TestingModule } from "@nestjs/testing";
import { AlbaranNumberService } from "./albaran-number.service";
import { PrismaService } from "../../../common/services/prisma.service";

describe("AlbaranNumberService", () => {
  let service: AlbaranNumberService;

  const prisma = {
    albaran: { findFirst: jest.fn() },
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
      prisma.albaran.findFirst.mockResolvedValue(null);
      await expect(service.generateInternalNumber("t1")).resolves.toBe(
        "ALB-0001",
      );
    });

    it("returns ALB-0001 when previous albaran has no internalNumber", async () => {
      prisma.albaran.findFirst.mockResolvedValue({ internalNumber: null });
      await expect(service.generateInternalNumber("t1")).resolves.toBe(
        "ALB-0001",
      );
    });

    it("increments sequence from last internalNumber", async () => {
      prisma.albaran.findFirst.mockResolvedValue({
        internalNumber: "ALB-0005",
      });
      await expect(service.generateInternalNumber("t1")).resolves.toBe(
        "ALB-0006",
      );
    });

    it("resets to ALB-0001 when internalNumber does not match ALB-n pattern", async () => {
      prisma.albaran.findFirst.mockResolvedValue({
        internalNumber: "CUSTOM-99",
      });
      await expect(service.generateInternalNumber("t1")).resolves.toBe(
        "ALB-0001",
      );
    });
  });
});
