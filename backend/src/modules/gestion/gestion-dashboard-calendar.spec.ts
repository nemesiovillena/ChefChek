import { GestionDashboardService } from "./gestion-dashboard.service";

describe("GestionDashboardService.calendar", () => {
  it("mejores días en orden y media por día de la semana solo con días de venta", async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      { day: "2026-10-05", dow: 1, total: 100, tickets: 10 },
      { day: "2026-10-12", dow: 1, total: 300, tickets: 21 },
      { day: "2026-10-17", dow: 6, total: 300, tickets: 30 },
    ]);
    const service = new GestionDashboardService({ $queryRaw: queryRaw } as any);
    const r = await service.calendar(
      "t1",
      { from: "2026-10-01", to: "2026-10-31" },
      2,
    );
    // Empate a 300 €: primero la fecha más antigua.
    expect(r.topDays.map((d) => d.date)).toEqual(["2026-10-12", "2026-10-17"]);
    expect(r.byWeekday[0]).toEqual({
      weekday: "lunes",
      daysWithSales: 2,
      avgTotal: 200,
      avgTickets: 15.5,
    });
    expect(r.byWeekday[6]).toEqual({
      weekday: "domingo",
      daysWithSales: 0,
      avgTotal: 0,
      avgTickets: 0,
    });
  });
});
