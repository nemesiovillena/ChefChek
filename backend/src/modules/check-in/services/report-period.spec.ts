import { BadRequestException } from "@nestjs/common";
import { resolvePeriod } from "./report.service";

describe("resolvePeriod", () => {
  it("sin fechas devuelve el mes natural", () => {
    expect(resolvePeriod({ year: 2026, month: 2 })).toMatchObject({
      kind: "month",
      from: "2026-02-01",
      to: "2026-02-28",
      label: "febrero de 2026",
    });
  });

  it("con fechas cubre el rango, aunque cruce de mes", () => {
    expect(
      resolvePeriod({
        year: 2026,
        month: 10,
        from: "2026-10-26",
        to: "2026-11-01",
      }),
    ).toMatchObject({
      kind: "range",
      from: "2026-10-26",
      to: "2026-11-01",
      label: "del 26 de octubre al 1 de noviembre de 2026",
    });
  });

  it("dentro de un mes no repite el nombre del mes", () => {
    expect(
      resolvePeriod({
        year: 2026,
        month: 10,
        from: "2026-10-03",
        to: "2026-10-17",
      }).label,
    ).toBe("del 3 al 17 de octubre de 2026");
  });

  it("si cruza de año pone los dos años", () => {
    expect(
      resolvePeriod({
        year: 2025,
        month: 12,
        from: "2025-12-20",
        to: "2026-01-05",
      }).label,
    ).toBe("del 20 de diciembre de 2025 al 5 de enero de 2026");
  });

  it("un solo día", () => {
    expect(
      resolvePeriod({
        year: 2026,
        month: 10,
        from: "2026-10-03",
        to: "2026-10-03",
      }).label,
    ).toBe("3 de octubre de 2026");
  });

  it("rechaza fin antes que inicio, falta una fecha, fecha inexistente o más de un año", () => {
    const bad = [
      { from: "2026-10-17", to: "2026-10-03" },
      { from: "2026-10-03" },
      { from: "2026-02-30", to: "2026-03-05" },
      { from: "2025-01-01", to: "2026-01-02" },
    ];
    for (const q of bad) {
      expect(() => resolvePeriod({ year: 2026, month: 1, ...q })).toThrow(
        BadRequestException,
      );
    }
  });
});
