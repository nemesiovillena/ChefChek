import {
  addMonthsClamped,
  isDueWithin,
  isOverdue,
} from "./checklist-maintenance-date.util";

describe("addMonthsClamped", () => {
  it("suma meses en el caso normal", () => {
    const d = addMonthsClamped(new Date("2026-01-15T10:00:00Z"), 3);
    expect(d.toISOString()).toBe("2026-04-15T10:00:00.000Z");
  });

  it("clampa al último día del mes destino (31 ene + 1 mes → 28 feb, año no bisiesto)", () => {
    const d = addMonthsClamped(new Date("2026-01-31T10:00:00Z"), 1);
    expect(d.toISOString()).toBe("2026-02-28T10:00:00.000Z");
  });

  it("clampa a 29 feb en año bisiesto", () => {
    const d = addMonthsClamped(new Date("2028-01-31T10:00:00Z"), 1);
    expect(d.toISOString()).toBe("2028-02-29T10:00:00.000Z");
  });

  it("cruza el año correctamente (dic + 2 meses → feb del año siguiente)", () => {
    const d = addMonthsClamped(new Date("2026-12-15T10:00:00Z"), 2);
    expect(d.toISOString()).toBe("2027-02-15T10:00:00.000Z");
  });

  it("31 ago + 6 meses → 28/29 feb (no 3 mar)", () => {
    const d = addMonthsClamped(new Date("2026-08-31T00:00:00Z"), 6);
    expect(d.toISOString()).toBe("2027-02-28T00:00:00.000Z");
  });
});

describe("isDueWithin / isOverdue", () => {
  const now = new Date("2026-06-01T00:00:00Z");

  it("dentro del umbral", () => {
    expect(isDueWithin(new Date("2026-06-20T00:00:00Z"), now, 30)).toBe(true);
  });

  it("fuera del umbral (más lejos)", () => {
    expect(isDueWithin(new Date("2026-08-01T00:00:00Z"), now, 30)).toBe(false);
  });

  it("ya vencida no cuenta como 'dentro del umbral' (es otro aviso)", () => {
    expect(isDueWithin(new Date("2026-05-01T00:00:00Z"), now, 30)).toBe(false);
    expect(isOverdue(new Date("2026-05-01T00:00:00Z"), now)).toBe(true);
  });

  it("no vencida", () => {
    expect(isOverdue(new Date("2026-06-02T00:00:00Z"), now)).toBe(false);
  });
});
