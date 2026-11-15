import { GestionDashboardService } from "./gestion-dashboard.service";

describe("GestionDashboardService", () => {
  const kpi = (total: number, tickets: number) => [
    {
      total,
      base: total / 1.1,
      tickets,
      voided_total: 5,
      invited_units: 2,
      missing: 0,
    },
  ];

  it("calcula ticket medio, variaciones y alinea la serie de comparación", async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce(kpi(1100, 10)) // kpis actuales
      .mockResolvedValueOnce(kpi(1000, 8)) // kpis comparación
      .mockResolvedValueOnce([{ key: "2026-10-01", total: 1100, tickets: 10 }])
      .mockResolvedValueOnce([{ key: "2025-10-02", total: 1000, tickets: 8 }])
      .mockResolvedValueOnce([
        { key: "P-1", name: "Entrecot", units: 4, total: 100 },
      ])
      .mockResolvedValueOnce([
        { family: "CARNES", total: 75 },
        { family: null, total: 25 },
      ]);
    const service = new GestionDashboardService({ $queryRaw: queryRaw } as any);

    const res = await service.build(
      "t1",
      { from: "2026-10-01", to: "2026-10-31" },
      "year",
    );

    expect(res.kpis.avgTicket).toBe(110);
    expect(res.compareKpis.avgTicket).toBe(125);
    expect(res.deltas.total).toBe(10);
    expect(res.deltas.tickets).toBe(25);
    expect(res.compare.range).toEqual({ from: "2025-10-02", to: "2025-11-01" });
    expect(res.compareSeries[0].alignedKey).toBe("2026-10-01");
    expect(res.families).toEqual([
      { family: "CARNES", total: 75, share: 75 },
      { family: "Sin familia", total: 25, share: 25 },
    ]);
  });
});
