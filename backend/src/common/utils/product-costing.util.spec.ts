import {
  calculateProductCostPerUnit,
  getUnitToReferenceFactor,
} from "./product-costing.util";

describe("calculateProductCostPerUnit", () => {
  it("no debe dividir por yieldFactor: la cantidad de receta ya es peso bruto pagado", () => {
    // Salmón 5-6 kg: 10,40€/kg, rendimiento 76,15% (peso neto 3,99kg / peso bruto 5,24kg)
    const salmon = {
      purchasePrice: 10.4,
      unitSize: 1,
      referenceUnit: "kilo",
      yieldFactor: 0.7614503816793893,
    };

    const costPerGram = calculateProductCostPerUnit(salmon, "g");

    // 180g de salmón bruto deben costar 180 * 10,40 / 1000 = 1,872€,
    // NO 180 * (10,40 / 0,7615) / 1000 = 2,4596€ (coste inflado por doble merma)
    expect(180 * costPerGram).toBeCloseTo(1.872, 3);
  });

  it("ignora yieldFactor aunque el producto lo tenga distinto de 1", () => {
    const productWithYield = {
      purchasePrice: 10.4,
      unitSize: 1,
      referenceUnit: "kilo",
      yieldFactor: 0.5,
    };
    const withYield = calculateProductCostPerUnit(productWithYield, "kg");
    const withoutYield = calculateProductCostPerUnit(
      { purchasePrice: 10.4, unitSize: 1, referenceUnit: "kilo" },
      "kg",
    );

    expect(withYield).toBe(withoutYield);
    expect(withYield).toBe(10.4);
  });

  it("reconoce 'kilo'/'litro' (catálogo de unidades del tenant) como alias de kg/l", () => {
    expect(getUnitToReferenceFactor("g", "kilo")).toBeCloseTo(0.001, 6);
    expect(getUnitToReferenceFactor("kg", "kilo")).toBe(1);
    expect(getUnitToReferenceFactor("ml", "litro")).toBeCloseTo(0.001, 6);
    expect(getUnitToReferenceFactor("units", "und")).toBe(1);
  });

  it("caso real: Salmón 5-6 kg (10,40€/kg, referenceUnit 'kilo') con 180g en receta", () => {
    // Datos reales del producto en BD: purchasePrice=10.4, unitSize=1,
    // referenceUnit='kilo' (símbolo del catálogo de Unidades de Medida).
    // Antes del fix el coste persistido de "Salmón a la Plancha" era
    // 2458,62€ (180 tratados como si ya estuvieran en kilos, sin convertir).
    const salmon = { purchasePrice: 10.4, unitSize: 1, referenceUnit: "kilo" };
    const cost = 180 * calculateProductCostPerUnit(salmon, "g");

    expect(cost).toBeCloseTo(1.872, 3);
  });

  it("aplica el descuento fijo del proveedor sobre el precio de referencia", () => {
    // purchasePrice=20€/kg bruto, dto fijo 12% → coste efectivo 17,6€/kg.
    const sinDto = { purchasePrice: 20, unitSize: 1, referenceUnit: "kilo" };
    const conDto = {
      purchasePrice: 20,
      unitSize: 1,
      referenceUnit: "kilo",
      discountPercentage: 12,
    };

    expect(calculateProductCostPerUnit(sinDto, "kg")).toBeCloseTo(20, 3);
    expect(calculateProductCostPerUnit(conDto, "kg")).toBeCloseTo(17.6, 3);

    // unitSize distinto de 1: 10€ por caja de 2kg con 10% de dto → 4,5€/kg.
    expect(
      calculateProductCostPerUnit(
        {
          purchasePrice: 10,
          unitSize: 2,
          referenceUnit: "kilo",
          discountPercentage: 10,
        },
        "kg",
      ),
    ).toBeCloseTo(4.5, 3);

    // discountPercentage ausente o 0 = sin descuento (back-compat).
    expect(
      calculateProductCostPerUnit(
        {
          purchasePrice: 20,
          unitSize: 1,
          referenceUnit: "kilo",
          discountPercentage: 0,
        },
        "kg",
      ),
    ).toBeCloseTo(20, 3);
  });
});
