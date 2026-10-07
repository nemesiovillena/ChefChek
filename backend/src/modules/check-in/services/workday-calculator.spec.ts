import { PunchType } from "@prisma/client";
import {
  EffectivePunch,
  WorkdayOptions,
  calculateWorkdays,
  localDate,
} from "./workday-calculator";

const TZ = "Europe/Madrid";
let n = 0;
/** Fichaje a una hora local de Madrid en horario de verano (UTC+2), salvo que se pase un ISO completo. */
const p = (type: keyof typeof PunchType, at: string): EffectivePunch => ({
  id: `p${++n}`,
  type: PunchType[type],
  occurredAt: new Date(
    at.includes("Z") || at.includes("+") ? at : `${at}+02:00`,
  ),
});
const opts = (over: Partial<WorkdayOptions> = {}): WorkdayOptions => ({
  timezone: TZ,
  breaksCountAsWork: false,
  now: new Date("2026-12-01T12:00:00Z"),
  openGraceHours: 14,
  ...over,
});

describe("calculateWorkdays", () => {
  it("jornada simple: entrada y salida", () => {
    const [day] = calculateWorkdays(
      [p("IN", "2026-10-05T09:00"), p("OUT", "2026-10-05T17:30")],
      opts(),
    );
    expect(day).toMatchObject({
      date: "2026-10-05",
      workedMinutes: 510,
      breakMinutes: 0,
      incidences: [],
      open: false,
    });
    expect(day.segments).toHaveLength(1);
  });

  it("turno partido: dos tramos el mismo día, el hueco no cuenta", () => {
    const [day, ...rest] = calculateWorkdays(
      [
        p("IN", "2026-10-05T12:00"),
        p("OUT", "2026-10-05T16:00"),
        p("IN", "2026-10-05T20:00"),
        p("OUT", "2026-10-05T23:30"),
      ],
      opts(),
    );
    expect(rest).toHaveLength(0);
    expect(day.workedMinutes).toBe(240 + 210);
    expect(day.segments.filter((s) => s.kind === "WORK")).toHaveLength(2);
    expect(day.incidences).toEqual([]);
  });

  it("las pausas no cuentan salvo que la empresa lo active", () => {
    const punches = [
      p("IN", "2026-10-05T09:00"),
      p("BREAK_START", "2026-10-05T11:00"),
      p("BREAK_END", "2026-10-05T11:20"),
      p("OUT", "2026-10-05T14:00"),
    ];
    const [off] = calculateWorkdays(punches, opts());
    expect(off.breakMinutes).toBe(20);
    expect(off.workedMinutes).toBe(280);

    const [on] = calculateWorkdays(punches, opts({ breaksCountAsWork: true }));
    expect(on.workedMinutes).toBe(300);
  });

  it("un turno que cruza la medianoche se imputa entero al día de inicio", () => {
    const days = calculateWorkdays(
      [p("IN", "2026-10-05T19:00"), p("OUT", "2026-10-06T02:30")],
      opts(),
    );
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe("2026-10-05");
    expect(days[0].workedMinutes).toBe(450);
  });

  it("el día se decide en la zona horaria del centro, no en UTC", () => {
    // 23:30 UTC del día 5 son la 01:30 del día 6 en Madrid.
    const [day] = calculateWorkdays(
      [p("IN", "2026-10-05T23:30:00Z"), p("OUT", "2026-10-06T05:30:00Z")],
      opts(),
    );
    expect(day.date).toBe("2026-10-06");
    expect(localDate(new Date("2026-10-05T23:30:00Z"), "UTC")).toBe(
      "2026-10-05",
    );
  });

  it("el cambio de hora de otoño no regala ni quita tiempo", () => {
    // Noche del 24 al 25 de octubre de 2026: a las 03:00 vuelven a ser las 02:00.
    // De 22:00 (UTC+2) a 06:00 (UTC+1) pasan 9 horas reales.
    const [day] = calculateWorkdays(
      [
        p("IN", "2026-10-24T22:00:00+02:00"),
        p("OUT", "2026-10-25T06:00:00+01:00"),
      ],
      opts(),
    );
    expect(day.date).toBe("2026-10-24");
    expect(day.workedMinutes).toBe(540);
  });

  it("el cambio de hora de primavera tampoco", () => {
    // 29 de marzo de 2026: a las 02:00 pasan a ser las 03:00. De 22:00 a 06:00 son 7 h.
    const [day] = calculateWorkdays(
      [
        p("IN", "2026-03-28T22:00:00+01:00"),
        p("OUT", "2026-03-29T06:00:00+02:00"),
      ],
      opts(),
    );
    expect(day.workedMinutes).toBe(420);
  });

  it("entrada antigua sin salida: incidencia y ningún minuto inventado", () => {
    const [day] = calculateWorkdays([p("IN", "2026-10-05T09:00")], opts());
    expect(day.incidences).toEqual(["SIN_SALIDA"]);
    expect(day.workedMinutes).toBe(0);
    expect(day.open).toBe(false);
  });

  it("entrada reciente sin salida: jornada en curso, no incidencia", () => {
    const [day] = calculateWorkdays(
      [p("IN", "2026-10-05T09:00")],
      opts({ now: new Date("2026-10-05T12:00:00+02:00") }),
    );
    expect(day.open).toBe(true);
    expect(day.incidences).toEqual([]);
    expect(day.workedMinutes).toBe(0);
  });

  it("conserva lo trabajado antes de un tramo sin cerrar", () => {
    const [day] = calculateWorkdays(
      [
        p("IN", "2026-10-05T09:00"),
        p("OUT", "2026-10-05T13:00"),
        p("IN", "2026-10-05T17:00"),
      ],
      opts(),
    );
    expect(day.workedMinutes).toBe(240);
    expect(day.incidences).toEqual(["SIN_SALIDA"]);
  });

  it("dos entradas seguidas: a la primera le falta la salida", () => {
    const days = calculateWorkdays(
      [
        p("IN", "2026-10-05T09:00"),
        p("IN", "2026-10-06T09:00"),
        p("OUT", "2026-10-06T17:00"),
      ],
      opts(),
    );
    expect(days.map((d) => [d.date, d.workedMinutes, d.incidences])).toEqual([
      ["2026-10-05", 0, ["SIN_SALIDA"]],
      ["2026-10-06", 480, []],
    ]);
  });

  it("salida sin entrada o pausa fuera de jornada: incidencia de secuencia", () => {
    const [day] = calculateWorkdays(
      [p("OUT", "2026-10-05T17:00"), p("BREAK_START", "2026-10-05T18:00")],
      opts(),
    );
    expect(day.incidences).toEqual(["SECUENCIA"]);
    expect(day.workedMinutes).toBe(0);
  });

  it("salir estando en pausa cierra la pausa y marca la secuencia", () => {
    const [day] = calculateWorkdays(
      [
        p("IN", "2026-10-05T09:00"),
        p("BREAK_START", "2026-10-05T12:00"),
        p("OUT", "2026-10-05T12:30"),
      ],
      opts(),
    );
    expect(day.workedMinutes).toBe(180);
    expect(day.breakMinutes).toBe(30);
    expect(day.incidences).toEqual(["SECUENCIA"]);
  });

  it("ordena los fichajes aunque lleguen desordenados y agrupa por día", () => {
    const days = calculateWorkdays(
      [
        p("OUT", "2026-10-06T15:00"),
        p("OUT", "2026-10-05T15:00"),
        p("IN", "2026-10-06T09:00"),
        p("IN", "2026-10-05T10:00"),
      ],
      opts(),
    );
    expect(days.map((d) => [d.date, d.workedMinutes])).toEqual([
      ["2026-10-05", 300],
      ["2026-10-06", 360],
    ]);
    expect(days[0].punchIds).toHaveLength(2);
  });

  it("sin fichajes no hay jornadas", () => {
    expect(calculateWorkdays([], opts())).toEqual([]);
  });
});
