import {
  isCalendarPeriod,
  resolveCalendarPeriod,
} from "./calendar-period.util";

/** Formatea un instante como fecha civil de Madrid (YYYY-MM-DD HH:mm). */
function madrid(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Madrid",
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

describe("resolveCalendarPeriod", () => {
  it("semana_pasada: lunes 00:00 a domingo 23:59 de la semana natural anterior", () => {
    // 2026-08-30 es domingo.
    const { from, to } = resolveCalendarPeriod(
      "semana_pasada",
      new Date("2026-08-30T10:00:00.000Z"),
    );
    expect(madrid(from)).toBe("2026-08-17 00:00");
    expect(madrid(to)).toBe("2026-08-23 23:59");
  });

  it("semana_actual: del lunes de esta semana hasta el fin de hoy (no futuro)", () => {
    // now = miércoles 2026-08-26 12:00 Madrid -> to se recorta a hoy, no al domingo.
    const { from, to } = resolveCalendarPeriod(
      "semana_actual",
      new Date("2026-08-26T10:00:00.000Z"),
    );
    expect(madrid(from)).toBe("2026-08-24 00:00");
    expect(madrid(to)).toBe("2026-08-26 23:59");
  });

  it("trata el lunes como primer día de la semana", () => {
    // 2026-08-24 es lunes -> semana_actual empieza ese mismo día.
    const { from } = resolveCalendarPeriod(
      "semana_actual",
      new Date("2026-08-24T06:00:00.000Z"),
    );
    expect(madrid(from)).toBe("2026-08-24 00:00");
  });

  it("semana_pasada cruzando el cambio de hora de octubre (DST)", () => {
    // 2026-11-02 lunes; la semana previa 2026-10-26..11-01 contiene el cambio
    // de hora del 25-oct (los relojes de Madrid pasan de +02 a +01).
    const { from, to } = resolveCalendarPeriod(
      "semana_pasada",
      new Date("2026-11-02T12:00:00.000Z"),
    );
    expect(madrid(from)).toBe("2026-10-26 00:00");
    expect(madrid(to)).toBe("2026-11-01 23:59");
    // from es medianoche de Madrid ya en horario de invierno (+01) => 23:00 UTC.
    expect(from.toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });

  it("mes_pasado: mes natural anterior completo", () => {
    const { from, to } = resolveCalendarPeriod(
      "mes_pasado",
      new Date("2026-03-15T00:00:00.000Z"),
    );
    expect(madrid(from)).toBe("2026-02-01 00:00");
    expect(madrid(to)).toBe("2026-02-28 23:59");
  });

  it("mes_actual: del día 1 hasta el fin de hoy (no proyecta al fin de mes)", () => {
    const { from, to } = resolveCalendarPeriod(
      "mes_actual",
      new Date("2026-08-14T10:00:00.000Z"),
    );
    expect(madrid(from)).toBe("2026-08-01 00:00");
    expect(madrid(to)).toBe("2026-08-14 23:59");
  });

  it("mes_pasado en enero apunta a diciembre del año anterior", () => {
    const { from, to } = resolveCalendarPeriod(
      "mes_pasado",
      new Date("2026-01-10T00:00:00.000Z"),
    );
    expect(madrid(from)).toBe("2025-12-01 00:00");
    expect(madrid(to)).toBe("2025-12-31 23:59");
  });
});

describe("isCalendarPeriod", () => {
  it("acepta los cuatro valores válidos", () => {
    for (const v of [
      "semana_actual",
      "semana_pasada",
      "mes_actual",
      "mes_pasado",
    ]) {
      expect(isCalendarPeriod(v)).toBe(true);
    }
  });

  it("rechaza cualquier otra cosa", () => {
    for (const v of ["semana", "last_week", "", null, undefined, 3]) {
      expect(isCalendarPeriod(v)).toBe(false);
    }
  });
});
