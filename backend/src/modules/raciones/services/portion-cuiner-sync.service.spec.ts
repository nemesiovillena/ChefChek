import { PrismaService } from "../../../common/services/prisma.service";
import { NotificationsService } from "../../core/notifications.service";
import { PortionCuinerSyncService } from "./portion-cuiner-sync.service";
import { PortionLedgerService } from "./portion-ledger.service";

describe("PortionCuinerSyncService", () => {
  const T = "t1";
  let counter: any;
  let pushes: any[];
  let config: any;
  let available: number;
  let prisma: any;
  let ledger: any;
  let notifications: { createNotification: jest.Mock };
  let sync: PortionCuinerSyncService;

  beforeEach(() => {
    counter = {
      id: "pc1",
      name: "Solomillo",
      cuinerMismatchNotifiedAt: null,
      dishes: [{ producto: "00745", perPiece: false }],
    };
    pushes = [];
    config = { portionCursor: 100 };
    available = 12;
    prisma = {
      cuinerConfig: {
        findUnique: jest.fn(async () => config),
        updateMany: jest.fn(async ({ data }: any) => {
          if (config.portionCursor === null) {
            Object.assign(config, data);
          }
          return { count: 1 };
        }),
      },
      portionCounter: {
        findMany: jest.fn(async () => [counter]),
        findFirst: jest.fn(async () => counter),
        update: jest.fn(async ({ data }: any) => Object.assign(counter, data)),
      },
      portionCuinerPush: {
        groupBy: jest.fn(async () => {
          const pending = pushes.filter((p) => !p.sentAt && !p.error);
          return pending.length
            ? [
                {
                  counterId: "pc1",
                  _sum: {
                    quantity: pending.reduce((t, p) => t + p.quantity, 0),
                  },
                },
              ]
            : [];
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const hit = pushes.filter(
            (p) =>
              where.id.in.includes(p.id) &&
              !p.sentAt &&
              (where.error !== null || !p.error),
          );
          hit.forEach((p) => Object.assign(p, data));
          return { count: hit.length };
        }),
      },
    };
    ledger = {
      isEnabled: jest.fn().mockResolvedValue(true),
      available: jest.fn(async () => available),
      applyCuinerRegistro: jest.fn(async (_t, _from, to) => {
        config.portionCursor = to;
        return { applied: 0, cursor: to };
      }),
    };
    notifications = { createNotification: jest.fn() };
    sync = new PortionCuinerSyncService(
      prisma as PrismaService,
      ledger as unknown as PortionLedgerService,
      notifications as unknown as NotificationsService,
    );
  });

  const snapshot = (quedan: number) => ({
    cursorFrom: 100,
    cursorTo: 100,
    rows: [],
    snapshot: [{ plato: "00745", quedan }],
    complete: true,
  });

  it("si cuadra, guarda lo que marca Cuiner y no avisa", async () => {
    await sync.ingest(T, snapshot(12));
    expect(counter.cuinerAvailable).toBe(12);
    expect(counter.cuinerMismatchNotifiedAt).toBeNull();
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });

  it("si no cuadra avisa una vez, y se rearma al volver a cuadrar", async () => {
    await sync.ingest(T, snapshot(10));
    await sync.ingest(T, snapshot(10));
    expect(notifications.createNotification).toHaveBeenCalledTimes(1);
    expect(notifications.createNotification.mock.calls[0][1]).toMatchObject({
      type: "PORTIONS_MISMATCH",
      title: "No cuadra con Cuiner: Solomillo",
    });
    expect(counter.cuinerMismatchNotifiedAt).toBeInstanceOf(Date);

    await sync.ingest(T, snapshot(12));
    expect(counter.cuinerMismatchNotifiedAt).toBeNull();
  });

  it("lo pendiente de escribir en Cuiner no cuenta como descuadre", async () => {
    pushes.push({ id: "x1", quantity: 4, sentAt: null, error: null });
    available = 16;
    await sync.ingest(T, snapshot(12));
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });

  it("una carga que Cuiner no aceptó avisa y deja el descuadre a la vista", async () => {
    pushes.push({ id: "x1", quantity: 4, sentAt: null, error: null });
    available = 16;
    await sync.ingest(T, {
      ...snapshot(12),
      pushResults: [
        {
          counterId: "pc1",
          ids: ["x1"],
          ok: false,
          error: "Sin contador en Cuiner.",
        },
      ],
    });
    const titles = notifications.createNotification.mock.calls.map(
      (c) => c[1].title,
    );
    expect(titles).toEqual([
      "No se pudo cargar en Cuiner: Solomillo",
      "No cuadra con Cuiner: Solomillo",
    ]);
  });

  it("no compara con una foto que va por delante del historial", async () => {
    await sync.ingest(T, { ...snapshot(3), complete: false });
    expect(prisma.portionCounter.update).not.toHaveBeenCalled();
  });

  it("el primer enlace fija el punto de partida sin repasar el pasado", async () => {
    config.portionCursor = null;
    const res = await sync.ingest(T, { baseline: 43040 });
    expect(res).toEqual({ cursor: 43040 });
    expect(ledger.applyCuinerRegistro).not.toHaveBeenCalled();
  });
});
