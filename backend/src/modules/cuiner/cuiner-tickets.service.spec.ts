import { CuinerTicketsService } from "./cuiner-tickets.service";

function makeTx() {
  return {
    $executeRaw: jest.fn().mockResolvedValue(1),
    cuinerTicketPayment: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    cuinerConfig: { update: jest.fn().mockResolvedValue({}) },
    cuinerWaiter: { upsert: jest.fn().mockResolvedValue({}) },
  };
}

describe("CuinerTicketsService.ingest", () => {
  it("guarda cabeceras, reemplaza los cobros de esos tickets y avanza el cursor", async () => {
    const tx = makeTx();
    const prisma = { $transaction: jest.fn((fn: any) => fn(tx)) };
    const service = new CuinerTicketsService(prisma as any);
    const result = await service.ingest("t1", {
      cursor: 3342386,
      tickets: [
        {
          idVentasCab: 3342384,
          fecha: "2026-10-12",
          mesa: "8",
          comensales: 2,
          turno: "COMIDAS",
          openedAt: "14:03",
          closedAt: "15:44",
          camarero: "10",
          total: 66.1,
          invitacion: false,
          consumoPersonal: false,
        },
        {
          idVentasCab: 3342386,
          fecha: "2026-10-12",
          invitacion: false,
          consumoPersonal: false,
        },
      ],
      payments: [
        {
          idVentasCab: 3342384,
          linea: 0,
          formaPago: "TARJETA",
          importe: 66.1,
          anulada: false,
        },
        {
          idVentasCab: 3342386,
          linea: 0,
          formaPago: " ",
          importe: 101.3,
          anulada: false,
        },
      ],
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.cuinerTicketPayment.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", idVentasCab: { in: [3342384, 3342386] } },
    });
    const data = tx.cuinerTicketPayment.createMany.mock.calls[0][0].data;
    expect(data[1].formaPago).toBe("EFECTIVO");
    expect(tx.cuinerConfig.update).toHaveBeenCalledWith({
      where: { tenantId: "t1" },
      data: { ticketCursor: 3342386 },
    });
    expect(result).toEqual({ ticketCursor: 3342386, tickets: 2, payments: 2 });
  });

  it("un lote vacío (tickets de otros centros) solo avanza el cursor", async () => {
    const tx = makeTx();
    const service = new CuinerTicketsService({
      $transaction: jest.fn((fn: any) => fn(tx)),
    } as any);
    await service.ingest("t1", { cursor: 10, tickets: [], payments: [] });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.cuinerTicketPayment.deleteMany).not.toHaveBeenCalled();
    expect(tx.cuinerConfig.update).toHaveBeenCalled();
  });

  it("un id repetido en el lote se guarda una vez (gana el último)", async () => {
    const tx = makeTx();
    const service = new CuinerTicketsService({
      $transaction: jest.fn((fn: any) => fn(tx)),
    } as any);
    const res = await service.ingest("t1", {
      cursor: 5,
      tickets: [
        {
          idVentasCab: 5,
          fecha: "2026-10-12",
          comensales: 2,
          invitacion: false,
          consumoPersonal: false,
        },
        {
          idVentasCab: 5,
          fecha: "2026-10-12",
          comensales: 3,
          invitacion: false,
          consumoPersonal: false,
        },
      ],
      payments: [
        {
          idVentasCab: 5,
          linea: 0,
          formaPago: "TARJETA",
          importe: 10,
          anulada: false,
        },
        {
          idVentasCab: 5,
          linea: 0,
          formaPago: "TARJETA",
          importe: 12,
          anulada: false,
        },
      ],
    });
    expect(res).toMatchObject({ tickets: 1, payments: 1 });
    expect(
      tx.cuinerTicketPayment.createMany.mock.calls[0][0].data[0].importe,
    ).toBe(12);
  });

  it("guarda los camareros con el código sin ceros a la izquierda", async () => {
    const tx = makeTx();
    const service = new CuinerTicketsService({
      $transaction: jest.fn((fn: any) => fn(tx)),
    } as any);
    await service.ingest("t1", {
      cursor: 1,
      tickets: [],
      payments: [],
      waiters: [{ code: "010", name: "PEDRO SANCHEZ ", active: true }],
    });
    expect(tx.cuinerWaiter.upsert).toHaveBeenCalledWith({
      where: { tenantId_code: { tenantId: "t1", code: "10" } },
      update: { name: "PEDRO SANCHEZ", active: true },
      create: {
        tenantId: "t1",
        code: "10",
        name: "PEDRO SANCHEZ",
        active: true,
      },
    });
  });
});
