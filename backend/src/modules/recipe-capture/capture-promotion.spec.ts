import {
  buildPendingNotes,
  PromotableIngredient,
  splitIngredientsForRecipe,
} from "./capture-promotion";

const product = (referenceUnit: string, deletedAt: Date | null = null) => ({
  id: `p-${referenceUnit}`,
  referenceUnit,
  deletedAt,
});

const ingredient = (
  overrides: Partial<PromotableIngredient>,
): PromotableIngredient => ({
  rawText: "500 g de harina",
  quantity: 500,
  unit: "g",
  note: null,
  matchedProduct: product("kg"),
  ...overrides,
});

describe("splitIngredientsForRecipe", () => {
  it("pasa como línea el ingrediente vinculado con cantidad y unidad compatible", () => {
    const { lines, pending } = splitIngredientsForRecipe([
      ingredient({ note: "tamizada" }),
    ]);

    expect(lines).toEqual([
      { productId: "p-kg", quantity: 500, unit: "g", note: "tamizada" },
    ]);
    expect(pending).toEqual([]);
  });

  it("guarda las unidades sueltas como las guarda el editor de recetas", () => {
    const { lines } = splitIngredientsForRecipe([
      ingredient({
        rawText: "3 huevos",
        quantity: 3,
        unit: "ud",
        matchedProduct: product("und"),
      }),
    ]);

    expect(lines[0]).toEqual({
      productId: "p-und",
      quantity: 3,
      unit: "units",
    });
  });

  it.each([
    ["sin artículo", { matchedProduct: null }, "500 g de harina"],
    [
      "artículo borrado",
      { matchedProduct: product("kg", new Date()) },
      "500 g de harina",
    ],
    [
      "sin cantidad",
      { quantity: null, unit: null },
      "500 g de harina (sin cantidad)",
    ],
    ["cantidad cero", { quantity: 0 }, "500 g de harina (sin cantidad)"],
    [
      "ml contra artículo en kg",
      { unit: "ml" },
      "500 g de harina (unidad no compatible con el artículo)",
    ],
    [
      "unidades contra artículo en kg",
      { unit: "ud" },
      "500 g de harina (unidad no compatible con el artículo)",
    ],
    [
      "artículo con unidad de referencia desconocida",
      { matchedProduct: product("Caja 6und") },
      "500 g de harina (unidad no compatible con el artículo)",
    ],
  ])("deja en notas: %s", (_name, overrides, expected) => {
    const { lines, pending } = splitIngredientsForRecipe([
      ingredient(overrides),
    ]);

    expect(lines).toEqual([]);
    expect(pending).toEqual([expected]);
  });

  it("acepta alias de la unidad de referencia del artículo", () => {
    const { lines } = splitIngredientsForRecipe([
      ingredient({ unit: "ml", matchedProduct: product("Litro") }),
    ]);

    expect(lines).toHaveLength(1);
  });
});

describe("buildPendingNotes", () => {
  it("lista cada ingrediente pendiente bajo el aviso de alérgenos", () => {
    expect(buildPendingNotes(["sal al gusto", "1 pepino"])).toBe(
      "Ingredientes pendientes de vincular (alérgenos incompletos):\n- sal al gusto\n- 1 pepino",
    );
  });

  it("no genera notas si todo pasó como línea", () => {
    expect(buildPendingNotes([])).toBeNull();
  });
});
