import {
  easterSunday,
  mothersDay,
  suggestedDates,
} from "./gestion-calendar-suggestions.util";

describe("gestion-calendar-suggestions.util", () => {
  it("calcula el Domingo de Resurrección", () => {
    expect(easterSunday(2024)).toBe("2024-03-31");
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
  });

  it("Día de la Madre = primer domingo de mayo", () => {
    expect(mothersDay(2026)).toBe("2026-05-03");
    expect(mothersDay(2027)).toBe("2027-05-02");
  });

  it("nacional: festivos y fechas comerciales; Villena añade autonómicos y Moros y Cristianos", () => {
    const nacional = suggestedDates(2026, "nacional");
    expect(nacional.find((d) => d.name === "Viernes Santo")?.date).toBe(
      "2026-04-03",
    );
    expect(
      nacional.some((d) => d.kind === "autonomico" || d.kind === "local"),
    ).toBe(false);

    const villena = suggestedDates(2026, "villena");
    expect(
      villena.find((d) => d.name.startsWith("Lunes de Pascua"))?.date,
    ).toBe("2026-04-06");
    expect(
      villena.filter((d) => d.name === "Moros y Cristianos de Villena"),
    ).toHaveLength(5);
  });
});
