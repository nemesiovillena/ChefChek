import {
  convertReceivedToOrderUnit,
  deriveWeightPerUnit,
} from "./reception-unit-conversion.util";

describe("convertReceivedToOrderUnit", () => {
  const base = {
    receivedUnitPrice: 5,
    expectedPrice: null as number | null,
    unitsPerFormat: 1,
    avgUnitWeight: null as number | null,
  };

  it("misma magnitud: kg→kg identidad", () => {
    const r = convertReceivedToOrderUnit({
      ...base,
      orderUnit: "kilo",
      receivedQuantity: 7.4,
      receivedUnit: "kg",
    })!;
    expect(r.quantity).toBeCloseTo(7.4);
    expect(r.price).toBeCloseTo(5);
    expect(r.sourceUnit).toBeNull();
    expect(r.crossCategory).toBe(false);
  });

  it("misma magnitud: g→kg convierte cantidad y precio sin invertir factores", () => {
    const r = convertReceivedToOrderUnit({
      ...base,
      orderUnit: "kg",
      receivedQuantity: 7400, // g
      receivedUnit: "g",
      receivedUnitPrice: 0.005, // €/g = 5 €/kg
    })!;
    expect(r.quantity).toBeCloseTo(7.4);
    expect(r.price).toBeCloseTo(5); // 0.005 €/g × 1000 g/kg
  });

  it("pedido ud + albarán kg con peso aprendido → convierte y no reaprende", () => {
    const r = convertReceivedToOrderUnit({
      ...base,
      orderUnit: "ud",
      receivedQuantity: 7.4,
      receivedUnit: "kg",
      avgUnitWeight: 0.37,
    })!;
    expect(r.quantity).toBeCloseTo(20);
    expect(r.price).toBeCloseTo(1.85); // 5 €/kg × 0,37 kg/ud
    expect(r.sourceQuantity).toBeCloseTo(7.4);
    expect(r.sourceUnit).toBe("kg");
    expect(r.crossCategory).toBe(true);
    expect(r.learnedWeightPerUnit).toBeNull();
  });

  it("pedido ud + albarán kg sin peso → aprende del ratio de precios en el mismo cruce", () => {
    const r = convertReceivedToOrderUnit({
      ...base,
      orderUnit: "ud",
      receivedQuantity: 7.4,
      receivedUnit: "kg",
      expectedPrice: 1.85, // €/ud ÷ 5 €/kg = 0,37 kg/ud
    })!;
    expect(r.learnedWeightPerUnit).toBeCloseTo(0.37);
    expect(r.quantity).toBeCloseTo(20);
    expect(r.price).toBeCloseTo(1.85);
  });

  it("ratio de precios implausible → null (comportamiento histórico)", () => {
    const r = convertReceivedToOrderUnit({
      ...base,
      orderUnit: "ud",
      receivedQuantity: 7.4,
      receivedUnit: "kg",
      expectedPrice: 500, // 100 kg/ud: no es fiable
    });
    expect(r).toBeNull();
  });

  it("pedido kg + albarán ud (inverso) con peso aprendido", () => {
    const r = convertReceivedToOrderUnit({
      ...base,
      orderUnit: "kilo",
      receivedQuantity: 20,
      receivedUnit: "ud",
      receivedUnitPrice: 1.85,
      avgUnitWeight: 0.37,
    })!;
    expect(r.quantity).toBeCloseTo(7.4);
    expect(r.price).toBeCloseTo(5); // 1,85 €/ud ÷ 0,37 kg/ud
    expect(r.crossCategory).toBe(true);
  });

  it("unidad de albarán irreconocible → null", () => {
    const r = convertReceivedToOrderUnit({
      ...base,
      orderUnit: "ud",
      receivedQuantity: 20,
      receivedUnit: "Caja 6und",
    });
    expect(r).toBeNull();
  });

  it("unidad de pedido caja + albarán kg con peso → baja a formatos", () => {
    const r = convertReceivedToOrderUnit({
      ...base,
      orderUnit: "Caja 10x1ud",
      receivedQuantity: 74,
      receivedUnit: "kg",
      unitsPerFormat: 10,
      avgUnitWeight: 0.37,
    })!;
    // 74 kg ÷ 0,37 = 200 ud ÷ 10 ud/caja = 20 cajas
    expect(r.quantity).toBeCloseTo(20);
    expect(r.price).toBeCloseTo(18.5); // 5 €/kg × 0,37 × 10
  });

  it("peso↔volumen no convertible → null", () => {
    const r = convertReceivedToOrderUnit({
      ...base,
      orderUnit: "kg",
      receivedQuantity: 2,
      receivedUnit: "l",
      avgUnitWeight: 0.37,
    });
    expect(r).toBeNull();
  });
});

describe("deriveWeightPerUnit", () => {
  it("€/ud ÷ €/kg = kg/ud dentro del rango plausible", () => {
    expect(deriveWeightPerUnit(1.85, 5)).toBeCloseTo(0.37);
  });

  it("fuera de rango o sin precios → null", () => {
    expect(deriveWeightPerUnit(null, 5)).toBeNull();
    expect(deriveWeightPerUnit(1.85, 0)).toBeNull();
    expect(deriveWeightPerUnit(500, 5)).toBeNull();
    expect(deriveWeightPerUnit(0.001, 5)).toBeNull();
  });
});
