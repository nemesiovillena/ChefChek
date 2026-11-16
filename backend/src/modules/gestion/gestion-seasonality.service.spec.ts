import { BadRequestException } from "@nestjs/common";
import { GestionSeasonalityService } from "./gestion-seasonality.service";

describe("GestionSeasonalityService.analysis", () => {
  it("compara un festivo con el mismo día de la semana de alrededor, sin otras fechas señaladas", async () => {
    const dates = [
      {
        id: "a",
        date: new Date("2025-12-06T00:00:00Z"),
        name: "Constitución",
        kind: "nacional",
      },
      {
        id: "b",
        date: new Date("2025-12-20T00:00:00Z"),
        name: "Cena de empresa",
        kind: "propio",
      },
      {
        id: "c",
        date: new Date("2025-12-24T00:00:00Z"),
        name: "Nochebuena",
        kind: "comercial",
      },
    ];
    const days = [
      // Sábados de diciembre de 2025: 6 (Constitución), 13, 20 y 27.
      { date: "2025-12-06", dow: 6, total: 600, tickets: 30 },
      { date: "2025-12-13", dow: 6, total: 300, tickets: 20 },
      { date: "2025-12-20", dow: 6, total: 500, tickets: 25 },
      { date: "2025-12-27", dow: 6, total: 400, tickets: 22 },
    ];
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce(days) // ventas del año ± 4 semanas
        .mockResolvedValueOnce([{ week: 49, years: 2, avg: 1000, best: 1200 }]),
      gestionCalendarDate: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "a",
            date: new Date("2025-12-06T00:00:00Z"),
            name: "Constitución",
            kind: "nacional",
          },
          {
            id: "b",
            date: new Date("2025-12-20T00:00:00Z"),
            name: "Cena de empresa",
            kind: "propio",
          },
          {
            id: "c",
            date: new Date("2025-12-24T00:00:00Z"),
            name: "Nochebuena",
            kind: "comercial",
          },
        ]),
      },
    };
    const service = new GestionSeasonalityService(prisma as any);
    const r = await service.analysis("t1", 2025);

    const constitucion = r.holidays.find((h) => h.name === "Constitución");
    // Normal = sábados 13 y 27 (el 20 también es fecha señalada): (300 + 400) / 2 = 350.
    expect(constitucion).toMatchObject({
      weekday: "sábado",
      total: 600,
      normalAvg: 350,
      deltaPct: 71.4,
      open: true,
    });
    const nochebuena = r.holidays.find((h) => h.name === "Nochebuena");
    expect(nochebuena).toMatchObject({ open: false, total: 0, deltaPct: null });
    expect(r.topDays[0]).toMatchObject({
      date: "2025-12-06",
      special: ["Constitución"],
    });
    expect(r.byWeekday[5]).toEqual({
      weekday: "sábado",
      daysWithSales: 4,
      avgTotal: 450,
    });
    expect(r.weeks[0]).toEqual({
      week: 49,
      years: 2,
      avgTotal: 1000,
      bestTotal: 1200,
    });
  });

  it("un festivo del año anterior no cuenta como día normal", async () => {
    const days = [
      { date: "2024-12-25", dow: 3, total: 9000, tickets: 90 }, // Navidad 2024
      { date: "2025-01-01", dow: 3, total: 500, tickets: 20 }, // Año Nuevo
      { date: "2025-01-08", dow: 3, total: 100, tickets: 10 },
    ];
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: "a",
          date: new Date("2025-01-01T00:00:00Z"),
          name: "Año Nuevo",
          kind: "nacional",
        },
      ])
      .mockResolvedValueOnce([
        { date: new Date("2024-12-25T00:00:00Z") },
        { date: new Date("2025-01-01T00:00:00Z") },
      ]);
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce(days)
        .mockResolvedValueOnce([]),
      gestionCalendarDate: { findMany },
    };
    const r = await new GestionSeasonalityService(prisma as any).analysis(
      "t1",
      2025,
    );
    expect(r.holidays[0]).toMatchObject({ normalAvg: 100, deltaPct: 400 });
    expect(r.days.map((d) => d.date)).toEqual(["2025-01-01", "2025-01-08"]);
  });

  it("no guarda fechas que no existen", async () => {
    const service = new GestionSeasonalityService({
      gestionCalendarDate: { upsert: jest.fn() },
    } as any);
    await expect(
      service.create("t1", { date: "2025-02-30", name: "X", kind: "propio" }),
    ).rejects.toThrow("no existe");
  });

  it("rechaza años fuera de rango", async () => {
    const service = new GestionSeasonalityService({} as any);
    await expect(service.analysis("t1", 1999)).rejects.toThrow(
      BadRequestException,
    );
  });
});
