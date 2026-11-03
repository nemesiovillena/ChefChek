import { normalizeProductNameCase } from "./product-name-case.util";

describe("normalizeProductNameCase", () => {
  it("todo en mayúsculas → primera letra en mayúscula", () => {
    expect(normalizeProductNameCase("TOMATE PERA EXITO 1KG")).toBe(
      "Tomate pera exito 1kg",
    );
  });

  it("respeta tildes y eñes", () => {
    expect(normalizeProductNameCase("CR.AÑOJO FRES MEDALLÓN SOLOMILLO")).toBe(
      "Cr.añojo fres medallón solomillo",
    );
  });

  it("deja tal cual un nombre ya mezclado (escrito por una persona)", () => {
    expect(normalizeProductNameCase("METRO Chef Albahaca bandeja 125g")).toBe(
      "METRO Chef Albahaca bandeja 125g",
    );
    expect(normalizeProductNameCase("Iceberg lechuga")).toBe("Iceberg lechuga");
  });

  it("todo en minúsculas no se toca", () => {
    expect(normalizeProductNameCase("perejil")).toBe("perejil");
  });

  it("sin letras (solo números o símbolos) no se toca", () => {
    expect(normalizeProductNameCase(" 1234 ")).toBe("1234");
  });

  it("empieza por número: la primera letra no cambia de posición", () => {
    expect(normalizeProductNameCase("3X5L ACEITE")).toBe("3x5l aceite");
  });
});
