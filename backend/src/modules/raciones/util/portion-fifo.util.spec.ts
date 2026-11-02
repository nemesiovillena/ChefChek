import {
  allocateFifo,
  portionsForSale,
  thresholdState,
} from "./portion-fifo.util";

describe("allocateFifo", () => {
  it("gasta primero las raciones sin etiqueta y luego la etiqueta más antigua", () => {
    const result = allocateFifo(5, [
      { labelId: null, remaining: 2 },
      { labelId: "old", remaining: 2 },
      { labelId: "new", remaining: 10 },
    ]);
    expect(result.takes).toEqual([
      { labelId: null, quantity: 2 },
      { labelId: "old", quantity: 2 },
      { labelId: "new", quantity: 1 },
    ]);
    expect(result.shortfall).toBe(0);
  });

  it("salta fuentes vacías", () => {
    const result = allocateFifo(1, [
      { labelId: null, remaining: 0 },
      { labelId: "a", remaining: 3 },
    ]);
    expect(result.takes).toEqual([{ labelId: "a", quantity: 1 }]);
  });

  it("devuelve el faltante cuando no hay raciones suficientes", () => {
    const result = allocateFifo(4, [{ labelId: "a", remaining: 1.5 }]);
    expect(result.takes).toEqual([{ labelId: "a", quantity: 1.5 }]);
    expect(result.shortfall).toBe(2.5);
  });

  it("admite medias raciones sin restos de coma flotante", () => {
    const result = allocateFifo(0.3, [
      { labelId: "a", remaining: 0.1 },
      { labelId: "b", remaining: 0.2 },
    ]);
    expect(result.takes).toEqual([
      { labelId: "a", quantity: 0.1 },
      { labelId: "b", quantity: 0.2 },
    ]);
    expect(result.shortfall).toBe(0);
  });

  it("sin fuentes todo es faltante", () => {
    expect(allocateFifo(2, [])).toEqual({ takes: [], shortfall: 2 });
  });
});

describe("thresholdState", () => {
  it("agotado con 0 o menos", () => {
    expect(thresholdState(0, 3)).toBe("out");
  });
  it("pocas en el mínimo o por debajo", () => {
    expect(thresholdState(3, 3)).toBe("low");
    expect(thresholdState(2, 3)).toBe("low");
  });
  it("ok por encima del mínimo o sin mínimo", () => {
    expect(thresholdState(4, 3)).toBe("ok");
    expect(thresholdState(1, 0)).toBe("ok");
  });
});

describe("portionsForSale", () => {
  it("multiplica las unidades vendidas por las raciones de cada venta", () => {
    expect(portionsForSale(3, 1, false)).toBe(3);
    expect(portionsForSale(2, 0.5, false)).toBe(1);
  });

  it("al peso cuenta una pieza por línea, sean los kilos que sean", () => {
    expect(portionsForSale(0.88, 1, true)).toBe(1);
    expect(portionsForSale(1.275, 1, true)).toBe(1);
  });

  it("al peso, una devolución devuelve la pieza", () => {
    expect(portionsForSale(-0.9, 1, true)).toBe(-1);
  });
});
