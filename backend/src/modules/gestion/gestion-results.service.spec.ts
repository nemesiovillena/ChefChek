import { GestionResultsService, madridToday } from "./gestion-results.service";
import { GestionExpensesService } from "./gestion-expenses.service";

function make(extraExpenses: object[] = [], books: object[] = []) {
  const prisma = {
    gestionAccountingPeriod: { findMany: jest.fn().mockResolvedValue(books) },
    $queryRaw: jest.fn().mockImplementation((strings: TemplateStringsArray) =>
      Promise.resolve(
        strings.join("").includes("PENDIENTE")
          ? [{ month: "2025-02", count: 2 }]
          : [
              { month: "2025-01", base: 10000, total: 11000, days: 20 },
              { month: "2025-02", base: 20000, total: 22000, days: 20 },
            ],
      ),
    ),
  };
  const profitability = {
    purchasesByMonth: jest.fn().mockResolvedValue([
      { month: "2025-01", base: 3000, withVat: 3300 },
      { month: "2025-02", base: 6000, withVat: 6600 },
    ]),
    labor: jest.fn().mockResolvedValue([
      {
        employeeId: "e",
        name: "Ana",
        minutes: 0,
        minutesByMonth: { "2025-01": 6000, "2025-02": 6000 },
        hourlyCost: 20,
        cost: 4000,
      },
      {
        employeeId: "f",
        name: "Luis",
        minutes: 0,
        minutesByMonth: { "2025-01": 600 },
        hourlyCost: null,
        cost: null,
      },
    ]),
  };
  const expenses = {
    list: jest.fn().mockResolvedValue([
      {
        id: "x",
        month: "2025-01",
        category: "alquiler",
        concept: "Local",
        amount: 1000,
      },
      {
        id: "y",
        month: "2025-02",
        category: "alquiler",
        concept: "Local",
        amount: 1000,
      },
      ...extraExpenses,
    ]),
  };
  return new GestionResultsService(
    prisma as any,
    profitability as any,
    expenses as any,
  );
}

describe("GestionResultsService", () => {
  it("cuenta de explotación por mes, totales, punto de equilibrio y avisos", async () => {
    const r = await make().build("t1", 2025);
    expect(r.months).toHaveLength(12);
    expect(r.months[0]).toMatchObject({
      sales: 10000,
      purchases: 3000,
      grossMargin: 7000,
      labor: 2000, // 100 h × 20 €
      overheads: 1000,
      ebitda: 4000,
      ebitdaPct: 40,
    });
    expect(r.totals).toMatchObject({
      sales: 30000,
      ebitda: 15000,
      ebitdaPct: 50,
    });
    // Fijos/mes = (4000 + 2000) / 2 = 3000; compras 30 % → 3000 / 0,7 = 4285,71.
    expect(r.breakEven).toEqual({
      monthly: 4285.71,
      daily: 214.29,
      variablePct: 30,
    });
    expect(r.warnings).toEqual({
      laborWithoutCost: 1,
      monthsWithoutOverheads: 0,
      unconfirmedAlbaranes: 2,
      monthsWithoutPurchases: 0,
      laborUnavailable: false,
    });
  });

  it("flujo de caja con IVA y saldo acumulado", async () => {
    const t = await make().table("t1", "flujo-caja", 2025);
    expect(t.rows[0]).toMatchObject({
      inflow: 11000,
      suppliers: 3300,
      labor: 2000,
      overheads: 1000,
      net: 4700,
      balance: 4700,
    });
    expect(t.rows[1]).toMatchObject({ net: 12400, balance: 17100 });
  });
});

describe("GestionResultsService con nóminas y gastos financieros", () => {
  const extra = [
    {
      id: "n",
      month: "2025-02",
      category: "personal",
      concept: "Nóminas + SS",
      amount: 5000,
    },
    {
      id: "i",
      month: "2025-02",
      category: "financieros",
      concept: "Intereses préstamo",
      amount: 100,
    },
  ];

  it("las nóminas sustituyen a los fichajes y los financieros van tras el EBITDA", async () => {
    const r = await make(extra).build("t1", 2025);
    // Enero sin nóminas: sigue saliendo de fichajes.
    expect(r.months[0]).toMatchObject({
      labor: 2000,
      laborSource: "fichajes",
      overheads: 1000,
      financial: 0,
      result: 4000,
    });
    // Febrero: 20000 − 6000 − 5000 (nóminas, no los 2000 fichados) − 1000.
    expect(r.months[1]).toMatchObject({
      labor: 5000,
      laborSource: "real",
      overheads: 1000,
      ebitda: 8000,
      financial: 100,
      result: 7900,
      resultPct: 39.5,
    });
    expect(r.totals).toMatchObject({
      labor: 7000,
      financial: 100,
      result: 11900,
      realLaborMonths: 1,
    });
  });

  it("sin meses de fichajes no avisa de fichas sin coste/hora", async () => {
    const r = await make([
      ...extra,
      {
        id: "n1",
        month: "2025-01",
        category: "personal",
        concept: "Nóminas + SS",
        amount: 4000,
      },
    ]).build("t1", 2025);
    expect(r.warnings.laborWithoutCost).toBe(0);
  });

  it("el flujo de caja descuenta también los financieros", async () => {
    const t = await make(extra).table("t1", "flujo-caja", 2025);
    // 22000 − 6600 − 5000 − (1000 + 100)
    expect(t.rows[1]).toMatchObject({ overheads: 1100, net: 9300 });
  });
});

