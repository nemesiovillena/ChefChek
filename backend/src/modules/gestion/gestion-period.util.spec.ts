import { BadRequestException } from "@nestjs/common";
import {
  alignedKey,
  assertRange,
  bucketFor,
  bucketKeys,
  bucketStart,
  comparisonAlignment,
  comparisonRange,
  deltaPercent,
  rangeDays,
} from "./gestion-period.util";

describe("gestion-period.util", () => {
  const october = { from: "2026-10-01", to: "2026-10-31" };

  it("cuenta los días con ambos extremos", () => {
    expect(rangeDays(october)).toBe(31);
    expect(rangeDays({ from: "2026-10-12", to: "2026-10-12" })).toBe(1);
  });

  it("compara con el año anterior lunes con lunes (364 días)", () => {
    const cmp = comparisonRange(october, "year");
    expect(cmp).toEqual({ from: "2025-10-02", to: "2025-11-01" });
    const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
    expect(weekday(cmp.from)).toBe(weekday(october.from));
  });

  it("compara con los mismos días justo antes", () => {
    expect(comparisonRange(october, "previous")).toEqual({
      from: "2026-08-31",
      to: "2026-09-30",
    });
  });

  it("trocea por días, semanas o meses según el rango", () => {
    expect(bucketFor(october)).toBe("day");
    expect(bucketFor({ from: "2026-01-01", to: "2026-12-31" })).toBe("week");
    expect(bucketFor({ from: "2024-01-01", to: "2026-12-31" })).toBe("month");
  });

  it("rechaza rangos al revés o de más de diez años", () => {
    expect(() => assertRange({ from: "2026-10-02", to: "2026-10-01" })).toThrow(
      BadRequestException,
    );
    expect(() => assertRange({ from: "2010-01-01", to: "2026-01-01" })).toThrow(
      BadRequestException,
    );
  });

  it("calcula la variación y no divide entre cero", () => {
    expect(deltaPercent(110, 100)).toBe(10);
    expect(deltaPercent(90, 100)).toBe(-10);
    expect(deltaPercent(5, 0)).toBeNull();
  });

  it("periodo anterior por semanas: tramo i con tramo i, sin semanas sueltas", () => {
    const range = { from: "2026-01-01", to: "2026-06-30" };
    const compare = comparisonRange(range, "previous");
    const map = comparisonAlignment(range, compare, "previous", "week");
    const current = bucketKeys(range, "week");
    expect([...map.values()].every((k) => current.includes(k))).toBe(true);
    expect(map.get(bucketKeys(compare, "week")[0])).toBe(current[0]);
    expect(map.get(bucketKeys(compare, "week")[1])).toBe("2026-01-05");
  });

  it("año anterior por meses: marzo con marzo", () => {
    const range = { from: "2026-01-01", to: "2026-12-31" };
    const map = comparisonAlignment(
      range,
      comparisonRange(range, "year"),
      "year",
      "month",
    );
    expect(map.get("2025-03-01")).toBe("2026-03-01");
  });

  it("lleva cada tramo de la comparación a su tramo actual", () => {
    expect(bucketStart("2026-10-15", "week")).toBe("2026-10-12"); // lunes
    expect(alignedKey("2025-10-02", "year", october, "day")).toBe("2026-10-01");
    expect(alignedKey("2025-03-01", "year", october, "month")).toBe(
      "2026-03-01",
    );
    expect(alignedKey("2026-09-01", "previous", october, "day")).toBe(
      "2026-10-02",
    );
  });
});
