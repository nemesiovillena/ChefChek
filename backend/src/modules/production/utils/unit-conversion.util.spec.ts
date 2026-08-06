import { convertQuantity } from "./unit-conversion.util";

describe("convertQuantity", () => {
  it("converts grams to the product's reference unit spelled as 'kilo' (regression: real bug found in manual testing)", () => {
    expect(convertQuantity(180, "g", "kilo")).toBeCloseTo(0.18);
  });

  it("converts milliliters to 'litro'", () => {
    expect(convertQuantity(30, "ml", "litro")).toBeCloseTo(0.03);
  });

  it("returns the same quantity when units are already identical", () => {
    expect(convertQuantity(5, "kg", "kg")).toBe(5);
  });

  it("handles kg <-> g in both directions", () => {
    expect(convertQuantity(2, "kg", "g")).toBeCloseTo(2000);
    expect(convertQuantity(2000, "g", "kg")).toBeCloseTo(2);
  });

  it("returns null for incompatible unit families (mass vs volume)", () => {
    expect(convertQuantity(1, "kg", "l")).toBeNull();
  });

  it("returns null for an unrecognized unit", () => {
    expect(convertQuantity(1, "kg", "banana")).toBeNull();
  });

  it("is case/whitespace insensitive", () => {
    expect(convertQuantity(1, " KG ", "Kilo")).toBeCloseTo(1);
  });
});
