import { GestionTicketReportsService } from "./gestion-ticket-reports.service";

const tickets = [
  {
    id: 1,
    day: "2026-10-12",
    total: 60,
    comensales: 2,
    turno: "COMIDAS",
    openedAt: "14:03",
    camarero: "PEDRO SANCHEZ",
  },
  {
    id: 2,
    day: "2026-10-12",
    total: 40,
    comensales: 0,
    turno: "COMIDAS",
    openedAt: "14:40",
    camarero: "Camarero 3",
  },
  {
    id: 3,
    day: "2026-10-12",
    total: 100,
    comensales: 4,
    turno: "COMIDAS",
    openedAt: "21:10",
    camarero: "PEDRO SANCHEZ",
  },
  {
    id: 4,
    day: "2026-10-12",
    total: 50,
    comensales: 2,
    turno: "COMIDAS",
    openedAt: "01:15",
    camarero: "Camarero 3",
  },
];

function make(payments: unknown[] = []) {
  const queryRaw = jest
    .fn()
    .mockResolvedValueOnce(tickets)
    .mockResolvedValueOnce(payments);
  return new GestionTicketReportsService({ $queryRaw: queryRaw } as any);
}

describe("GestionTicketReportsService", () => {
  const range = { from: "2026-10-12", to: "2026-10-12" };

  it("caja diaria: comensales, gasto por comensal sin barra, comidas/cenas y formas de pago", async () => {
    const t = await make([
      { day: "2026-10-12", forma: "TARJETA", importe: 160 },
      { day: "2026-10-12", forma: "EFECTIVO", importe: 40 },
    ]).build("t1", "caja-diaria", range);
    expect(t.columns.map((c) => c.key)).toEqual([
      "day",
      "tickets",
      "diners",
      "perDiner",
      "lunch",
      "dinner",
      "total",
      "pay_EFECTIVO",
      "pay_TARJETA",
    ]);
    // Gasto por comensal: (60 + 100) / 6; el ticket de barra sin comensales no cuenta.
    expect(t.rows[0]).toMatchObject({
      // 21:10 y 01:15 son cenas aunque el TPV diga COMIDAS.
      tickets: 4,
      diners: 8,
      perDiner: 26.25,
      lunch: 100,
      dinner: 150,
      total: 250,
      pay_TARJETA: 160,
      pay_EFECTIVO: 40,
    });
  });

  it("franjas horarias por hora de apertura y día de la semana", async () => {
    const t = await make().build("t1", "franjas-horarias", range);
    // La madrugada va al final.
    expect(t.rows.map((r) => r.hour)).toEqual([
      "14:00–14:59",
      "21:00–21:59",
      "01:00–01:59",
    ]);
    // 12/10/2026 es lunes (columna d0).
    expect(t.rows[0]).toMatchObject({ d0: 100, tickets: 2, total: 100 });
  });

  it("camareros ordenados por ventas", async () => {
    const t = await make().build("t1", "camareros", range);
    expect(t.rows[0]).toMatchObject({
      name: "PEDRO SANCHEZ",
      tickets: 2,
      diners: 6,
      total: 160,
      avgTicket: 80,
    });
  });

  it("sin cabeceras avisa de que llegan con el conector nuevo", async () => {
    const service = new GestionTicketReportsService({
      $queryRaw: jest.fn().mockResolvedValue([]),
    } as any);
    const t = await service.build("t1", "camareros", range);
    expect(t.notes[0]).toContain("conector");
  });
});
