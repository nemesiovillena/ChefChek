import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { NotificationsService } from "../../core/notifications.service";
import { ModulesService } from "../../modules/modules.service";
import { PortionLedgerService } from "./portion-ledger.service";

/**
 * Prisma en memoria mínimo: lo justo para el reparto FIFO, las ventas y los
 * avisos. `$transaction` pasa el propio fake como tx.
 */
function makeDb() {
  const db = {
    counters: [] as any[],
    labels: [] as any[],
    movements: [] as any[],
    dishes: [] as any[],
    saleLines: [] as any[],
  };
  const matchLabel = (l: any, where: any) =>
    (where.portionCounterId === undefined ||
      l.portionCounterId === where.portionCounterId) &&
    (where.voidedAt === undefined || l.voidedAt === where.voidedAt) &&
    (where.retiredAt === undefined || l.retiredAt === where.retiredAt) &&
    (where.portionsRemaining?.gt === undefined ||
      (l.portionsRemaining ?? 0) > where.portionsRemaining.gt);
  const applyNum = (target: any, field: string, v: any) => {
    if (v && typeof v === "object") {
      if ("increment" in v) {
        target[field] += v.increment;
      }
      if ("decrement" in v) {
        target[field] -= v.decrement;
      }
    } else if (v !== undefined) {
      target[field] = v;
    }
  };

  const prisma: any = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn((fn: any) => fn(prisma)),
    portionCounter: {
      findFirst: jest.fn(
        async ({ where }: any) =>
          db.counters.find(
            (c) =>
              (!where.id || c.id === where.id) &&
              (!where.tenantId || c.tenantId === where.tenantId) &&
              (where.active === undefined || c.active === where.active) &&
              (!where.recipeId || c.recipeId === where.recipeId) &&
              (!where.productId || c.productId === where.productId),
          ) ?? null,
      ),
      findUniqueOrThrow: jest.fn(async ({ where }: any) =>
        db.counters.find((c) => c.id === where.id),
      ),
      update: jest.fn(async ({ where, data }: any) => {
        const c = db.counters.find((x) => x.id === where.id);
        for (const [k, v] of Object.entries(data)) {
          applyNum(c, k, v);
        }
        return c;
      }),
    },
    foodLabel: {
      findMany: jest.fn(async ({ where, orderBy }: any) => {
        const rows = db.labels.filter((l) => matchLabel(l, where));
        const asc = orderBy?.[0]?.preparedAt !== "desc";
        return rows.sort((a, b) =>
          asc ? a.preparedAt - b.preparedAt : b.preparedAt - a.preparedAt,
        );
      }),
      findFirst: jest.fn(async (args: any) => {
        const rows = await prisma.foodLabel.findMany(args);
        return rows[0] ?? null;
      }),
      aggregate: jest.fn(async ({ where }: any) => ({
        _sum: {
          portionsRemaining: db.labels
            .filter((l) => matchLabel(l, where))
            .reduce((s, l) => s + (l.portionsRemaining ?? 0), 0),
        },
      })),
      update: jest.fn(async ({ where, data }: any) => {
        const l = db.labels.find((x) => x.id === where.id);
        for (const [k, v] of Object.entries(data)) {
          applyNum(l, k, v);
        }
        return l;
      }),
    },
    portionMovement: {
      create: jest.fn(async ({ data }: any) => {
        db.movements.push(data);
        return data;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        db.movements.filter((m) =>
          where.cuinerSaleLineId?.in.includes(m.cuinerSaleLineId),
        ),
      ),
    },
    portionCounterDish: {
      findMany: jest.fn(async () => db.dishes),
    },
    cuinerSaleLine: {
      findMany: jest.fn(async () => db.saleLines),
    },
  };
  return { db, prisma };
}