describe("GestionResultsService cuadre con la contabilidad", () => {
  const book = (from: string, to: string, sales: number) => ({
    periodFrom: new Date(`${from}T00:00:00Z`),
    periodTo: new Date(`${to}T00:00:00Z`),
    fileName: "balance.pdf",
    sales,
    purchases: 12000,
    labor: 9000,
    overheads: 2000,
    financial: 0,
    result: sales - 23000,
  });

  it("compara el balance con Gestión en esos meses y con el año anterior", async () => {
    const r = await make(
      [],
      [
        book("2024-01-01", "2024-02-29", 25000),
        book("2025-01-01", "2025-02-28", 31000),
      ],
    ).build("t1", 2025);
    expect(r.accounting).toHaveLength(1);
    expect(r.accounting[0]).toMatchObject({
      from: "2025-01-01",
      to: "2025-02-28",
      books: { sales: 31000, purchases: 12000, labor: 9000 },
      // Ventas Cuiner, albaranes y fichajes (100 h × 20 € cada mes).
      gestion: {
        sales: 30000,
        purchases: 9000,
        labor: 4000,
        overheads: 2000,
        result: 15000,
      },
      previousBooks: { sales: 25000 },
    });
  });
});

describe("GestionResultsService con compras del balance", () => {
  it("en los meses del balance usa sus compras repartidas por ventas", async () => {
    const r = await make(
      [],
      [
        {
          periodFrom: new Date("2025-01-01T00:00:00Z"),
          periodTo: new Date("2025-02-28T00:00:00Z"),
          fileName: null,
          sales: 30000,
          purchases: 12000,
          labor: 0,
          overheads: 0,
          financial: 0,
          result: 0,
        },
      ],
    ).build("t1", 2025);
    // Ventas 10000 y 20000: 1/3 y 2/3 de 12000.
    expect(r.months[0]).toMatchObject({
      purchases: 4000,
      purchasesWithVat: 4400, // IVA medio de los albaranes (10 %)
      purchasesSource: "contabilidad",
      purchasesAlbaranes: 3000,
      grossMargin: 6000,
    });
    expect(r.months[1]).toMatchObject({ purchases: 8000 });
    expect(r.months[2].purchasesSource).toBe("albaranes");
    expect(r.totals.bookPurchaseMonths).toBe(2);
    // El cuadre sigue comparando con los albaranes.
    expect(r.accounting[0].gestion.purchases).toBe(9000);
  });
});

describe("GestionResultsService sin datos de compras", () => {
  it("no da punto de equilibrio y avisa de los meses sin albaranes", async () => {
    const service = new GestionResultsService(
      {
        gestionAccountingPeriod: { findMany: jest.fn().mockResolvedValue([]) },
        $queryRaw: jest
          .fn()
          .mockResolvedValue([
            { month: "2025-01", base: 10000, total: 11000, days: 20 },
          ]),
      } as any,
      {
        purchasesByMonth: jest.fn().mockResolvedValue([]),
        labor: jest.fn().mockResolvedValue([]),
      } as any,
      {
        list: jest.fn().mockResolvedValue([
          {
            id: "x",
            month: "2025-01",
            category: "alquiler",
            concept: "L",
            amount: 1000,
          },
        ]),
      } as any,
    );
    const r = await service.build("t1", 2025);
    expect(r.breakEven.monthly).toBeNull();
    expect(r.warnings.monthsWithoutPurchases).toBe(1);
  });
});

describe("GestionResultsService en el año en curso", () => {
  afterEach(() => jest.useRealTimers());

  it("el mes en curso, a medias, no rebaja el punto de equilibrio", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2025-03-05T10:00:00Z"));
    const service = make();
    const r = await service.build("t1", 2025);
    expect(r.months.map((m) => m.month)).toEqual([
      "2025-01",
      "2025-02",
      "2025-03",
    ]);
    // Igual que con el año cerrado: marzo (en curso, sin datos) no entra.
    expect(r.breakEven.monthly).toBe(4285.71);
  });
});

describe("madridToday", () => {
  it("el 1 de enero a las 00:30 en Madrid ya es año nuevo", () => {
    expect(madridToday(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });
});

describe("GestionExpensesService", () => {
  it("valida mes, categoría y concepto", async () => {
    const service = new GestionExpensesService({
      gestionExpense: { create: jest.fn() },
    } as any);
    await expect(
      service.create("t1", {
        month: "2025-13",
        category: "alquiler",
        concept: "x",
        amount: 1,
      }),
    ).rejects.toThrow("Mes");
    await expect(
      service.create("t1", {
        month: "2025-01",
        category: "fiesta",
        concept: "x",
        amount: 1,
      }),
    ).rejects.toThrow("Categoría");
    await expect(
      service.create("t1", {
        month: "2025-01",
        category: "alquiler",
        concept: " ",
        amount: 1,
      }),
    ).rejects.toThrow("concepto");
  });

  it("no copia sobre un mes que ya tiene gastos", async () => {
    const prisma = {
      gestionExpense: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn(),
        createMany: jest.fn(),
      },
    };
    const service = new GestionExpensesService(prisma as any);
    await expect(service.copyMonth("t1", "2025-01", "2025-02")).rejects.toThrow(
      "ya tiene gastos",
    );
    expect(prisma.gestionExpense.createMany).not.toHaveBeenCalled();
  });
});
