import {
  ActualDay,
  compareDay,
  localMinutesFrom,
  minutesToClock,
} from "./plan-vs-actual.util";

const TZ = "Europe/Madrid";
const DATE = "2026-10-05"; // lunes, horario de verano: UTC+2
/** Instante a partir de una hora local de Madrid ese día (o `dayOffset` días después). */
const at = (clock: string, dayOffset = 0) => {
  const [h, m] = clock.split(":").map(Number);
  return new Date(Date.UTC(2026, 9, 5 + dayOffset, h - 2, m));
};
const SHIFT = { startTime: "09:00", endTime: "17:00", breakMinutes: 0 };
const worked = (
  start: string,
  end: string | null,
  minutes: number,
): ActualDay => ({
  firstEntryAt: at(start),
  lastExitAt: end ? at(end) : null,
  workedMinutes: minutes,
  open: end === null,
});
const compare = (
  actual: ActualDay | null,
  now: Date,
  planned = [SHIFT],
  toleranceMinutes = 10,
) =>
  compareDay({
    date: DATE,
    timezone: TZ,
    planned,
    actual,
    now,
    toleranceMinutes,
  });

describe("compareDay", () => {
  it("jornada dentro del margen: sin incidencias", () => {
    const result = compare(worked("09:05", "17:03", 478), at("20:00"));
    expect(result).toMatchObject({
      status: "OK",
      flags: [],
      plannedStart: "09:00",
      plannedEnd: "17:00",
      plannedMinutes: 480,
      actualStart: "09:05",
      actualEnd: "17:03",
    });
  });

  it("antes de empezar el turno está pendiente", () => {
    expect(compare(null, at("08:00")).status).toBe("PENDING");
  });

  it("dentro del margen sin fichar sigue pendiente; pasado, no ha fichado", () => {
    expect(compare(null, at("09:10")).status).toBe("PENDING");
    expect(compare(null, at("09:11")).status).toBe("NO_SHOW");
    expect(compare(null, at("09:00", 1)).status).toBe("NO_SHOW");
  });

  it("retraso por encima del margen, con la jornada en curso", () => {
    const result = compare(worked("09:25", null, 0), at("10:00"));
    expect(result).toMatchObject({
      status: "IN_PROGRESS",
      flags: ["LATE"],
      lateMinutes: 25,
      actualEnd: null,
    });
  });

  it("salida anticipada", () => {
    const result = compare(worked("09:00", "16:30", 450), at("20:00"));
    expect(result).toMatchObject({
      status: "INCIDENT",
      flags: ["EARLY_LEAVE"],
      earlyLeaveMinutes: 30,
    });
  });

  it("exceso sobre el turno", () => {
    const result = compare(worked("09:00", "18:00", 540), at("20:00"));
    expect(result).toMatchObject({
      status: "INCIDENT",
      flags: ["OVER"],
      overMinutes: 60,
    });
  });

  it("retraso y salida anticipada a la vez", () => {
    expect(compare(worked("09:30", "16:00", 390), at("20:00")).flags).toEqual([
      "LATE",
      "EARLY_LEAVE",
    ]);
  });

  it("turno partido: primera entrada, última salida y total del día", () => {
    const split = [
      { startTime: "10:00", endTime: "14:00", breakMinutes: 0 },
      { startTime: "18:00", endTime: "22:00", breakMinutes: 0 },
    ];
    const result = compare(worked("10:00", "22:00", 480), at("23:00"), split);
    expect(result).toMatchObject({
      status: "OK",
      plannedStart: "10:00",
      plannedEnd: "22:00",
      plannedMinutes: 480,
    });
  });

  it("turno que cruza la medianoche: la salida de madrugada no es anticipada", () => {
    const night = [{ startTime: "20:00", endTime: "02:00", breakMinutes: 0 }];
    const actual: ActualDay = {
      firstEntryAt: at("20:00"),
      lastExitAt: at("02:00", 1),
      workedMinutes: 360,
      open: false,
    };
    const result = compare(actual, at("09:00", 1), night);
    expect(result).toMatchObject({
      status: "OK",
      plannedEnd: "02:00",
      actualEnd: "02:00",
    });
  });

  it("trabajo sin turno planificado", () => {
    const result = compare(worked("09:00", "13:00", 240), at("20:00"), []);
    expect(result).toMatchObject({
      status: "UNPLANNED",
      plannedMinutes: 0,
      workedMinutes: 240,
    });
  });

  it("el margen es configurable", () => {
    const actual = worked("09:05", "17:00", 475);
    expect(compare(actual, at("20:00"), [SHIFT], 0).flags).toEqual(["LATE"]);
    expect(compare(actual, at("20:00"), [SHIFT], 5).flags).toEqual([]);
  });
});

describe("horas locales", () => {
  it("mide desde la medianoche local del día", () => {
    expect(localMinutesFrom(at("09:30"), TZ, DATE)).toBe(570);
    expect(localMinutesFrom(at("01:00", 1), TZ, DATE)).toBe(1500);
  });

  it("pasa minutos a hora de reloj", () => {
    expect(minutesToClock(615)).toBe("10:15");
    expect(minutesToClock(1500)).toBe("01:00");
  });
});
