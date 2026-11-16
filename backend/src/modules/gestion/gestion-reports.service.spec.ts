import { BadRequestException } from "@nestjs/common";
import { GestionReportsService } from "./gestion-reports.service";

describe("GestionReportsService", () => {
  it("rechaza un informe desconocido o sin fechas", async () => {
    const service = new GestionReportsService({ $queryRaw: jest.fn() } as any);
    await expect(service.build("t1", "nada", {})).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.build("t1", "ranking", {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it("ranking: posición, familia legible y % sobre las ventas del periodo", async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([
        {
          name: "Entrecot",
          family: "CARNES-VACUNO",
          units: 3,
          base: 60,
          total: 66,
        },
        { name: "Agua", family: null, units: 10, base: 30, total: 33 },
      ])
      .mockResolvedValueOnce([{ sum: 132 }]);
    const service = new GestionReportsService({ $queryRaw: queryRaw } as any);
    const table = await service.build("t1", "ranking", {
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(table.rows[0]).toMatchObject({
      pos: 1,
      family: "CARNES › VACUNO",
      share: 50,
    });
    expect(table.rows[1]).toMatchObject({ family: "Sin familia", share: 25 });
  });

  it("interanual del año en curso: meses futuros sin variación y total hasta el mes actual", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-03-15T12:00:00Z"));
    const queryRaw = jest.fn().mockResolvedValueOnce([
      { y: 2025, m: 1, total: 100 },
      { y: 2025, m: 6, total: 500 },
      { y: 2026, m: 1, total: 110 },
    ]);
    const service = new GestionReportsService({ $queryRaw: queryRaw } as any);
    const table = await service.build("t1", "interanual", {
      year: 2026,
      years: 2,
    });
    expect(table.rows[5].delta).toBeNull(); // junio 2026 aún no ha llegado
    expect(table.totals?.delta).toBe(10); // ene–mar: 110 vs 100
    expect(table.notes[0]).toContain("mar");
    jest.useRealTimers();
  });

  it("interanual: una columna por año, total y variación del último", async () => {
    const queryRaw = jest.fn().mockResolvedValueOnce([
      { y: 2025, m: 1, total: 100 },
      { y: 2026, m: 1, total: 120 },
    ]);
    const service = new GestionReportsService({ $queryRaw: queryRaw } as any);
    const table = await service.build("t1", "interanual", {
      year: 2026,
      years: 2,
    });
    expect(table.columns.map((c) => c.key)).toEqual([
      "month",
      "y2025",
      "y2026",
      "delta",
    ]);
    expect(table.rows[0]).toMatchObject({ y2025: 100, y2026: 120, delta: 20 });
    expect(table.rows[1].delta).toBeNull();
    expect(table.totals).toMatchObject({ y2025: 100, y2026: 120, delta: 20 });
  });
});
