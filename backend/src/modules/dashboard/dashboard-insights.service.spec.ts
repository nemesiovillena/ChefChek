import {
  DashboardInsightsService,
  changePercent,
  spendRanges,
} from "./dashboard-insights.service";

describe("spendRanges", () => {
  it("compara los últimos N días con los N anteriores, sin solaparse", () => {
    const now = new Date("2026-11-24T12:00:00Z");
    const { current, previous } = spendRanges("MONTH", now);
    expect(current.to).toEqual(now);
    expect(current.from).toEqual(new Date("2026-10-25T12:00:00Z"));
    expect(previous.to).toEqual(current.from);
    expect(previous.from).toEqual(new Date("2026-09-25T12:00:00Z"));
  });
});

describe("changePercent", () => {
  it("devuelve null sin periodo anterior con el que comparar", () => {
    expect(changePercent(100, 0)).toBeNull();
  });
  it("calcula la variación sobre el valor anterior", () => {
    expect(changePercent(120, 100)).toBeCloseTo(20);
    expect(changePercent(80, 100)).toBeCloseTo(-20);
  });
});

describe("DashboardInsightsService", () => {
  const prisma = {
    $queryRaw: jest.fn(),
    recipe: { findMany: jest.fn() },
  };
  const recipes = { liveCosts: jest.fn() };
  const costingConfig = { getConfig: jest.fn() };
  const service = new DashboardInsightsService(
    prisma as any,
    recipes as any,
    costingConfig as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it("suma el neto de las líneas por proveedor y lo compara con el periodo anterior", async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          supplierId: "s1",
          supplierName: "Frutas Candela",
          albaranes: 3,
          amount: 300,
        },
        { supplierId: null, supplierName: null, albaranes: 1, amount: 50.004 },
      ])
      .mockResolvedValueOnce([
        {
          supplierId: "s1",
          supplierName: "Frutas Candela",
          albaranes: 2,
          amount: 200,
        },
      ]);

    const { data } = await service.supplierSpend("t1", "MONTH");

    const sql = prisma.$queryRaw.mock.calls[0][0].join(" ");
    expect(sql).toContain(`COALESCE(l."totalPrice", l."lineAmount")`);
    expect(sql).toContain(`'RECHAZADO'`);
    expect(sql).toContain(`('CONFIRMADO', 'ARCHIVADO')`);
    expect(prisma.$queryRaw.mock.calls[0]).toContain("t1");
    expect(data.total).toBe(350);
    expect(data.previousTotal).toBe(200);
    expect(data.suppliers[0]).toMatchObject({
      supplierName: "Frutas Candela",
      amount: 300,
      previousAmount: 200,
      albaranes: 3,
    });
    expect(data.suppliers[0].changePercent).toBeCloseTo(50);
    expect(data.suppliers[1]).toMatchObject({
      supplierName: "Sin proveedor asignado",
      amount: 50,
      changePercent: null,
    });
  });

  it("calcula el % de coste por ración frente al objetivo y separa las recetas sin PVP", async () => {
    costingConfig.getConfig.mockResolvedValue({ targetCostPercentage: 30 });
    prisma.recipe.findMany.mockResolvedValue([
      { id: "r1", name: "Arroz", isDrink: false, sellingPrice: 10 },
      { id: "r2", name: "Gazpacho", isDrink: false, sellingPrice: 8 },
      { id: "r3", name: "Sin precio", isDrink: false, sellingPrice: null },
    ]);
    recipes.liveCosts.mockResolvedValue(
      new Map([
        ["r1", { totalCost: 16, totalCostPerUnit: 0, portions: 4 }],
        ["r2", { totalCost: 2, totalCostPerUnit: 0, portions: 1 }],
      ]),
    );

    const { data } = await service.recipeMargins("t1");

    expect(recipes.liveCosts).toHaveBeenCalledWith("t1", ["r1", "r2"]);
    expect(data.pricedCount).toBe(2);
    expect(data.withoutPriceCount).toBe(1);
    expect(data.recipes[0]).toMatchObject({
      name: "Arroz",
      costPerPortion: 4,
      overTarget: true,
    });
    expect(data.recipes[0].costPercentage).toBeCloseTo(40);
    expect(data.recipes[1].costPercentage).toBeCloseTo(25);
    expect(data.overTargetCount).toBe(1);
    expect(data.averageCostPercentage).toBeCloseTo(32.5);
  });
});
