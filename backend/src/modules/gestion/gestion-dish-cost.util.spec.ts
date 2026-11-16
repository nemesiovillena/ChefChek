import { unitCostOfDish } from "./gestion-dish-cost.util";
import { classifyMenu } from "./gestion-menu-engineering.util";
import {
  chunkRange,
  mapWithConcurrency,
} from "./gestion-profitability.service";

describe("unitCostOfDish", () => {
  it("receta: coste del escandallo entre raciones", () => {
    expect(unitCostOfDish({ recipe: { totalCost: 12, portions: 4 } })).toBe(3);
  });

  it("receta sin coste calculado: desconocido, no 0", () => {
    expect(
      unitCostOfDish({ recipe: { totalCost: 0, portions: 4 } }),
    ).toBeNull();
  });

  it("bebida con medida: caña de 20 cl de un barril de 30 L a 90 €", () => {
    const cost = unitCostOfDish({
      product: { purchasePrice: 90, unitSize: 30, referenceUnit: "L" },
      measure: { quantity: 20, unit: "cl" },
    });
    expect(cost).toBeCloseTo(0.6, 6);
  });

  it("medida en unidades sobre artículo en kg: usa el peso medio de la pieza", () => {
    const product = { purchasePrice: 20, unitSize: 1, referenceUnit: "kg" };
    expect(
      unitCostOfDish({
        product: { ...product, avgUnitWeight: 0.2 },
        measure: { quantity: 1, unit: "ud" },
      }),
    ).toBeCloseTo(4, 6);
    // Sin peso medio no se puede convertir: desconocido, nunca 1 kg.
    expect(
      unitCostOfDish({ product, measure: { quantity: 1, unit: "ud" } }),
    ).toBeNull();
  });

  it("bebida sin medida: una unidad de referencia (botellín)", () => {
    expect(
      unitCostOfDish({
        product: { purchasePrice: 24, unitSize: 24, referenceUnit: "und" },
      }),
    ).toBe(1);
  });

  it("plato contenedor sin stock cuesta 0; sin enlace, desconocido", () => {
    expect(unitCostOfDish({ noStock: true })).toBe(0);
    expect(unitCostOfDish({})).toBeNull();
  });
});

describe("classifyMenu", () => {
  it("reparte en estrella, caballo, puzzle y perro", () => {
    const { items } = classifyMenu([
      { key: "estrella", units: 40, price: 20, cost: 6 },
      { key: "caballo", units: 40, price: 10, cost: 6 },
      { key: "puzzle", units: 5, price: 30, cost: 8 },
      { key: "perro", units: 5, price: 8, cost: 6 },
    ]);
    expect(Object.fromEntries(items.map((i) => [i.key, i.menuClass]))).toEqual({
      estrella: "estrella",
      caballo: "caballo",
      puzzle: "puzzle",
      perro: "perro",
    });
  });

  it("sin ventas no clasifica", () => {
    expect(classifyMenu([]).items).toEqual([]);
  });
});

describe("chunkRange", () => {
  it("parte un año en tramos de 100 días sin huecos ni solapes", () => {
    const w = chunkRange({ from: "2026-01-01", to: "2026-12-31" }, 100);
    expect(w).toHaveLength(4);
    expect(w[0]).toEqual({ from: "2026-01-01", to: "2026-04-10" });
    expect(w[1].from).toBe("2026-04-11");
    expect(w[3].to).toBe("2026-12-31");
  });
});

describe("mapWithConcurrency", () => {
  it("respeta el orden y no pasa del límite de tareas a la vez", async () => {
    let running = 0;
    let peak = 0;
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50, 60]);
    expect(peak).toBe(2);
  });
});
