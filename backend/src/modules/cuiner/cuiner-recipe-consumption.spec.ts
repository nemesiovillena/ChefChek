import {
  ConsumptionProduct,
  ConsumptionRecipe,
  directProductFormats,
  explodeRecipe,
  subRecipeFraction,
} from "./cuiner-recipe-consumption";

const product = (
  over: Partial<ConsumptionProduct> & { id: string },
): ConsumptionProduct => ({
  name: over.id,
  referenceUnit: "kilo",
  unitSize: 1,
  tracksInventory: true,
  ...over,
});

const products = new Map(
  [
    product({ id: "pan", referenceUnit: "unidad", unitSize: 24 }), // caja de 24 panes
    product({ id: "carne", referenceUnit: "kilo", unitSize: 5 }), // pieza de 5 kg
    product({ id: "queso", referenceUnit: "kilo", unitSize: 1 }),
    product({ id: "aceite", referenceUnit: "litro", unitSize: 5 }), // garrafa 5 L
    product({ id: "portes", tracksInventory: false }),
  ].map((p) => [p.id, p]),
);

const recipes = new Map<string, ConsumptionRecipe>(
  [
    {
      id: "burger",
      name: "Hamburguesa",
      portions: 1,
      portionSize: 350,
      ingredients: [
        { productId: "pan", quantity: 1, unit: "ud" },
        { productId: "carne", quantity: 180, unit: "g" },
        { productId: "portes", quantity: 1, unit: "ud" },
      ],
      subRecipes: [{ subRecipeId: "salsa", quantity: 30, unit: "g" }],
    },
    {
      // 10 raciones de 100 g = 1.000 g de salsa
      id: "salsa",
      name: "Salsa de queso",
      portions: 10,
      portionSize: 100,
      ingredients: [
        { productId: "queso", quantity: 600, unit: "g" },
        { productId: "aceite", quantity: 200, unit: "ml" },
      ],
      subRecipes: [],
    },
    {
      id: "tabla",
      name: "Tabla de quesos",
      portions: 4,
      portionSize: 250,
      ingredients: [{ productId: "queso", quantity: 1, unit: "kg" }],
      subRecipes: [{ subRecipeId: "salsa", quantity: 2, unit: "raciones" }],
    },
    {
      id: "ciclo",
      name: "Receta cíclica",
      portions: 1,
      portionSize: 1,
      ingredients: [],
      subRecipes: [{ subRecipeId: "ciclo", quantity: 1, unit: "raciones" }],
    },
  ].map((r) => [r.id, r]),
);

const round = (m: Map<string, number>) =>
  Object.fromEntries([...m].map(([k, v]) => [k, Math.round(v * 1e6) / 1e6]));

describe("explodeRecipe", () => {
  it("descompone receta y sub-receta en formatos de compra", () => {
    const { formats, missing } = explodeRecipe("burger", 1, recipes, products);
    expect(missing).toEqual([]);
    expect(round(formats)).toEqual({
      pan: 0.041667, // 1 pan de una caja de 24
      carne: 0.036, // 180 g de una pieza de 5 kg
      queso: 0.018, // 30 g de salsa = 3 % de 600 g = 18 g
      aceite: 0.0012, // 3 % de 200 ml = 6 ml de una garrafa de 5 L
    });
  });

  it("escala por raciones vendidas y por raciones de la receta", () => {
    // Tabla: 4 raciones con 1 kg de queso + 2 raciones de salsa.
    const { formats } = explodeRecipe("tabla", 2, recipes, products);
    // 2 de 4 raciones → 0,5 kg queso + la mitad de 2 raciones de salsa
    // (1 ración = 10 % de la salsa → 60 g de queso, 20 ml de aceite).
    expect(round(formats)).toEqual({ queso: 0.56, aceite: 0.004 });
  });

  it("las unidades negativas (tickets de anulación) devuelven stock", () => {
    const { formats } = explodeRecipe("burger", -1, recipes, products);
    expect(formats.get("carne")).toBeCloseTo(-0.036);
  });

  it("ignora artículos sin control de stock", () => {
    const { formats } = explodeRecipe("burger", 1, recipes, products);
    expect(formats.has("portes")).toBe(false);
  });

  it("corta los ciclos y lo anota", () => {
    const { missing } = explodeRecipe("ciclo", 1, recipes, products);
    expect(missing).toEqual(["Receta cíclica (anidamiento > 6)"]);
  });

  it("anota la receta que no existe", () => {
    expect(explodeRecipe("borrada", 1, recipes, products).missing).toEqual([
      "borrada",
    ]);
  });
});

describe("subRecipeFraction", () => {
  const salsa = { portions: 10, portionSize: 100 };
  it("convierte kg, cl y raciones a fracción del total elaborado", () => {
    expect(subRecipeFraction(0.5, "kg", salsa)).toBe(0.5);
    expect(subRecipeFraction(5, "cl", salsa)).toBe(0.05);
    expect(subRecipeFraction(3, "porciones", salsa)).toBe(0.3);
  });
  it("devuelve 0 si la sub-receta no tiene rendimiento", () => {
    expect(subRecipeFraction(10, "g", { portions: 0, portionSize: 0 })).toBe(0);
  });
});

describe("directProductFormats", () => {
  it("una botella vendida descuenta una de la caja", () => {
    const caja = product({ id: "agua", referenceUnit: "unidad", unitSize: 12 });
    expect(directProductFormats(3, caja)).toBe(0.25);
  });
});
