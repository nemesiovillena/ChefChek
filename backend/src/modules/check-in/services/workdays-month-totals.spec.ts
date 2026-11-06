import type { Workday } from "./workday-calculator";
import { VacationDayType } from "@prisma/client";
import { WorkdayAbsence, monthTotals } from "./workdays.service";

const absence = (date: string, halfDay = false) =>
  ({ date, halfDay }) as WorkdayAbsence;

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

  it("cada día de ausencia descuenta 1/7 de la semana con días naturales", () => {
    // 35 h × 28/7 = 140 h; 7 días naturales de vacaciones = 35 h menos.
    const absences = Array.from({ length: 7 }, (_, i) =>
      absence(`2026-02-0${i + 1}`),
    );
    const totals = monthTotals([day(100 * 60)], 35, 28, absences);
    expect(totals.absenceDays).toBe(7);
    expect(totals.expectedMinutes).toBe(105 * 60);
    expect(totals.overtimeMinutes).toBe(0);
  });

  it("con días laborables, cada día descuenta 1/5 y media jornada la mitad", () => {
    const totals = monthTotals(
      [],
      40,
      28,
      [absence("2026-02-02"), absence("2026-02-03", true)],
      VacationDayType.WORKING,
    );
    expect(totals.absenceDays).toBe(1.5);
    expect(totals.expectedMinutes).toBe(160 * 60 - 12 * 60);
  });

  it("la jornada pactada nunca baja de cero", () => {
    const absences = Array.from({ length: 10 }, (_, i) =>
      absence(`2026-02-${10 + i}`),
    );
    const totals = monthTotals([], 40, 7, absences, VacationDayType.WORKING);
    expect(totals.expectedMinutes).toBe(0);
  });
});
