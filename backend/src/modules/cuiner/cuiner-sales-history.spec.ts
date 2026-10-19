import { CuinerSaleStatus } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import { CuinerSalesService } from "./cuiner-sales.service";
import { SaleLineDto } from "./dto/cuiner.dto";

const line = (over: Partial<SaleLineDto> = {}): SaleLineDto => ({
  idVentasCab: 100,
  linea: 1,
  fecha: "2024-05-04",
  tipo: "P",
  producto: "00062",
  unidades: 2,
  anulada: false,
  base: 3.6364,
  impuesto: 0.3636,
  invitacion: false,
  ...over,
});

function makePrisma(existing: { idVentasCab: number; linea: number }[] = []) {
  const prisma = {
    cuinerSaleLine: {
      findMany: jest.fn(async () => existing),
      createMany: jest.fn(async (args: { data: unknown[] }) => ({
        count: args.data.length,
      })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    cuinerConfig: {
      updateMany: jest.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: jest.fn(async () => ({ lastVentasCabId: 500 })),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return prisma;
}

const service = (prisma: ReturnType<typeof makePrisma>) =>
  new CuinerSalesService(prisma as unknown as PrismaService);

describe("CuinerSalesService.ingest (ventas en curso)", () => {
  it("guarda base, IVA e invitación de cada línea", async () => {
    const prisma = makePrisma();
    await service(prisma).ingest("t1", {
      cursor: 100,
      lines: [line({ invitacion: true })],
    });
    expect(prisma.cuinerSaleLine.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          base: 3.6364,
          impuesto: 0.3636,
          invitacion: true,
          status: CuinerSaleStatus.PENDIENTE,
        }),
      ],
      skipDuplicates: true,
    });
  });

  it("un conector antiguo sin importes sigue funcionando", async () => {
    const prisma = makePrisma();
    const { base, impuesto, invitacion, ...old } = line();
    void base;
    void impuesto;
    void invitacion;
    await service(prisma).ingest("t1", { cursor: 100, lines: [old] });
    expect(prisma.cuinerSaleLine.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          base: null,
          impuesto: null,
          invitacion: false,
        }),
      ],
      skipDuplicates: true,
    });
  });
});

describe("CuinerSalesService.ingestHistory", () => {
  it("las líneas nuevas entran como HISTORICO: nunca descuentan stock", async () => {
    const prisma = makePrisma();
    const result = await service(prisma).ingestHistory("t1", {
      cursor: 90,
      done: false,
      lines: [line(), line({ linea: 2, anulada: true })],
    });
    const created = (
      prisma.cuinerSaleLine.createMany.mock.calls[0] as unknown as [
        { data: { status: CuinerSaleStatus; anulada: boolean }[] },
      ]
    )[0].data;
    expect(created.map((d) => d.status)).toEqual([
      CuinerSaleStatus.HISTORICO,
      CuinerSaleStatus.HISTORICO,
    ]);
    expect(created[1].anulada).toBe(true);
    expect(result).toEqual({ received: 2, inserted: 2, completed: 0 });
  });

  it("las líneas ya recibidas solo se completan con importes, sin tocar su estado", async () => {
    const prisma = makePrisma([{ idVentasCab: 100, linea: 1 }]);
    const result = await service(prisma).ingestHistory("t1", {
      cursor: 100,
      done: false,
      lines: [line(), line({ linea: 2 })],
    });
    expect(prisma.cuinerSaleLine.updateMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", idVentasCab: 100, linea: 1 },
      data: { base: 3.6364, impuesto: 0.3636, invitacion: false },
    });
    const updateData = (
      prisma.cuinerSaleLine.updateMany.mock.calls[0] as unknown as [
        { data: object },
      ]
    )[0].data;
    expect(updateData).not.toHaveProperty("status");
    expect(result).toEqual({ received: 2, inserted: 1, completed: 1 });
  });

  it("el tope del histórico solo baja y marca el final", async () => {
    const prisma = makePrisma();
    await service(prisma).ingestHistory("t1", {
      cursor: 0,
      done: true,
      lines: [],
    });
    expect(prisma.cuinerConfig.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: "t1",
        OR: [{ historyCursor: null }, { historyCursor: { gt: 0 } }],
      },
      data: { historyCursor: 0 },
    });
    expect(prisma.cuinerConfig.updateMany).toHaveBeenCalledWith({
      where: { tenantId: "t1" },
      data: { historyDone: true },
    });
  });
});
