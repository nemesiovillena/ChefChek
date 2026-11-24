import { baseAndGrossFromLines } from "./albaranes.service";

describe("baseAndGrossFromLines", () => {
  it("usa el neto del papel cuando trae descuento y cantidad × precio si no", () => {
    const totals = baseAndGrossFromLines([
      { quantity: 2, unitPrice: 10, vatPercent: 10, totalPrice: 18 }, // dto.: neto 18
      { quantity: 3, unitPrice: 1.5, vatPercent: 21, totalPrice: null },
    ]);
    expect(totals).toEqual({ base: 22.5, gross: 24.5 });
  });

  it("mantiene el signo de las líneas de abono", () => {
    expect(
      baseAndGrossFromLines([
        { quantity: -1, unitPrice: 12.344, vatPercent: 10, totalPrice: null },
      ]),
    ).toEqual({ base: -12.34, gross: -12.34 });
  });

  it("devuelve 0 sin líneas", () => {
    expect(baseAndGrossFromLines([])).toEqual({ base: 0, gross: 0 });
  });
});
