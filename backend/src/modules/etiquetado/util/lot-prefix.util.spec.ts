import { deriveLotPrefix } from "./lot-prefix.util";

describe("deriveLotPrefix", () => {
  it("takes the first 4 letters of the first significant token, uppercased", () => {
    expect(deriveLotPrefix("Jarrete de ternera")).toBe("JARR");
  });

  it("strips accents and non-alphanumerics", () => {
    expect(deriveLotPrefix("Ñoquis")).toBe("NOQU");
    expect(deriveLotPrefix("Crème brûlée")).toBe("CREM");
  });

  it("tolerates short names without padding", () => {
    expect(deriveLotPrefix("AA")).toBe("AA");
  });

  it("falls back to ETIQ for empty / symbol-only names", () => {
    expect(deriveLotPrefix("")).toBe("ETIQ");
    expect(deriveLotPrefix("   ")).toBe("ETIQ");
    expect(deriveLotPrefix("***")).toBe("ETIQ");
  });
});
