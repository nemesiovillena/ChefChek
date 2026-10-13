import {
  CaptureIngredientMatcher,
  scoreProduct,
  significantWords,
} from "./capture-ingredient-matcher";

describe("significantWords", () => {
  it("quita acentos, palabras vacías y palabras cortas", () => {
    expect(significantWords("Azúcar glas de la Reina (1 kg)")).toEqual([
      "azucar",
      "glas",
      "reina",
    ]);
  });
});

describe("scoreProduct", () => {
  it.each([
    ["harina", "HARINA TRIGO T55 SACO 25KG", 1],
    ["harina de trigo", "HARINA TRIGO T55 SACO 25KG", 1],
    ["tomate", "TOMATES PERA KG", 1],
    ["huevos", "HUEVO L DOCENA", 1],
    ["queso crema", "QUESO MANCHEGO CURADO", 0.5],
    ["aceite de oliva virgen extra", "ACEITE GIRASOL 5L", 0.25],
    ["sal", "SALMÓN FRESCO", 0],
    ["sal", "Sal de cocina", 1],
    ["agua", "PAN BARRA DE AGUA 260G", 0],
    ["diente de ajo", "AJO GRANULADO BOTE 900 G.", 0.5],
    ["mantequilla", "GALLETAS DE MANTEQUILLA", 0],
    ["de la", "HARINA", 0],
  ])("%s contra %s = %s", (ingredient, product, expected) => {
    expect(scoreProduct(ingredient, product)).toBeCloseTo(expected);
  });
});

describe("CaptureIngredientMatcher", () => {
  const products = { searchByNameLoose: jest.fn() };
  const matcher = new CaptureIngredientMatcher(products as any);

  beforeEach(() => jest.resetAllMocks());

  it("sugiere el artículo que contiene más palabras del ingrediente", async () => {
    products.searchByNameLoose.mockResolvedValue([
      { id: "p1", name: "ACEITE GIRASOL 5L" },
      { id: "p2", name: "ACEITE OLIVA VIRGEN EXTRA 5L" },
    ]);

    const match = await matcher.match("t1", "aceite de oliva virgen extra");

    expect(products.searchByNameLoose).toHaveBeenCalledWith(
      "t1",
      "aceite de oliva virgen extra",
    );
    expect(match).toEqual({ productId: "p2", confidence: 1 });
  });

  it("a igual puntuación se queda con el primero que devuelve la búsqueda", async () => {
    products.searchByNameLoose.mockResolvedValue([
      { id: "p1", name: "HARINA TRIGO" },
      { id: "p2", name: "HARINA TRIGO FUERZA SACO 25KG" },
    ]);

    expect((await matcher.match("t1", "harina"))?.productId).toBe("p1");
  });

  it("no sugiere nada cuando ningún artículo llega a la mitad de las palabras", async () => {
    products.searchByNameLoose.mockResolvedValue([
      { id: "p1", name: "ACEITE GIRASOL 5L" },
    ]);

    expect(
      await matcher.match("t1", "aceite de oliva virgen extra"),
    ).toBeNull();
  });

  it("no consulta nada para un nombre sin palabras significativas", async () => {
    expect(await matcher.match("t1", "de la")).toBeNull();
    expect(products.searchByNameLoose).not.toHaveBeenCalled();
  });
});
