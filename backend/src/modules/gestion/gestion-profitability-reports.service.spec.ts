import { GestionProfitabilityReportsService } from "./gestion-profitability-reports.service";
import type { DishSale } from "./gestion-profitability.service";

const dish = (over: Partial<DishSale>): DishSale => ({
  paidUnits: over.units ?? 10,
  key: "P-1",
  name: "Plato",
  family: "SEGUNDOS",
  type: "P",
  units: 10,
  servedUnits: 10,
  base: 100,
  unitCost: 3,
  drink: null,
  recipeId: null,
  ...over,
});

function make(dishes: DishSale[], labor: unknown = [], salesBase = 1000) {
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ base: salesBase }]),
  };
  const data = {
    dishSales: jest.fn().mockResolvedValue(dishes),
    purchases: jest
      .fn()
      .mockResolvedValue([
        { key: "s1", label: "Makro", albaranes: 2, base: 300 },
      ]),
    labor: jest.fn().mockResolvedValue(labor),
  };
  return new GestionProfitabilityReportsService(prisma as any, data as any);
}

describe("GestionProfitabilityReportsService.summary", () => {
  const range = { from: "2026-10-01", to: "2026-10-31" };

  it("food cost sobre ventas, cobertura de lo servido, compras y prime cost", async () => {
    const service = make(
      [
        dish({ key: "P-1", servedUnits: 12, unitCost: 5 }), // 60 € (2 invitadas cuestan)
        dish({ key: "P-2", servedUnits: 8, unitCost: null }), // sin escandallo
      ],
      [
        {
          employeeId: "e",
          name: "Ana",
          minutes: 600,
          hourlyCost: 15,
          cost: 150,
        },
      ],
    );
    const s = await service.summary("t1", range);
    expect(s.foodCost).toEqual({
      total: 60,
      pct: 6,
      coverage: 60,
      unknownDishes: 1,
    });
    expect(s.purchases).toEqual({ total: 300, pct: 30 });
    expect(s.labor).toEqual({ total: 150, pct: 15, hours: 10, withoutCost: 0 });
    expect(s.primeCost).toEqual({ total: 210, pct: 21 });
  });

  it("sin personal calculable (más de un año) no hay prime cost", async () => {
    const service = make([dish({})], null);
    const s = await service.summary("t1", range);
    expect(s.labor).toBeNull();
    expect(s.primeCost).toBeNull();
  });

  it("ingeniería de menú compara dentro de cada familia", async () => {
    const service = make([
      dish({
        key: "B-1",
        family: "BEBIDAS",
        units: 300,
        base: 600,
        unitCost: 0.4,
      }),
      dish({
        key: "B-2",
        family: "BEBIDAS",
        units: 20,
        base: 30,
        unitCost: 0.5,
      }),
      dish({
        key: "S-1",
        family: "SEGUNDOS-CARNES",
        units: 30,
        base: 600,
        unitCost: 8,
      }),
      dish({
        key: "S-2",
        family: "SEGUNDOS-PESCADOS",
        units: 3,
        base: 45,
        unitCost: 10,
      }),
    ]);
    const s = await service.summary("t1", range);
    // Sin agrupar, la caña acapararía la popularidad y el segundo no sería estrella.
    expect(s.menu.estrella).toBe(2);
    expect(s.menu.perro).toBe(2);
  });

  it("ingeniería de menú: precio solo de lo vendido en carta y columna de grupo", async () => {
    const service = make([
      // 10 en carta a 10 € + 30 dentro de un menú a 0 €: precio 10 €, no 2,5 €.
      dish({
        key: "E-1",
        name: "Ensalada",
        family: "ENTRANTES",
        units: 40,
        paidUnits: 10,
        base: 100,
        unitCost: 3,
      }),
      dish({
        key: "E-2",
        name: "Croquetas",
        family: "ENTRANTES",
        units: 10,
        paidUnits: 10,
        base: 80,
        unitCost: 2,
      }),
      dish({
        key: "E-3",
        name: "Pan",
        family: "ENTRANTES",
        units: 2,
        paidUnits: 2,
        base: 4,
        unitCost: 1,
      }),
    ]);
    const table = await service.build("t1", "ingenieria-menu", range);
    const ensalada = table.rows.find((r) => r.name === "Ensalada");
    expect(ensalada).toMatchObject({
      group: "ENTRANTES",
      units: 10,
      price: 10,
      margin: 7,
    });
  });

  it("la cobertura del food cost no cuenta las líneas de menú", async () => {
    const service = make([
      dish({ key: "M-1", type: "M", servedUnits: 50, unitCost: null }),
      dish({ key: "P-1", servedUnits: 50, unitCost: 2 }),
    ]);
    const s = await service.summary("t1", range);
    expect(s.foodCost.coverage).toBe(100);
    expect(s.foodCost.unknownDishes).toBe(0);
  });
});
