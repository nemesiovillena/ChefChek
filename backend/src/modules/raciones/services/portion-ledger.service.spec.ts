import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { NotificationsService } from "../../core/notifications.service";
import { ModulesService } from "../../modules/modules.service";
import { PortionLedgerService } from "./portion-ledger.service";
import { PortionSettingsService } from "./portion-settings.service";

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
    pushes: [] as any[],
    config: null as any,
    settings: [] as { key: string; value: string }[],
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
      findFirst: jest.fn(async ({ where }: any) => {
        const types = where.type?.in ?? [where.type];
        const hits = db.movements.filter(
          (m) =>
            m.counterId === where.counterId &&
            m.quantity > 0 &&
            types.includes(m.type) &&
            (where.cuinerRegistroId?.not !== null ||
              (m.cuinerRegistroId !== null &&
                m.cuinerRegistroId !== undefined)),
        );
        return hits.length
          ? { ...hits[hits.length - 1], createdAt: new Date() }
          : null;
      }),
    },
    portionCounterDish: {
      findMany: jest.fn(async ({ where }: any = {}) =>
        where?.counterId
          ? db.dishes.filter((d) => d.counterId === where.counterId)
          : db.dishes,
      ),
      count: jest.fn(
        async ({ where }: any) =>
          db.dishes.filter(
            (d) =>
              d.counterId === where.counterId &&
              d.tipo === where.tipo &&
              !!d.perPiece === where.perPiece,
          ).length,
      ),
    },
    configuration: {
      findMany: jest.fn(async () => db.settings),
    },
    cuinerConfig: {
      findUnique: jest.fn(async () => db.config),
      update: jest.fn(async ({ data }: any) => Object.assign(db.config, data)),
    },
    portionCuinerPush: {
      create: jest.fn(async ({ data }: any) => {
        db.pushes.push(data);
        return data;
      }),
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
      new PortionSettingsService(prisma as PrismaService),
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

    it("un plato vendido al peso resta una pieza por venta, no los kilos", async () => {
      db.dishes[0].perPiece = true;
      db.labels.push(label("a", 1, 4));
      db.saleLines.push({
        id: "chuleton",
        tipo: "P",
        producto: "00403",
        unidades: 0.88,
        createdAt: new Date(),
      });
      await ledger.applySales(T);
      expect(db.labels[0].portionsRemaining).toBe(3);
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

  describe("Contador de platos de Cuiner en vivo", () => {
    const dish = (over: Partial<any> = {}) => ({
      tenantId: T,
      counterId: "pc1",
      tipo: "P",
      producto: "00745",
      portionsPerSale: 1,
      perPiece: false,
      createdAt: new Date(Date.now() - 3_600_000),
      ...over,
    });
    const row = (
      id: number,
      operacion: string,
      unidades: number,
      over = {},
    ) => ({
      id,
      plato: "00745",
      operacion,
      unidades,
      cajero: "TPV1",
      mesa: "4",
      ...over,
    });

    beforeEach(() => {
      db.counters.push(counter({ minPortions: 0, unlabeledPortions: 5 }));
      db.dishes.push(dish());
      db.config = { enabled: true, portionCursor: 100 };
    });

    it("descuenta al pedir, devuelve al anular y suma lo cargado en Cuiner", async () => {
      const res = await ledger.applyCuinerRegistro(T, 100, 104, [
        row(101, "Salida", 2),
        row(102, "Borrado", -1),
        row(103, "Stock", 4, { cajero: "KDS:Cocina", mesa: null }),
        row(104, "Salida", 1, { plato: "99999" }),
      ]);
      expect(res).toEqual({ applied: 3, cursor: 104 });
      expect(db.counters[0].unlabeledPortions).toBe(8);
      expect(db.config.portionCursor).toBe(104);
      expect(db.movements.map((m) => [m.type, m.quantity])).toEqual([
        ["ORDER", -2],
        ["ORDER", 1],
        ["CUINER_LOAD", 4],
      ]);
      expect(db.movements[0]).toMatchObject({
        cuinerRegistroId: 101,
        reason: "Pedido en Cuiner · mesa 4 · TPV1",
      });
      // Lo que viene de Cuiner no se devuelve a Cuiner.
      expect(db.pushes).toHaveLength(0);
    });

    it("no repite un lote que no empieza donde quedó el anterior", async () => {
      const res = await ledger.applyCuinerRegistro(T, 90, 101, [
        row(101, "Salida", 1),
      ]);
      expect(res).toEqual({ applied: 0, cursor: 100 });
      expect(db.movements).toHaveLength(0);
    });

    it("ignora lo que escribió ChefChek; en platos por piezas cuenta piezas", async () => {
      db.dishes[0].perPiece = true;
      await ledger.applyCuinerRegistro(T, 100, 103, [
        row(101, "Stock", 3, { cajero: "ChefChek" }),
        row(102, "Stock", 19, { cajero: "KDS:Cocina" }),
        row(103, "Salida", 0.85),
      ]);
      expect(db.movements.map((m) => [m.type, m.quantity])).toEqual([
        ["CUINER_LOAD", 19],
        ["ORDER", -1],
      ]);
    });

    it("lo que cambia en ChefChek queda pendiente de escribir en Cuiner", async () => {
      await ledger.recount(T, "pc1", 9, undefined, { id: "u1" });
      await ledger.adjust(T, "pc1", -2, "Se quemó", { id: "u1" });
      expect(db.pushes.map((p) => [p.quantity, p.reason])).toEqual([
        [4, "RECOUNT"],
        [-2, "ADJUST"],
      ]);
    });

    it("sin enlace en vivo no encola nada", async () => {
      db.config.portionCursor = null;
      await ledger.adjust(T, "pc1", 1, "x", { id: "u1" });
      expect(db.pushes).toHaveLength(0);
    });

    it("un plato por piezas se carga solo en el TPV: ni etiqueta ni recuento", async () => {
      db.dishes[0].perPiece = true;
      await expect(
        ledger.counterForNewLabel(T, { productId: "p1" }, undefined),
      ).resolves.toBeNull();
      await expect(
        ledger.recount(T, "pc1", 9, undefined, { id: "u1" }),
      ).rejects.toThrow("se carga en el Contador de platos de Cuiner");
      expect(db.pushes).toHaveLength(0);
    });

    it("«En el TPV»: la etiqueta no suma y no se puede ajustar", async () => {
      db.settings.push({ key: "RACIONES_LOAD_SOURCE", value: "TPV" });
      await expect(
        ledger.counterForNewLabel(T, { productId: "p1" }, 4),
      ).resolves.toBeNull();
      await expect(
        ledger.adjust(T, "pc1", 2, "x", { id: "u1" }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("«Solo en ChefChek»: las cargas del TPV no cuentan, los pedidos sí", async () => {
      db.settings.push({ key: "RACIONES_LOAD_SOURCE", value: "CHEFCHEK" });
      await ledger.applyCuinerRegistro(T, 100, 102, [
        row(101, "Stock", 4, { cajero: "KDS:Cocina" }),
        row(102, "Salida", 1),
      ]);
      expect(db.movements.map((m) => [m.type, m.quantity])).toEqual([
        ["ORDER", -1],
      ]);
      await ledger.adjust(T, "pc1", 1, "x", { id: "u1" });
      expect(db.pushes).toHaveLength(0);
    });

    it("«En los dos»: carga en ChefChek y en Cuiner seguidas → aviso de carga doble", async () => {
      await ledger.recount(T, "pc1", 15, undefined, { id: "u1", name: "Ana" });
      await ledger.applyCuinerRegistro(T, 100, 101, [
        row(101, "Stock", 10, { cajero: "KDS:Cocina", mesa: null }),
      ]);
      const titles = notifications.createNotification.mock.calls.map(
        (c: any[]) => c[1].title,
      );
      expect(titles).toContain("¿Carga doble? Solomillo");
    });

    it("con enlace en vivo, lo cobrado no vuelve a descontar", async () => {
      db.saleLines.push({
        id: "s1",
        tipo: "P",
        producto: "00745",
        unidades: 1,
        createdAt: new Date(),
      });
      await expect(ledger.applySales(T)).resolves.toBe(0);
      expect(db.counters[0].unlabeledPortions).toBe(5);
    });
  });
});