describe("PortionLedgerService", () => {
  const T = "t1";
  let db: ReturnType<typeof makeDb>["db"];
  let prisma: any;
  let modules: { isModuleEnabled: jest.Mock };
  let notifications: { createNotification: jest.Mock };
  let ledger: PortionLedgerService;

  const counter = (over: Partial<any> = {}) => ({
    id: "pc1",
    tenantId: T,
    name: "Solomillo",
    recipeId: null,
    productId: "p1",
    minPortions: 2,
    unlabeledPortions: 0,
    belowMinNotifiedAt: null,
    outNotifiedAt: null,
    active: true,
    ...over,
  });
  const label = (id: string, day: number, remaining: number) => ({
    id,
    portionCounterId: "pc1",
    portionsRemaining: remaining,
    voidedAt: null,
    retiredAt: null,
    preparedAt: new Date(2026, 10, day).getTime(),
  });

  beforeEach(() => {
    ({ db, prisma } = makeDb());
    modules = { isModuleEnabled: jest.fn().mockResolvedValue(true) };
    notifications = { createNotification: jest.fn() };
    ledger = new PortionLedgerService(
      prisma as PrismaService,
      modules as unknown as ModulesService,
      notifications as unknown as NotificationsService,
    );
  });

  describe("counterForNewLabel", () => {
    it("exige raciones si el artículo tiene contador", async () => {
      db.counters.push(counter());
      await expect(
        ledger.counterForNewLabel(T, { productId: "p1" }, undefined),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        ledger.counterForNewLabel(T, { productId: "p1" }, 6),
      ).resolves.toBe("pc1");
    });

    it("no cuenta si el módulo está desactivado o no hay contador", async () => {
      db.counters.push(counter());
      await expect(
        ledger.counterForNewLabel(T, { productId: "otro" }, 3),
      ).resolves.toBeNull();
      modules.isModuleEnabled.mockResolvedValue(false);
      await expect(
        ledger.counterForNewLabel(T, { productId: "p1" }, undefined),
      ).resolves.toBeNull();
    });
  });

  describe("ajustes y recuento", () => {
    it("un ajuste negativo gasta primero lo contado a mano y luego la etiqueta más antigua", async () => {
      db.counters.push(counter({ unlabeledPortions: 1 }));
      db.labels.push(label("nueva", 5, 4), label("vieja", 1, 2));
      await ledger.adjust(T, "pc1", -2, "Se cayó al suelo", { id: "u1" });
      expect(db.counters[0].unlabeledPortions).toBe(0);
      expect(db.labels.find((l) => l.id === "vieja").portionsRemaining).toBe(1);
      expect(db.labels.find((l) => l.id === "nueva").portionsRemaining).toBe(4);
      expect(db.movements.map((m) => m.quantity)).toEqual([-1, -1]);
    });

    it("rechaza un ajuste negativo mayor que lo disponible (para eso está el recuento)", async () => {
      db.counters.push(counter());
      db.labels.push(label("a", 1, 2));
      await expect(
        ledger.adjust(T, "pc1", -3, "error", { id: "u1" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.movements).toHaveLength(0);
    });

    it("el recuento al alza entra como raciones sin etiqueta y deja traza", async () => {
      db.counters.push(counter());
      db.labels.push(label("a", 1, 3));
      await ledger.recount(T, "pc1", 7, undefined, { id: "u1", name: "Ana" });
      expect(db.counters[0].unlabeledPortions).toBe(4);
      expect(db.movements[0]).toMatchObject({
        type: "RECOUNT",
        quantity: 4,
        reason: "Recuento: 3 → 7",
        userName: "Ana",
      });
    });
  });

  describe("applySales", () => {
    beforeEach(() => {
      db.counters.push(counter({ minPortions: 3 }));
      db.dishes.push({
        tenantId: T,
        counterId: "pc1",
        tipo: "P",
        producto: "00403",
        portionsPerSale: 1,
        createdAt: new Date(Date.now() - 3_600_000),
      });
    });

    it("descuenta FIFO, marca el faltante y avisa una sola vez", async () => {
      db.labels.push(label("a", 1, 2));
      db.saleLines.push({
        id: "s1",
        tipo: "P",
        producto: "00403",
        unidades: 3,
        createdAt: new Date(),
      });
      await expect(ledger.applySales(T)).resolves.toBe(1);
      expect(db.labels[0].portionsRemaining).toBe(0);
      expect(db.movements).toEqual([
        expect.objectContaining({
          type: "SALE",
          quantity: -2,
          foodLabelId: "a",
        }),
        expect.objectContaining({ quantity: -1, shortfall: true }),
      ]);
      expect(notifications.createNotification).toHaveBeenCalledTimes(1);
      expect(notifications.createNotification.mock.calls[0][1]).toMatchObject({
        type: "PORTIONS_OUT",
      });

      // Reenvío del conector: misma línea, no vuelve a descontar ni avisar.
      await expect(ledger.applySales(T)).resolves.toBe(0);
      expect(db.movements).toHaveLength(2);
      expect(notifications.createNotification).toHaveBeenCalledTimes(1);
    });

    it("ignora ventas recibidas antes de enlazar el plato", async () => {
      db.labels.push(label("a", 1, 5));
      db.saleLines.push({
        id: "vieja",
        tipo: "P",
        producto: "00403",
        unidades: 1,
        createdAt: new Date(Date.now() - 7_200_000),
      });
      await expect(ledger.applySales(T)).resolves.toBe(0);
      expect(db.labels[0].portionsRemaining).toBe(5);
    });

    it("una devolución (unidades negativas) vuelve a la etiqueta más reciente", async () => {
      db.labels.push(label("vieja", 1, 1), label("nueva", 3, 1));
      db.saleLines.push({
        id: "s2",
        tipo: "P",
        producto: "00403",
        unidades: -1,
        createdAt: new Date(),
      });
      await ledger.applySales(T);
      expect(db.labels.find((l) => l.id === "nueva").portionsRemaining).toBe(2);
    });

    it("con el módulo desactivado no hace nada", async () => {
      modules.isModuleEnabled.mockResolvedValue(false);
      db.saleLines.push({
        id: "s3",
        tipo: "P",
        producto: "00403",
        unidades: 1,
        createdAt: new Date(),
      });
      await expect(ledger.applySales(T)).resolves.toBe(0);
      expect(db.movements).toHaveLength(0);
    });
  });
});
