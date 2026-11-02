import type { Workday } from "./workday-calculator";
import { monthTotals } from "./workdays.service";

const day = (workedMinutes: number) =>
  ({
    workedMinutes,
    breakMinutes: 0,
    incidences: [],
    open: false,
  }) as unknown as Workday;

describe("monthTotals", () => {
  it("calcula jornada pactada y exceso con horas pactadas", () => {
    // 35 h/semana en un periodo de 28 días = 140 h.
    const totals = monthTotals([day(150 * 60)], 35, 28);
    expect(totals.expectedMinutes).toBe(140 * 60);
    expect(totals.overtimeMinutes).toBe(10 * 60);
  });

  it("sin horas pactadas no inventa jornada ni exceso", () => {
    const totals = monthTotals([day(150 * 60)], null, 28);
    expect(totals.workedMinutes).toBe(150 * 60);
    expect(totals.expectedMinutes).toBeNull();
    expect(totals.overtimeMinutes).toBeNull();
  });
});
