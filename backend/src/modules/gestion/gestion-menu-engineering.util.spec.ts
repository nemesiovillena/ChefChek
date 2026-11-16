import {
  classifyMenu,
  omnesOf,
  paretoOf,
} from "./gestion-menu-engineering.util";

/** Hoja «Arroces» del curso (enero 2007): coste, PVP y ventas de cada arroz. */
const ARROCES = [
  { key: "boquerones", cost: 3.0, price: 11.77, units: 20 },
  { key: "mero", cost: 4.5, price: 17.65, units: 70 },
  { key: "pulpo", cost: 3.75, price: 16.48, units: 20 },
  { key: "tabarca", cost: 1.12, price: 9.9, units: 60 },
  { key: "bacalao", cost: 6.5, price: 16.05, units: 30 },
];

describe("classifyMenu", () => {
  it("reproduce la clasificación de la hoja Arroces (100 % de la media)", () => {
    const r = classifyMenu(ARROCES);
    expect(r.popularityThreshold).toBeCloseTo(20);
    // Margen medio ponderado: 2.163,80 € / 200 uds = 10,82 €.
    expect(r.averageMargin).toBeCloseTo(10.819, 3);
    expect(
      Object.fromEntries(r.items.map((i) => [i.key, i.menuClass])),
    ).toEqual({
      boquerones: "perro",
      mero: "estrella",
      pulpo: "puzzle",
      tabarca: "caballo",
      bacalao: "perro",
    });
  });

  it("con la regla del 70 % el umbral baja y el bacalao (15 %) pasa a popular", () => {
    const r = classifyMenu(ARROCES, 0.7);
    expect(r.popularityThreshold).toBeCloseTo(14);
    expect(r.items.find((i) => i.key === "bacalao")?.menuClass).toBe("caballo");
  });

  it("justo en la media cuenta como popular", () => {
    const r = classifyMenu([
      { key: "a", units: 50, price: 10, cost: 2 },
      { key: "b", units: 50, price: 10, cost: 2 },
    ]);
    expect(r.items.every((i) => i.popular && i.profitable)).toBe(true);
  });

  it("sin ventas no clasifica", () => {
    expect(classifyMenu([]).items).toEqual([]);
  });
});

describe("paretoOf", () => {
  it("cuenta los platos necesarios para llegar al 80 %", () => {
    const p = paretoOf([
      { key: "c", value: 10 },
      { key: "a", value: 60 },
      { key: "b", value: 25 },
      { key: "d", value: 5 },
    ]);
    expect(p.items.map((i) => i.key)).toEqual(["a", "b", "c", "d"]);
    expect(p.items.map((i) => i.cumulative)).toEqual([60, 85, 95, 100]);
    expect(p.needed).toBe(2);
  });

  it("sin ventas no necesita ninguno", () => {
    expect(paretoOf([{ key: "a", value: 0 }]).needed).toBe(0);
  });
});

describe("omnesOf", () => {
  it("hoja Arroces: amplitud y relación bien, dispersión mal", () => {
    const o = omnesOf(ARROCES)!;
    expect(o.amplitude).toBeCloseTo(17.65 / 9.9);
    expect(o.amplitudeLimit).toBe(2.5);
    expect(o.amplitudeOk).toBe(true);
    expect(o.bands.map((b) => b.count)).toEqual([2, 0, 3]);
    expect(o.bandsOk).toBe(false);
    // Demandado 2.876 / 200 = 14,38; ofertado 71,85 / 5 = 14,37.
    expect(o.demandedAverage).toBeCloseTo(14.38, 2);
    expect(o.offeredAverage).toBeCloseTo(14.37, 2);
    expect(o.ratioOk).toBe(true);
  });

  it("carta cara: el cliente pide lo barato (relación < 0,85)", () => {
    const o = omnesOf([
      { price: 10, units: 100 },
      { price: 20, units: 2 },
      { price: 30, units: 1 },
    ])!;
    expect(o.ratio).toBeLessThan(0.85);
    expect(o.ratioOk).toBe(false);
    expect(o.amplitudeOk).toBe(false);
  });

  it("con menos de dos platos no hay análisis", () => {
    expect(omnesOf([{ price: 10, units: 3 }])).toBeNull();
  });
});
