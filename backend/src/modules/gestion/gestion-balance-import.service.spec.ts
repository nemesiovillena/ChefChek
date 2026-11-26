import { ConflictException } from "@nestjs/common";
import { GestionBalanceImportService } from "./gestion-balance-import.service";

function make(existing: number) {
  const prisma = {
    gestionExpense: {
      count: jest.fn().mockResolvedValue(existing),
      deleteMany: jest.fn((args) => ({ op: "delete", args })),
      createMany: jest.fn((args) => ({ op: "create", args })),
    },
    gestionAccountingPeriod: {
      upsert: jest.fn((args) => ({ op: "upsert", args })),
    },
    $queryRaw: jest.fn().mockResolvedValue([
      { month: "2026-01", base: 10000 },
      { month: "2026-02", base: 30000 },
    ]),
    $transaction: jest
      .fn()
      .mockResolvedValue([{ count: existing }, { count: 4 }, {}]),
  };
  return {
    prisma,
    service: new GestionBalanceImportService(prisma as any, {} as any),
  };
}

const input = {
  from: "2026-01-01",
  to: "2026-02-28",
  fileName: "balance.pdf",
  accounts: [
    {
      code: "621",
      name: "Alquiler",
      amount: 2000,
      target: "alquiler" as const,
    },
    { code: "640", name: "Sueldos", amount: 8000, target: "personal" as const },
    { code: "700", name: "Ventas", amount: -40000, target: "ventas" as const },
    { code: "600", name: "Compras", amount: 12000, target: "compras" as const },
  ],
};

describe("GestionBalanceImportService.apply", () => {
  it("no pisa gastos ya introducidos sin confirmarlo", async () => {
    const { prisma, service } = make(3);
    await expect(service.apply("t1", input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("reparte cada categoría según las ventas del mes y guarda los totales", async () => {
    const { prisma, service } = make(0);
    const r = await service.apply("t1", input);
    expect(r).toEqual({ months: 2, expenses: 4, replaced: 0 });
    const rows = prisma.gestionExpense.createMany.mock.calls[0][0].data;
    // Enero vende 1/4: 500 de alquiler y 2000 de personal; febrero, el resto.
    expect(
      rows.map((x: any) => [
        x.month.toISOString().slice(0, 7),
        x.category,
        x.amount,
      ]),
    ).toEqual([
      ["2026-01", "alquiler", 500],
      ["2026-02", "alquiler", 1500],
      ["2026-01", "personal", 2000],
      ["2026-02", "personal", 6000],
    ]);
    expect(rows[0].concept).toMatch(/^Balance gestor ene.*feb.* 2026$/);
    expect(
      prisma.gestionAccountingPeriod.upsert.mock.calls[0][0].create,
    ).toMatchObject({
      sales: 40000,
      purchases: 12000,
      labor: 8000,
      overheads: 2000,
      result: 18000,
    });
  });
});
