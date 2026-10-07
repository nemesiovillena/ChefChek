import { rankCuinerArticles } from "./cuiner-catalog-search-ranking";

const catalog = [
  { codigo: "05110038", descripcion: "BARRA PAN" },
  { codigo: "10010033", descripcion: "PAN BARRA DE AGUA 260GR" },
  { codigo: "10010025", descripcion: "PAN BURGER BRIOCHE 80GR" },
  { codigo: "05020019", descripcion: "CHEDDAR BARRA" },
  { codigo: "07010002", descripcion: "JAMÓN SERRANO" },
  { codigo: "09030011", descripcion: "AGUA MINERAL 1,5L" },
  { codigo: "02602600", descripcion: "TOMATE PERA" },
];

const codes = (query: string, limit = 20) =>
  rankCuinerArticles(query, catalog, limit).map((a) => a.codigo);

describe("rankCuinerArticles", () => {
  it("encuentra el artículo aunque la consulta lleve el formato de compra", () => {
    expect(codes("PAN BARRA DE AGUA 260G C/24U")[0]).toBe("10010033");
  });

  it("ordena por número de palabras compartidas", () => {
    const result = codes("pan barra de agua");
    expect(result[0]).toBe("10010033");
    expect(result[1]).toBe("05110038");
    expect(result).not.toContain("07010002");
  });

  it("no usa las palabras de formato para casar", () => {
    expect(codes("PAN 260G")).not.toContain("02602600");
  });

  it("busca sin tildes", () => {
    expect(codes("jamon")).toEqual(["07010002"]);
  });

  it("pone primero la coincidencia por código", () => {
    expect(codes("0903")[0]).toBe("09030011");
    expect(codes("10010033")).toEqual(["10010033"]);
  });

  it("respeta el límite y devuelve vacío sin consulta", () => {
    expect(codes("pan barra", 2)).toHaveLength(2);
    expect(codes("   ")).toEqual([]);
  });
});
