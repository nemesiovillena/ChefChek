import {
  computePeriodKey,
  isGenerationDay,
  isPeriodElapsed,
  madridCalendarDay,
  periodEndFromKey,
  periodStartFromKey,
} from "./checklist-period.util";

describe("checklist-period.util", () => {
  describe("computePeriodKey", () => {
    it("DAILY: día natural en Madrid", () => {
      // 21:30 UTC del 20/09 -> 23:30 en Madrid (CEST, UTC+2) -> sigue 20/09.
      expect(computePeriodKey(new Date("2026-09-20T21:30:00Z"), "DAILY")).toBe(
        "2026-09-20",
      );
      // 22:30 UTC del 20/09 -> 00:30 del 21/09 en Madrid -> ya es 21/09.
      expect(computePeriodKey(new Date("2026-09-20T22:30:00Z"), "DAILY")).toBe(
        "2026-09-21",
      );
    });

    it("DAILY: medianoche justa en Madrid (cambio de día natural)", () => {
      // 23:59 UTC del 31/12 -> 00:59 del 01/01 en Madrid (CET, UTC+1).
      expect(computePeriodKey(new Date("2025-12-31T23:59:00Z"), "DAILY")).toBe(
        "2026-01-01",
      );
    });

    it("WEEKLY: semana ISO, lunes como primer día", () => {
      // Lunes 21/09/2026 -> semana ISO 39.
      expect(computePeriodKey(new Date("2026-09-21T10:00:00Z"), "WEEKLY")).toBe(
        "2026-W39",
      );
      // Domingo 20/09/2026 (mismo mediodía Madrid) -> semana ISO 38, la anterior.
      expect(computePeriodKey(new Date("2026-09-20T10:00:00Z"), "WEEKLY")).toBe(
        "2026-W38",
      );
    });

    it("WEEKLY: primeros días de enero pueden pertenecer a la última semana ISO del año anterior", () => {
      // 1/1/2027 es viernes -> semana ISO 53 de 2026 (ISO: la semana que
      // contiene el primer jueves del año es la semana 1).
      const key = computePeriodKey(new Date("2027-01-01T10:00:00Z"), "WEEKLY");
      expect(key).toMatch(/^2026-W5\d$/);
    });

    it("MONTHLY/QUARTERLY/ANNUAL", () => {
      const d = new Date("2026-09-20T10:00:00Z");
      expect(computePeriodKey(d, "MONTHLY")).toBe("2026-09");
      expect(computePeriodKey(d, "QUARTERLY")).toBe("2026-Q3");
      expect(computePeriodKey(d, "ANNUAL")).toBe("2026");
    });

    it("QUARTERLY: fin de trimestre (diciembre = Q4)", () => {
      expect(
        computePeriodKey(new Date("2026-12-15T10:00:00Z"), "QUARTERLY"),
      ).toBe("2026-Q4");
    });
  });

  describe("periodStartFromKey / periodEndFromKey (ida y vuelta)", () => {
    it("DAILY: un día exacto", () => {
      const start = periodStartFromKey("2026-09-21", "DAILY");
      const end = periodEndFromKey("2026-09-21", "DAILY");
      expect(end.getTime() - start.getTime()).toBe(86_400_000);
      expect(computePeriodKey(start, "DAILY")).toBe("2026-09-21");
    });

    it("WEEKLY: el lunes calculado cae en la semana correcta", () => {
      const start = periodStartFromKey("2026-W39", "WEEKLY");
      expect(computePeriodKey(start, "WEEKLY")).toBe("2026-W39");
      const end = periodEndFromKey("2026-W39", "WEEKLY");
      expect(end.getTime() - start.getTime()).toBe(7 * 86_400_000);
    });

    it("MONTHLY: cambio de año (diciembre -> enero)", () => {
      const start = periodStartFromKey("2026-12", "MONTHLY");
      const end = periodEndFromKey("2026-12", "MONTHLY");
      expect(madridCalendarDay(end)).toEqual({ y: 2027, m: 1, d: 1 });
      expect(computePeriodKey(start, "MONTHLY")).toBe("2026-12");
    });

    it("MONTHLY: febrero en año bisiesto", () => {
      const start = periodStartFromKey("2028-02", "MONTHLY");
      const end = periodEndFromKey("2028-02", "MONTHLY");
      // 2028 es bisiesto: febrero tiene 29 días.
      expect((end.getTime() - start.getTime()) / 86_400_000).toBe(29);
    });

    it("QUARTERLY: Q4 termina en enero del año siguiente", () => {
      const end = periodEndFromKey("2026-Q4", "QUARTERLY");
      expect(madridCalendarDay(end)).toEqual({ y: 2027, m: 1, d: 1 });
    });

    it("ANNUAL", () => {
      const start = periodStartFromKey("2026", "ANNUAL");
      const end = periodEndFromKey("2026", "ANNUAL");
      expect(madridCalendarDay(start)).toEqual({ y: 2026, m: 1, d: 1 });
      expect(madridCalendarDay(end)).toEqual({ y: 2027, m: 1, d: 1 });
    });
  });

  describe("isPeriodElapsed", () => {
    it("un periodo DAILY pasado ha terminado", () => {
      expect(
        isPeriodElapsed(
          "2026-09-20",
          "DAILY",
          new Date("2026-09-22T00:00:00Z"),
        ),
      ).toBe(true);
    });

    it("el periodo DAILY de hoy no ha terminado (aún es el mismo día)", () => {
      expect(
        isPeriodElapsed(
          "2026-09-21",
          "DAILY",
          new Date("2026-09-21T10:00:00Z"),
        ),
      ).toBe(false);
    });
  });

  describe("isGenerationDay", () => {
    it("DAILY siempre genera", () => {
      expect(isGenerationDay(new Date(), "DAILY")).toBe(true);
    });

    it("WEEKLY solo el weekday configurado (0=domingo)", () => {
      // Lunes 21/09/2026, mediodía Madrid.
      const monday = new Date("2026-09-21T10:00:00Z");
      expect(isGenerationDay(monday, "WEEKLY", 1)).toBe(true);
      expect(isGenerationDay(monday, "WEEKLY", 2)).toBe(false);
    });

    it("MONTHLY: dayOfMonth normal", () => {
      const d15 = new Date("2026-09-15T10:00:00Z");
      expect(isGenerationDay(d15, "MONTHLY", null, 15)).toBe(true);
      expect(isGenerationDay(d15, "MONTHLY", null, 16)).toBe(false);
    });

    it("MONTHLY: dayOfMonth=31 en un mes de 30 días genera el último día", () => {
      // Septiembre tiene 30 días.
      const d30 = new Date("2026-09-30T10:00:00Z");
      expect(isGenerationDay(d30, "MONTHLY", null, 31)).toBe(true);
      const d29 = new Date("2026-09-29T10:00:00Z");
      expect(isGenerationDay(d29, "MONTHLY", null, 31)).toBe(false);
    });

    it("QUARTERLY genera el día 1 de enero/abril/julio/octubre", () => {
      expect(
        isGenerationDay(new Date("2026-07-01T10:00:00Z"), "QUARTERLY"),
      ).toBe(true);
      expect(
        isGenerationDay(new Date("2026-07-02T10:00:00Z"), "QUARTERLY"),
      ).toBe(false);
      expect(
        isGenerationDay(new Date("2026-08-01T10:00:00Z"), "QUARTERLY"),
      ).toBe(false);
    });

    it("ANNUAL solo el 1 de enero", () => {
      expect(isGenerationDay(new Date("2026-01-01T10:00:00Z"), "ANNUAL")).toBe(
        true,
      );
      expect(isGenerationDay(new Date("2026-01-02T10:00:00Z"), "ANNUAL")).toBe(
        false,
      );
    });
  });
});
