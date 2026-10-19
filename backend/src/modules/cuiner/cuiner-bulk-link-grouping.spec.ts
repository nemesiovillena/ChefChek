import {
  BulkProduct,
  extractBrand,
  groupDishesByBrand,
  normalizeKeywords,
  suggestProduct,
} from "./cuiner-bulk-link-grouping";
import { DEFAULT_SERVING_MEASURES } from "./cuiner-serving-measures.service";

const keywords = normalizeKeywords(
  DEFAULT_SERVING_MEASURES.flatMap((m) => m.keywords),
);
const dish = (producto: string, nombre: string, sold = 0) => ({
  tipo: "P",
  producto,
  nombre,
  sold,
});
const product = (
  id: string,
  name: string,
  referenceUnit = "litro",
): BulkProduct => ({ id, name, referenceUnit, categoryName: null });

describe("extractBrand", () => {
  it.each([
    ["BARCELO CHUPITO", "barcelo"],
    ["ANIS SECO CHUP", "anis seco"],
    ["BALLANTINES 12 PIEDRA", "ballantines 12"],
    ["BOMBAY SHA. COMBI", "bombay sha"],
    ["CAÑA DOBLE", ""],
    ["ANIS SECO COPA HIELO", "anis seco hielo"],
  ])("%s → «%s»", (name, brand) => {
    expect(extractBrand(name, keywords)).toBe(brand);
  });

  it("no confunde CANADIAN con CAÑA ni platos sin medida", () => {
    expect(extractBrand("CANADIAN C. CHUPITO", keywords)).toBe("canadian c");
    expect(extractBrand("ENSALADILLA RUSA", keywords)).toBeNull();
  });
});

describe("suggestProduct", () => {
  const products = [
    product("barcelo", "Ron Barceló Añejo 0,7L"),
    product("barcelo-imp", "Ron Barceló Imperial 0,7L"),
    product("ballantines", "Whisky Ballantine's 12 años 70cl"),
    product("anis", "Anís Seco La Castellana 1L"),
  ];

  it("propone el artículo que contiene la marca, el de nombre más corto", () => {
    expect(suggestProduct("barcelo", products)).toEqual({
      product: products[0],
      exactMatch: true,
    });
  });

  it("casa marcas con apóstrofo y números", () => {
    expect(suggestProduct("ballantines 12", products)?.product.id).toBe(
      "ballantines",
    );
  });

  it("marca parcial: propone pero no da el enlace por seguro", () => {
    expect(suggestProduct("anis seco hielo", products)).toEqual({
      product: products[3],
      exactMatch: false,
    });
  });

  it("sin coincidencias no propone nada", () => {
    expect(suggestProduct("cacique", products)).toBeNull();
  });

  it.each([
    ["menta", "LEJIA ALIMENTARIA 2 LITROS"],
    ["tia maria", "Galletas María"],
    ["torres 10", "YOGURT GRIEGO 10% MG 1 KG"],
    ["manzana sin", "CARRILLADA DE CERDO SIN HUESO"],
    ["orujo crema", "QUESO CREMA NATURAL 3KGS"],
  ])("no propone ruido: %s ≠ %s", (brand, name) => {
    expect(suggestProduct(brand, [product("x", name)])).toBeNull();
  });
});

describe("groupDishesByBrand", () => {
  it("agrupa por marca, ordena por ventas y deja fuera lo que no es bebida", () => {
    const groups = groupDishesByBrand(
      [
        dish("1", "BARCELO CHUPITO", 3),
        dish("2", "BARCELO PIEDRA", 9),
        dish("3", "BARCELO TUBO"),
        dish("4", "CAÑA", 61),
        dish("5", "CAFE CORTADO", 25),
        dish("6", "ENSALADILLA RUSA", 62),
      ],
      DEFAULT_SERVING_MEASURES,
      [
        product("barcelo", "Ron Barceló 0,7L"),
        product("barcelo-kg", "Barceló bombones", "kilo"),
        product("lata", "Barceló cola lata", "unidad"),
      ],
    );
    expect(groups.map((g) => [g.brand, g.dishes.length, g.sold])).toEqual([
      ["CAÑA", 1, 61],
      ["CAFE CORTADO", 1, 25],
      ["BARCELO", 3, 12],
    ]);
    const barcelo = groups[2];
    expect(barcelo.dishes.map((d) => d.nombre)).toEqual([
      "BARCELO PIEDRA",
      "BARCELO CHUPITO",
      "BARCELO TUBO",
    ]);
    // Un chupito pide un artículo en volumen: ni bombones (kg) ni lata (ud).
    expect(barcelo.suggestedProduct?.id).toBe("barcelo");
    expect(groups[0].suggestedProduct).toBeNull();
  });

  it("no propone un artículo en kilos para un chupito aunque el nombre case", () => {
    const [magno] = groupDishesByBrand(
      [dish("1", "MAGNO CHUPITO")],
      DEFAULT_SERVING_MEASURES,
      [product("jamon", "JAMON GRAN RSV. DUROC MAGNO", "kilo")],
    );
    expect(magno.suggestedProduct).toBeNull();
  });
});
