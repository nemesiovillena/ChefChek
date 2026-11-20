import { LabelPrintLogService } from "./label-print-log.service";

describe("LabelPrintLogService", () => {
  const prisma = {
    labelPrintLog: {
      deleteMany: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: "log1" }),
      findMany: jest.fn(),
    },
  };
  const service = new LabelPrintLogService(prisma as any);

  beforeEach(() => jest.clearAllMocks());

  it("guarda el intento con quién lo hizo y borra lo de hace más de 90 días", async () => {
    await service.create(
      "t1",
      { id: "u1", name: " Cocina " },
      {
        outcome: "ERROR",
        errorMessage: "Error writing to port",
        calibrated: true,
        format: "thermal:57x32",
        copies: 2,
        steps: [{ t: 0, step: "status", data: { paperOut: true } }],
      },
      "Edge",
    );

    const cutoff = prisma.labelPrintLog.deleteMany.mock.calls[0][0].where
      .createdAt.lt as Date;
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(
      90 * 24 * 3600 * 1000 - 1000,
    );
    expect(prisma.labelPrintLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "t1",
          userId: "u1",
          userName: "Cocina",
          outcome: "ERROR",
          calibrated: true,
          userAgent: "Edge",
          steps: [{ t: 0, step: "status", data: { paperOut: true } }],
        }),
      }),
    );
  });

  it("lista las últimas del tenant con un tope", async () => {
    await service.list("t1", 1000);
    expect(prisma.labelPrintLog.findMany).toHaveBeenCalledWith({
      where: { tenantId: "t1" },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  });
});
