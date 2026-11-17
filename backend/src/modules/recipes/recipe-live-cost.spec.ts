import {
  computeLiveCosts,
  LiveCostProduct,
  LiveCostRecipe,
} from "./recipe-live-cost";

const kiloAt = (price: number): LiveCostProduct => ({
  purchasePrice: price,
  unitSize: 1,
  referenceUnit: "kg",
  discountPercentage: 0,
  wastePercentage: 0,
});

const recipe = (r: Partial<LiveCostRecipe>): LiveCostRecipe => ({
  portions: 1,
  portionSize: 0,
  storedTotalCost: 0,
  storedTotalCostPerUnit: 0,
  ingredients: [],
  subRecipes: [],
  ...r,
});

describe("computeLiveCosts", () => {
  it("costea con el precio de hoy, no con el coste guardado", () => {
    const costs = computeLiveCosts(
      new Map([
        [
          "entrecot",
          recipe({
            storedTotalCost: 34.82,
            ingredients: [{ productId: "lomo", quantity: 0.4, unit: "kg" }],
          }),
        ],
      ]),
      new Map([["lomo", kiloAt(50)]]),
    );
    expect(costs.get("entrecot")!.totalCost).toBeCloseTo(20);
  });

  it("baja por las sub-recetas también con precios de hoy", () => {
    const costs = computeLiveCosts(
      new Map([
        [
          "plato",
          recipe({
            subRecipes: [
              { subRecipeId: "salsa", quantity: 2, unit: "raciones" },
            ],
          }),
        ],
        [
          "salsa",
          recipe({
            portions: 10,
            portionSize: 100,
            storedTotalCost: 99,
            subRecipes: [{ subRecipeId: "fondo", quantity: 500, unit: "g" }],
          }),
        ],
        [
          "fondo",
          recipe({
            portions: 1,
            portionSize: 1000,
            ingredients: [{ productId: "hueso", quantity: 2, unit: "kg" }],
          }),
        ],
      ]),
      new Map([["hueso", kiloAt(3)]]),
    );
    // Fondo 6 € por 1000 g → 500 g = 3 €; salsa 3 € / 10 raciones → 2 = 0,6 €
    expect(costs.get("fondo")!.totalCost).toBeCloseTo(6);
    expect(costs.get("salsa")!.totalCost).toBeCloseTo(3);
    expect(costs.get("plato")!.totalCost).toBeCloseTo(0.6);
  });

  it("sin el artículo usa el coste guardado, y en un ciclo no se cuelga", () => {
    const costs = computeLiveCosts(
      new Map([
        [
          "sin-articulo",
          recipe({
            storedTotalCost: 7,
            ingredients: [{ productId: "borrado", quantity: 1, unit: "kg" }],
          }),
        ],
        [
          "a",
          recipe({
            storedTotalCost: 4,
            subRecipes: [{ subRecipeId: "b", quantity: 1, unit: "raciones" }],
          }),
        ],
        [
          "b",
          recipe({
            storedTotalCost: 2,
            subRecipes: [{ subRecipeId: "a", quantity: 1, unit: "raciones" }],
          }),
        ],
      ]),
      new Map(),
    );
    expect(costs.get("sin-articulo")!.totalCost).toBe(7);
    expect(costs.get("a")!.totalCost).toBeDefined();
    expect(costs.get("b")!.totalCost).toBeDefined();
  });
});
