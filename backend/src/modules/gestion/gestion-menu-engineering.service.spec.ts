import {
  GestionMenuEngineeringService,
  scopeOfGroups,
} from "./gestion-menu-engineering.service";
import type { DishSale } from "./gestion-profitability.service";

const dish = (over: Partial<DishSale>): DishSale => ({
  key: "P-1",
  name: "Plato",
  family: "ARROCES",
  type: "P",
  units: 10,
  paidUnits: over.units ?? 10,
  servedUnits: over.units ?? 10,
  base: 100,
  unitCost: 3,
  drink: false,
  recipeId: null,
  ...over,
});

const ARROCES: DishSale[] = [
  dish({ key: "P-1", name: "Boquerones", units: 20, base: 235.4, unitCost: 3 }),
  dish({ key: "P-2", name: "Mero", units: 70, base: 1235.5, unitCost: 4.5 }),
  dish({ key: "P-3", name: "Pulpo", units: 20, base: 329.6, unitCost: 3.75 }),
  dish({ key: "P-4", name: "Tabarca", units: 60, base: 594, unitCost: 1.12 }),
  dish({ key: "P-5", name: "Bacalao", units: 30, base: 481.5, unitCost: 6.5 }),
];

function make(
  current: DishSale[],
  previous: DishSale[] = [],
  opts: { cancellations?: unknown } = {},
) {
  const prisma = {
    $queryRaw: jest.fn((strings: TemplateStringsArray) => {
      const sql = strings.join("?");
      if (sql.includes("s.anulada = true")) {
        return Promise.resolve([
          opts.cancellations ?? { tickets: 2, lines: 3, total: 40 },
        ]);
      }
      return Promise.resolve([]);
    }),
  };
  const data = {
    dishSales: jest.fn((_t: string, r: { from: string }) =>
      Promise.resolve(r.from === "2026-10-01" ? current : previous),
    ),
    purchases: jest.fn().mockResolvedValue([
      { key: "c1", label: "Pescado", albaranes: 3, base: 600 },
      { key: "c2", label: "Arroz", albaranes: 1, base: 200 },
      { key: "c3", label: "Limpieza", albaranes: 1, base: 50 },
    ]),
  };
  return new GestionMenuEngineeringService(prisma as any, data as any);
}

const RANGE = { from: "2026-10-01", to: "2026-10-31" };

