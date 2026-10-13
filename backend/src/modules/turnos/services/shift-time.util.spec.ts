import {
  isMonday,
  shiftInterval,
  shiftWorkMinutes,
  shiftsOverlap,
} from "./shift-time.util";

const s = (startTime: string, endTime: string, breakMinutes = 0) => ({
  startTime,
  endTime,
  breakMinutes,
});

describe("horario de un turno", () => {
  it("calcula la duración descontando la pausa", () => {
    expect(shiftWorkMinutes(s("09:00", "17:00"))).toBe(480);
    expect(shiftWorkMinutes(s("09:00", "17:00", 30))).toBe(450);
  });

  it("un turno que acaba antes de empezar termina al día siguiente", () => {
    expect(shiftInterval("22:00", "02:00")).toEqual([1320, 1560]);
    expect(shiftWorkMinutes(s("22:00", "02:00"))).toBe(240);
    // Misma hora de inicio y fin = 24 horas.
    expect(shiftWorkMinutes(s("08:00", "08:00"))).toBe(1440);
  });

  it("la pausa nunca deja minutos negativos", () => {
    expect(shiftWorkMinutes(s("09:00", "09:30", 60))).toBe(0);
  });

  it("detecta turnos que se pisan", () => {
    expect(shiftsOverlap(s("09:00", "13:00"), s("12:00", "16:00"))).toBe(true);
    expect(shiftsOverlap(s("20:00", "02:00"), s("23:00", "23:30"))).toBe(true);
  });

  it("un turno partido (tramos que no se tocan o solo se rozan) no se pisa", () => {
    expect(shiftsOverlap(s("09:00", "13:00"), s("17:00", "21:00"))).toBe(false);
    expect(shiftsOverlap(s("09:00", "13:00"), s("13:00", "17:00"))).toBe(false);
  });

  it("reconoce un lunes", () => {
    expect(isMonday(new Date("2026-10-05T00:00:00Z"))).toBe(true);
    expect(isMonday(new Date("2026-10-06T00:00:00Z"))).toBe(false);
    expect(isMonday(new Date("nope"))).toBe(false);
  });
});
