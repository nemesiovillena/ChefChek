import { BadRequestException } from "@nestjs/common";
import { resolvePeriod } from "./report.service";

describe("resolvePeriod", () => {
  it("sin semana devuelve el mes natural", () => {
    expect(resolvePeriod({ year: 2026, month: 2 })).toMatchObject({
      kind: "month",
      from: "2026-02-01",
      to: "2026-02-28",
      label: "febrero de 2026",
    });
  });

  it("con semana va de lunes a domingo, aunque cruce de mes", () => {
    expect(
      resolvePeriod({ year: 2026, month: 10, weekStart: "2026-10-26" }),
    ).toMatchObject({
      kind: "week",
      from: "2026-10-26",
      to: "2026-11-01",
      label: "semana del 26 de octubre al 1 de noviembre de 2026",
    });
  });

  it("dentro de un mes no repite el nombre del mes", () => {
    expect(
      resolvePeriod({ year: 2026, month: 10, weekStart: "2026-10-19" }).label,
    ).toBe("semana del 19 al 25 de octubre de 2026");
  });

  it("rechaza una semana que no empieza en lunes", () => {
    expect(() =>
      resolvePeriod({ year: 2026, month: 10, weekStart: "2026-10-27" }),
    ).toThrow(BadRequestException);
  });
});
