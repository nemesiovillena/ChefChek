import { Test, TestingModule } from "@nestjs/testing";
import { LotNumberService } from "./lot-number.service";
import { PrismaService } from "../../../common/services/prisma.service";

describe("LotNumberService", () => {
  let service: LotNumberService;
  const mockPrisma = { $queryRaw: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LotNumberService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(LotNumberService);
  });

  it("formats the date part as DDMMAA in Europe/Madrid", () => {
    expect(service.formatDatePart(new Date("2026-08-31T10:00:00Z"))).toBe(
      "310826",
    );
  });

  it("starts the daily sequence at 01 when there are no prior labels", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ max: null }]);
    const lot = await service.generateElaboratedLot(
      "t1",
      "Jarrete de ternera",
      new Date("2026-08-31T10:00:00Z"),
    );
    expect(lot).toBe("JARR-310826-01");
  });

  it("continues from the max existing sequence (bigint result from ::BIGINT cast)", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ max: 7n }]);
    const lot = await service.generateElaboratedLot(
      "t1",
      "Paella",
      new Date("2026-08-31T10:00:00Z"),
    );
    expect(lot).toBe("PAEL-310826-08");
  });

  it("scans only ELABORATED lots matching the exact generated pattern", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ max: null }]);
    await service.generateElaboratedLot(
      "t1",
      "Paella",
      new Date("2026-08-31T10:00:00Z"),
    );
    // El SQL template recibe los fragmentos como `values`; comprobamos que el
    // filtro por tipo y el patrón acotado (1-6 dígitos) están presentes.
    const call = mockPrisma.$queryRaw.mock.calls[0];
    const sqlText = call[0].join(" ");
    expect(sqlText).toContain("\"labelType\" = 'ELABORATED'");
    expect(sqlText).toContain("::BIGINT");
    expect(call).toContainEqual("^[A-Z0-9]{1,4}-310826-[0-9]{1,6}$");
  });

  it("bumps the sequence by the retry attempt number", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ max: 2 }]);
    const lot = await service.generateElaboratedLot(
      "t1",
      "Paella",
      new Date("2026-08-31T10:00:00Z"),
      2,
    );
    expect(lot).toBe("PAEL-310826-05");
  });
});
