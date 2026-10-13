import {
  RuleShift,
  ScheduleRulesInput,
  evaluateScheduleRules,
  formatMinutes,
} from "./schedule-rules-engine";

const THRESHOLDS = {
  maxDailyHours: 9,
  minRestBetweenShiftsHours: 12,
  weeklyRestDays: 1.5,
  overtimeYearlyCap: 80,
};
const ANA = { id: "ana", name: "Ana", weeklyHours: 40, overtimeYearMinutes: 0 };

let nextId = 0;
const shift = (
  date: string,
  startTime: string,
  endTime: string,
  breakMinutes = 0,
): RuleShift => ({
  id: `s${(nextId += 1)}`,
  employeeId: "ana",
  date,
  startTime,
  endTime,
  breakMinutes,
});

// Semana del lunes 2026-10-05 al domingo 2026-10-11.
const run = (
  shifts: RuleShift[],
  overrides: Partial<ScheduleRulesInput> = {},
) =>
  evaluateScheduleRules({
    weekStart: "2026-10-05",
    shifts,
    employees: [ANA],
    thresholds: THRESHOLDS,
    ...overrides,
  });
const codes = (shifts: RuleShift[], overrides?: Partial<ScheduleRulesInput>) =>
  run(shifts, overrides).map((a) => a.code);

describe("evaluateScheduleRules", () => {
  it("una semana normal no genera avisos", () => {
    const week = ["05", "06", "07", "08", "09"].map((d) =>
      shift(`2026-10-${d}`, "09:00", "17:00"),
    );
    expect(run(week)).toEqual([]);
  });

  it("sin turnos en la semana no se avisa de nada", () => {
    expect(
      run([], { employees: [{ ...ANA, overtimeYearMinutes: 80 * 60 }] }),
    ).toEqual([]);
  });

  describe("descanso entre jornadas", () => {
    it("avisa con menos de 12 h y señala los dos turnos", () => {
      const late = shift("2026-10-05", "16:00", "23:30");
      const early = shift("2026-10-06", "08:00", "12:00");
      const alerts = run([late, early]);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        code: "DESCANSO_ENTRE_JORNADAS",
        date: "2026-10-06",
        shiftIds: [late.id, early.id],
      });
      expect(alerts[0].message).toContain("8 h 30 min");
    });

    it("no avisa con 12 h justas", () => {
      expect(
        codes([
          shift("2026-10-05", "12:00", "20:00"),
          shift("2026-10-06", "08:00", "14:00"),
        ]),
      ).toEqual([]);
    });

    it("el hueco de un turno partido no es descanso entre jornadas", () => {
      expect(
        codes([
          shift("2026-10-05", "10:00", "14:00"),
          shift("2026-10-05", "18:00", "22:00"),
        ]),
      ).toEqual([]);
    });

    it("cuenta el final real de un turno que cruza la medianoche", () => {
      expect(
        codes([
          shift("2026-10-05", "20:00", "02:00"),
          shift("2026-10-06", "12:00", "16:00"),
        ]),
      ).toEqual(["DESCANSO_ENTRE_JORNADAS"]);
    });

    it("tiene en cuenta el domingo de la semana anterior", () => {
      const sunday = shift("2026-10-04", "16:00", "23:00");
      const monday = shift("2026-10-05", "07:00", "12:00");
      const alerts = run([sunday, monday]);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        code: "DESCANSO_ENTRE_JORNADAS",
        date: "2026-10-05",
        shiftIds: [monday.id],
      });
    });
  });

  describe("jornada diaria", () => {
    it("avisa por encima de 9 h sumando los tramos del turno partido", () => {
      const alerts = run([
        shift("2026-10-05", "09:00", "14:00"),
        shift("2026-10-05", "16:00", "21:00"),
      ]);
      expect(alerts.map((a) => a.code)).toEqual(["JORNADA_DIARIA"]);
      expect(alerts[0].date).toBe("2026-10-05");
    });

    it("la pausa no cuenta: 9 h 30 min con 30 min de pausa no avisa", () => {
      expect(codes([shift("2026-10-05", "09:00", "18:30", 30)])).toEqual([]);
    });
  });

  describe("horas semanales", () => {
    const weekdays = (end: string) =>
      ["05", "06", "07", "08", "09"].map((d) =>
        shift(`2026-10-${d}`, "09:00", end),
      );

    it("avisa al superar las pactadas", () => {
      expect(codes(weekdays("18:00"))).toEqual(["HORAS_SEMANALES"]);
    });

    it("no avisa al igualarlas", () => {
      expect(codes(weekdays("17:00"))).toEqual([]);
    });

    it("usa las horas pactadas de cada persona", () => {
      expect(
        codes([shift("2026-10-05", "09:00", "17:00")], {
          employees: [{ ...ANA, weeklyHours: 6 }],
        }),
      ).toEqual(["HORAS_SEMANALES"]);
    });
  });

  describe("descanso semanal", () => {
    it("avisa si no hay 36 h seguidas libres", () => {
      const everyDay = ["05", "06", "07", "08", "09", "10", "11"].map((d) =>
        shift(`2026-10-${d}`, "10:00", "14:00"),
      );
      expect(codes(everyDay)).toEqual(["DESCANSO_SEMANAL"]);
    });

    it("no avisa con un día y medio libre al final de la semana", () => {
      const untilSaturdayNoon = ["05", "06", "07", "08", "09"].map((d) =>
        shift(`2026-10-${d}`, "09:00", "16:00"),
      );
      untilSaturdayNoon.push(shift("2026-10-10", "08:00", "12:00"));
      expect(codes(untilSaturdayNoon)).toEqual([]);
    });

    it("un turno del domingo anterior que acaba de madrugada acorta el descanso del lunes", () => {
      // Libre solo de lunes 06:00 a martes 12:00 (30 h) y luego trabaja a diario.
      const shifts = [shift("2026-10-04", "22:00", "06:00")];
      for (const d of ["06", "07", "08", "09", "10", "11"]) {
        shifts.push(shift(`2026-10-${d}`, "12:00", "16:00"));
      }
      expect(codes(shifts)).toContain("DESCANSO_SEMANAL");
    });
  });

  describe("horas extra del año", () => {
    const oneShift = [shift("2026-10-05", "09:00", "17:00")];

    it("avisa al llegar al 90 % del tope", () => {
      expect(
        codes(oneShift, {
          employees: [{ ...ANA, overtimeYearMinutes: 72 * 60 }],
        }),
      ).toEqual(["HORAS_EXTRA_ANUALES"]);
    });

    it("no avisa por debajo", () => {
      expect(
        codes(oneShift, {
          employees: [{ ...ANA, overtimeYearMinutes: 71 * 60 }],
        }),
      ).toEqual([]);
    });
  });

  it("los umbrales salen de los ajustes del tenant", () => {
    expect(
      codes([shift("2026-10-05", "09:00", "16:00")], {
        thresholds: { ...THRESHOLDS, maxDailyHours: 6 },
      }),
    ).toEqual(["JORNADA_DIARIA"]);
  });

  it("formatea duraciones", () => {
    expect(formatMinutes(540)).toBe("9 h");
    expect(formatMinutes(510)).toBe("8 h 30 min");
  });
});
