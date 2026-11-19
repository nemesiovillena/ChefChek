import { BadRequestException } from "@nestjs/common";
import { AlbaranReturnService } from "./albaran-return.service";

const line = (over: Record<string, unknown> = {}) => ({
  id: "l1",
  description: "MAYONESA PROF HEINZ 5 l",
  quantity: 6,
  unit: "ud",
  unitPrice: 14.95,
  totalPrice: 89.7,
  lineAmount: 89.7,
  vatPercent: 10,
  priceWithVat: null,
  lineOrder: 0,
  lineStatus: "PENDIENTE",
  matchedProductId: "p1",
  ...over,
});

const albaran = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  tenantId: "t1",
  status: "REVISADO",
  albaranNumber: "ALV261120242",
  internalNumber: "ALB-1",
  ocrRawData: { total_amount: 185.86 },
  supplier: { id: "s1", name: "Jasa" },
  lines: [line()],
  ...over,
});

const pendingReturn = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  tenantId: "t1",
  albaranId: "a1",
  description: "Cubo mayonesa",
  quantity: 1,
  unit: "ud",
  reason: "Roto en reparto",
  reportedByName: "Rodrigo",
  reportedAt: new Date("2026-11-19T11:40:00Z"),
  status: "PENDIENTE",
  settlement: null,
  sictedIncidentId: null,
  albaran: albaran(),
  ...over,
});

function setup(
  state: {
    albaran?: unknown;
    ret?: unknown;
    returned?: number;
    sicted?: boolean;
    cuiner?: string;
  } = {},
) {
  const prisma: any = {
    albaran: {
      findFirst: jest.fn(async () => state.albaran ?? albaran()),
      update: jest.fn(),
    },
    albaranLine: {
      create: jest.fn(async ({ data }: any) => ({ id: "neg1", ...data })),
      delete: jest.fn(),
    },
    albaranReturn: {
      create: jest.fn(async ({ data }: any) => ({ id: "r1", ...data })),
      findFirst: jest.fn(async () => state.ret ?? pendingReturn()),
      update: jest.fn(async ({ data }: any) => ({ id: "r1", ...data })),
      aggregate: jest.fn(async () => ({
        _sum: { quantity: state.returned ?? null },
      })),
    },
    sictedSupplierIncident: {
      create: jest.fn(async () => ({ id: "inc1" })),
      updateMany: jest.fn(),
    },
    cuinerAlbaranExport: {
      findUnique: jest.fn(async () =>
        state.cuiner ? { status: state.cuiner } : null,
      ),
    },
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  const modules = {
    isModuleEnabled: jest.fn(async () => state.sicted ?? true),
  };
  const stock = { processAddedLine: jest.fn() };
  const service = new AlbaranReturnService(
    prisma,
    modules as any,
    stock as any,
  );
  return { service, prisma, stock, modules };
}

describe("AlbaranReturnService", () => {
  it("anota la devolución y crea la incidencia SICTED del proveedor", async () => {
    const { service, prisma } = setup({ ret: pendingReturn() });
    await service.create(
      "a1",
      {
        description: "Cubo mayonesa",
        quantity: 1,
        unit: "ud",
        reason: "Roto en reparto",
        reportedByName: "Rodrigo",
      },
      "t1",
      "Cocina",
    );
    expect(prisma.albaranReturn.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reportedByName: "Rodrigo" }),
      }),
    );
    expect(prisma.sictedSupplierIncident.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        supplierId: "s1",
        albaranId: "a1",
        rejectionCause: "Roto en reparto",
        description:
          "Devuelto al repartidor: 1 ud de Cubo mayonesa (albarán ALV261120242)",
        reportedByName: "Rodrigo",
      }),
    });
  });

  it("sin módulo SICTED anota la devolución sin incidencia", async () => {
    const { service, prisma } = setup({ sicted: false });
    await service.create(
      "a1",
      { description: "Cubo", reason: "Roto" },
      "t1",
      "Cocina",
    );
    expect(prisma.sictedSupplierIncident.create).not.toHaveBeenCalled();
  });

  it("descontado en albarán: línea negativa con importe proporcional", async () => {
    const { service, prisma, stock } = setup();
    await service.apply(
      "a1",
      "r1",
      { lineId: "l1", quantity: 1, settlement: "IN_ALBARAN" },
      "t1",
    );
    expect(prisma.albaranLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: "Devolución: MAYONESA PROF HEINZ 5 l",
        quantity: -1,
        unitPrice: 14.95,
        lineAmount: -14.95,
        totalPrice: -14.95,
        lineStatus: "CONFIRMADO",
        matchedProductId: "p1",
      }),
    });
    expect(prisma.albaranReturn.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: expect.objectContaining({
        status: "APLICADA",
        settlement: "IN_ALBARAN",
        appliedLineId: "neg1",
        lineId: "l1",
      }),
    });
    // Con total del papel, los totales del albarán no se tocan.
    expect(prisma.albaran.update).not.toHaveBeenCalled();
    // Sin confirmar: el stock lo mueve la confirmación.
    expect(stock.processAddedLine).not.toHaveBeenCalled();
  });

  it("abono aparte: la línea solo resta cantidad, a 0 €", async () => {
    const { service, prisma } = setup();
    await service.apply(
      "a1",
      "r1",
      { lineId: "l1", quantity: 1, settlement: "CREDIT_NOTE" },
      "t1",
    );
    expect(prisma.albaranLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantity: -1,
        unitPrice: 0,
        totalPrice: 0,
      }),
    });
  });

  it("con el albarán confirmado asienta el stock en el acto", async () => {
    const { service, stock } = setup({
      albaran: albaran({ status: "CONFIRMADO" }),
    });
    await service.apply(
      "a1",
      "r1",
      { lineId: "l1", quantity: 1, settlement: "IN_ALBARAN" },
      "t1",
    );
    expect(stock.processAddedLine).toHaveBeenCalled();
  });

  it("no deja devolver más de lo recibido", async () => {
    const { service } = setup({ returned: 5.5 });
    await expect(
      service.apply(
        "a1",
        "r1",
        { lineId: "l1", quantity: 1, settlement: "IN_ALBARAN" },
        "t1",
      ),
    ).rejects.toThrow("No se puede devolver más de lo recibido");
  });

  it("no aplica sobre un albarán ya enviado a Cuiner", async () => {
    const { service } = setup({
      albaran: albaran({ status: "CONFIRMADO" }),
      cuiner: "ENVIADO",
    });
    await expect(
      service.apply(
        "a1",
        "r1",
        { lineId: "l1", quantity: 1, settlement: "IN_ALBARAN" },
        "t1",
      ),
    ).rejects.toThrow("ya está en Cuiner");
  });

  it("exige que la línea esté vinculada a un artículo", async () => {
    const { service } = setup({
      albaran: albaran({ lines: [line({ matchedProductId: null })] }),
    });
    await expect(
      service.apply(
        "a1",
        "r1",
        { lineId: "l1", quantity: 1, settlement: "IN_ALBARAN" },
        "t1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("descartar cierra la incidencia con la nota", async () => {
    const { service, prisma } = setup({
      ret: pendingReturn({ sictedIncidentId: "inc1" }),
    });
    await service.discard(
      "a1",
      "r1",
      { note: "Al final no se devolvió" },
      "t1",
    );
    expect(prisma.sictedSupplierIncident.updateMany).toHaveBeenCalledWith({
      where: { id: "inc1", resolvedAt: null },
      data: expect.objectContaining({
        resolution: "Anulada: Al final no se devolvió",
      }),
    });
  });
});
