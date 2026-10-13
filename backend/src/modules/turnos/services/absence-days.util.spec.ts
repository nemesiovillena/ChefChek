import { VacationDayType } from "@prisma/client";
import {
  countAbsenceDays,
  defaultEntitlement,
  parseDate,
} from "./absence-days.util";

const natural = {
  dayType: VacationDayType.NATURAL,
  holidays: new Set<string>(),
};
const working = (holidays: string[] = []) => ({
  dayType: VacationDayType.WORKING,
  holidays: new Set(holidays),
});
const d = parseDate;

describe("countAbsenceDays", () => {
  it("días naturales: cuenta todos, fines de semana incluidos", () => {
    // Lunes 5 a domingo 11 de octubre de 2026.
    expect(countAbsenceDays(d("2026-10-05"), d("2026-10-11"), natural)).toBe(7);
  });

  it("días laborables: salta sábados, domingos y festivos", () => {
    expect(countAbsenceDays(d("2026-10-05"), d("2026-10-11"), working())).toBe(
      5,
    );
    // El lunes 12 de octubre es festivo.
    expect(
      countAbsenceDays(
        d("2026-10-09"),
        d("2026-10-13"),
        working(["2026-10-12"]),
      ),
    ).toBe(2);
  });

  it("un solo día y media jornada", () => {
    expect(countAbsenceDays(d("2026-10-05"), d("2026-10-05"), natural)).toBe(1);
    expect(
      countAbsenceDays(d("2026-10-05"), d("2026-10-05"), {
        ...natural,
        halfDay: true,
      }),
    ).toBe(0.5);
    // Media jornada no aplica a ausencias de varios días.
    expect(
      countAbsenceDays(d("2026-10-05"), d("2026-10-06"), {
        ...natural,
        halfDay: true,
      }),
    ).toBe(2);
  });

  it("una ausencia a caballo entre dos años reparte los días", () => {
    const start = d("2026-12-28");
    const end = d("2027-01-03");
    expect(countAbsenceDays(start, end, { ...natural, year: 2026 })).toBe(4);
    expect(countAbsenceDays(start, end, { ...natural, year: 2027 })).toBe(3);
  });

  it("un fin de semana en días laborables no consume nada", () => {
    expect(countAbsenceDays(d("2026-10-10"), d("2026-10-11"), working())).toBe(
      0,
    );
  });
});

describe("defaultEntitlement", () => {
  it("año completo: todos los días", () => {
    expect(defaultEntitlement(30, 2026, null)).toBe(30);
    expect(defaultEntitlement(30, 2026, d("2020-03-01"))).toBe(30);
  });

  it("alta a mitad de año: parte proporcional, al medio día", () => {
    expect(defaultEntitlement(30, 2026, d("2026-07-01"))).toBe(15);
    expect(defaultEntitlement(30, 2026, d("2026-01-01"))).toBe(30);
    expect(defaultEntitlement(30, 2026, d("2026-12-01"))).toBe(2.5);
  });

  it("antes del alta no corresponde nada", () => {
    expect(defaultEntitlement(30, 2026, d("2027-02-01"))).toBe(0);
  });
});