describe("GestionMenuEngineeringService.analysis", () => {
  it("matriz de la familia con totales, medias y cortes de la hoja Arroces", async () => {
    const a = await make(ARROCES).analysis("t1", RANGE);
    expect(a.group).toBe("ARROCES");
    expect(a.previousRange).toEqual({ from: "2026-08-31", to: "2026-09-30" });
    expect(a.matrix.thresholds).toEqual({ popularity: 20, margin: 10.82 });
    expect(a.matrix.totals).toMatchObject({
      units: 200,
      totalCost: 712.2,
      revenue: 2876,
      totalMargin: 2163.8,
    });
    expect(a.matrix.simpleMeans).toEqual({
      cost: 3.77,
      price: 14.37,
      margin: 10.6,
    });
    expect(a.matrix.weightedMeans).toEqual({
      cost: 3.56,
      price: 14.38,
      margin: 10.82,
    });
    const cls = Object.fromEntries(
      a.matrix.rows.map((r) => [r.name, r.menuClass]),
    );
    expect(cls).toEqual({
      Boquerones: "perro",
      Mero: "estrella",
      Pulpo: "puzzle",
      Tabarca: "caballo",
      Bacalao: "perro",
    });
  });

  it("marca el cambio de clase frente al periodo anterior", async () => {
    // Antes el Tabarca vendía poco: era Perro.
    const previous = ARROCES.map((d) =>
      d.key === "P-4" ? { ...d, units: 5, paidUnits: 5, base: 49.5 } : d,
    );
    const a = await make(ARROCES, previous).analysis("t1", {
      from: "2026-10-01",
      to: "2026-10-31",
    });
    const tabarca = a.matrix.rows.find((r) => r.name === "Tabarca");
    expect(tabarca?.previousClass).toBe("perro");
    expect(tabarca?.menuClass).toBe("caballo");
  });

  it("separa comida y bebida y deja fuera los platos sin coste", async () => {
    const dishes = [
      ...ARROCES,
      dish({ key: "P-9", name: "Arroz nuevo", unitCost: null }),
      dish({ key: "B-1", name: "Caña", family: "CERVEZAS", drink: true }),
    ];
    const food = await make(dishes).analysis("t1", RANGE);
    expect(food.groups.map((g) => g.name)).toEqual(["ARROCES"]);
    expect(food.matrix.withoutCost.map((d) => d.name)).toEqual(["Arroz nuevo"]);
    expect(food.matrix.rows).toHaveLength(5);

    // Todos los platos de comida, cada uno con la clase de su familia.
    expect(food.allDishes.map((d) => d.name)).toEqual([
      "Mero",
      "Tabarca",
      "Bacalao",
      "Pulpo",
      "Boquerones",
      "Arroz nuevo",
    ]);
    expect(food.allDishes.find((d) => d.name === "Arroz nuevo")).toMatchObject({
      menuClass: null,
      margin: null,
    });
    const rowClass = new Map(food.matrix.rows.map((r) => [r.key, r.menuClass]));
    for (const d of food.allDishes.filter((x) => x.menuClass)) {
      expect(d.menuClass).toBe(rowClass.get(d.key));
    }

    const drinks = await make(dishes).analysis("t1", {
      ...RANGE,
      scope: "bebida",
    });
    expect(drinks.group).toBe("CERVEZAS");
  });

  it("80/20, Omnes y ratios de coste", async () => {
    const a = await make(ARROCES).analysis("t1", RANGE);
    // Mero 43 % + Tabarca 20,7 % + Bacalao 16,7 % = 80,3 %: tres platos.
    expect(a.pareto.byRevenue.needed).toBe(3);
    expect(a.pareto.byUnits.needed).toBe(3);
    expect(a.omnes?.bandsOk).toBe(false);
    expect(a.costRatios.rawMaterial).toEqual({ cost: 800, pct: 27.82 });
    // La limpieza no es materia prima: va aparte.
    expect(a.costRatios.otherPurchases).toEqual({
      cost: 50,
      labels: ["Limpieza"],
    });
    expect(a.costRatios.byCategory).toHaveLength(2);
    expect(a.costRatios.byCategory[0]).toEqual({
      label: "Pescado",
      cost: 600,
      pct: 20.86,
    });
  });

  it("zona gris: teórico frente a real, con invitaciones y anulaciones", async () => {
    const dishes = ARROCES.map((d) =>
      d.key === "P-2" ? { ...d, servedUnits: 72 } : d,
    );
    const a = await make(dishes).analysis("t1", RANGE);
    const g = a.grayZone;
    // Teórico: 712,20 + 2 invitaciones × 4,50 = 721,20 sobre 2.876 €.
    expect(g.theoreticalCost).toBe(721.2);
    expect(g.theoreticalCostPct).toBe(25.08);
    expect(g.realCostPct).toBe(27.82);
    expect(g.gapPoints).toBe(2.74);
    expect(g.controls.invitations).toEqual({
      units: 2,
      cost: 9,
      value: 35.3,
    });
    expect(g.controls.cancellations).toEqual({
      tickets: 2,
      lines: 3,
      total: 40,
    });
  });
});

describe("zona gris con menús del día", () => {
  it("las raciones de menú a 0 € no suman coste teórico sin su venta", async () => {
    // 10 menús cobrados en su línea M; el mero de dentro va a 0 € (10 uds.).
    const dishes = [
      ...ARROCES.map((d) =>
        d.key === "P-2" ? { ...d, units: 80, servedUnits: 80 } : d,
      ),
      dish({ key: "M-1", type: "M", units: 10, base: 150, unitCost: null }),
    ];
    const a = await make(dishes).analysis("t1", RANGE);
    // Igual que sin menús: 712,20 € de coste sobre 2.876 € de carta.
    expect(a.grayZone.theoreticalCost).toBe(712.2);
    expect(a.grayZone.theoreticalCostPct).toBe(24.76);
  });
});

describe("scopeOfGroups", () => {
  it("decide por el nombre de la familia o por sus recetas de bebida", () => {
    const s = scopeOfGroups([
      dish({ family: "POSTRES", drink: false }),
      dish({ family: "CAFE", drink: null }),
      dish({ family: "VINOS-TINTOS", drink: false }),
      dish({ family: "COCTELERIA", drink: null }),
      dish({ family: "COMBINADOS", drink: true }),
      dish({ family: "APERITIVOS", drink: null }),
    ]);
    expect(s.get("POSTRES")).toBe("comida");
    expect(s.get("CAFE")).toBe("bebida");
    expect(s.get("VINOS")).toBe("bebida");
    expect(s.get("COMBINADOS")).toBe("bebida");
    expect(s.get("APERITIVOS")).toBe("comida");
  });
});
