import { computeUseByDate, resolveConservation } from "./shelf-life.util";

describe("resolveConservation", () => {
  it("prefers override values over entity config", () => {
    const result = resolveConservation(
      {
        storageCondition: "REFRIGERATED",
        storageTempMin: 0,
        storageTempMax: 4,
        shelfLifeDays: 3,
        shelfLifeFrozenDays: null,
      },
      { storageCondition: "FROZEN", shelfLifeDays: 5 },
    );
    expect(result.storageCondition).toBe("FROZEN");
    expect(result.shelfLifeDays).toBe(5);
    expect(result.storageTempMax).toBe(4); // sin override -> base
  });

  it("falls back to null when neither side sets a value", () => {
    const result = resolveConservation({}, {});
    expect(result).toEqual({
      storageCondition: null,
      storageTempMin: null,
      storageTempMax: null,
      shelfLifeDays: null,
      shelfLifeFrozenDays: null,
    });
  });
});

describe("computeUseByDate", () => {
  const madridDay = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);

  it("adds N calendar days in Europe/Madrid", () => {
    // 31/08 20:00 UTC = 22:00 Madrid (CEST) → +2 días = 02/09
    const useBy = computeUseByDate(new Date("2026-08-31T20:00:00Z"), 2);
    expect(madridDay(useBy)).toBe("2026-09-02");
  });

  it("uses the Madrid calendar day of `from`, not the server/UTC day", () => {
    // 31/08 23:30 UTC = 01/09 01:30 Madrid → +0 días = 01/09 (no 31/08)
    const useBy = computeUseByDate(new Date("2026-08-31T23:30:00Z"), 0);
    expect(madridDay(useBy)).toBe("2026-09-01");
  });

  it("crosses month/year boundaries", () => {
    const useBy = computeUseByDate(new Date("2026-12-30T10:00:00Z"), 5);
    expect(madridDay(useBy)).toBe("2027-01-04");
  });
});
