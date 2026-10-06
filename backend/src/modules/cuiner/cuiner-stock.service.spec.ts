import { ConflictException } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { CuinerStockService } from "./cuiner-stock.service";

const line = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  tenantId: "t1",
  idVentasCab: 100,
  linea: Number(id.replace(/\D/g, "")) || 0,
  fecha: new Date("2026-10-04T00:00:00.000Z"),
  tipo: "P",
  producto: "00002",
  unidades: 2,
  anulada: false,
  status: "PENDIENTE",
  ...over,
});

function makePrisma(opts: {
  lines?: ReturnType<typeof line>[];
  warehouseId?: string | null;
  claimedCount?: number;
  existingStock?: boolean;
}) {
  const lines = opts.lines ?? [
    line("l1"), // hamburguesa ×2 → receta
    line("l2", { producto: "00099", unidades: 3 }), // agua ×3 → artículo directo
    line("l3", { producto: "00500", unidades: 1 }), // sin enlazar
    line("l4", { unidades: -1 }), // ticket de anulación de una hamburguesa
  ];
  const prisma = {
    cuinerConfig: {
      findUnique: jest.fn(async () => ({
        tenantId: "t1",
        warehouseId: opts.warehouseId === undefined ? "w1" : opts.warehouseId,
      })),
    },
    cuinerSaleLine: {
      count: jest.fn(async () => lines.length),
      findMany: jest.fn(async () => lines),
      updateMany: jest.fn(
        async (args: { where: { id?: { in: string[] } } }) => ({
          count:
            opts.claimedCount !== undefined && args.where.id
              ? opts.claimedCount
              : (args.where.id?.in.length ?? 0),
        }),
      ),
    },
    cuinerDishMap: {
      findMany: jest.fn(async () => [
        { tipo: "P", producto: "00002", recipeId: "burger", productId: null },
        { tipo: "P", producto: "00099", recipeId: null, productId: "agua" },
      ]),
    },
    cuinerDish: {
      findMany: jest.fn(async () => [
        { tipo: "P", producto: "00500", nombre: "TARTA DE QUESO" },
      ]),
    },
    recipe: {
      findMany: jest.fn(async () => [
        {
          id: "burger",
          name: "Hamburguesa",
          portions: 1,
          portionSize: 300,
          ingredients: [{ productId: "carne", quantity: 200, unit: "g" }],
          subRecipes: [],
        },
      ]),
    },
    product: {
      findMany: jest.fn(async () => [
        {
          id: "carne",
          name: "Carne picada",
          referenceUnit: "kilo",
          unitSize: 1,
          tracksInventory: true,
          purchaseFormat: "Kilo",
        },
        {
          id: "agua",
          name: "Agua 50 cl",
          referenceUnit: "unidad",
          unitSize: 24,
          tracksInventory: true,
          purchaseFormat: "Caja 24 ud",
        },
      ]),
    },
    stockMovement: {
      create: jest.fn(async (args: { data: object }) => ({
        id: `mov-${prisma.stockMovement.create.mock.calls.length}`,
        ...args.data,
      })),
    },
    stock: {
      findFirst: jest.fn(async () =>
        opts.existingStock === false ? null : { id: "s1" },
      ),
      update: jest.fn(async () => ({})),
      create: jest.fn(async () => ({})),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  return prisma;
}

const serviceWith = (prisma: ReturnType<typeof makePrisma>) =>
  new CuinerStockService(prisma as unknown as PrismaService);

describe("CuinerStockService.preview", () => {
  it("calcula el consumo neto por artículo y lista lo que falta enlazar", async () => {
    const preview = await serviceWith(makePrisma({})).preview("t1");
    expect(preview.linesToApply).toBe(3);
    expect(preview.linesUnmapped).toBe(1);
    // 2 hamburguesas − 1 anulada = 1 → 200 g de carne; 3 aguas de una caja de 24.
    expect(
      preview.consumption.map((c) => [
        c.productId,
        Math.round(c.formats * 1e4) / 1e4,
      ]),
    ).toEqual([
      ["carne", 0.2],
      ["agua", 0.125],
    ]);
    expect(preview.unmappedDishes).toEqual([
      { tipo: "P", producto: "00500", nombre: "TARTA DE QUESO", unidades: 1 },
    ]);
  });
});

describe("CuinerStockService.preview (avisos)", () => {
  it("avisa del artículo que se compra en caja de 24 pero cuenta la caja como 1", async () => {
    const prisma = makePrisma({ lines: [line("l2", { producto: "00099" })] });
    prisma.product.findMany.mockResolvedValueOnce([
      {
        id: "agua",
        name: "COCACOLA ZER VR35 C24.",
        referenceUnit: "unidad",
        unitSize: 1,
        tracksInventory: true,
        purchaseFormat: "Caja 24 u",
      },
    ]);
    const preview = await serviceWith(prisma).preview("t1");
    expect(preview.warnings).toEqual([
      "«COCACOLA ZER VR35 C24.» se compra en «Caja 24 u» pero cuenta ese formato como 1 unidad: revisa sus unidades por formato antes de aplicar",
    ]);
  });

  it("no avisa cuando las unidades por formato son correctas", async () => {
    const preview = await serviceWith(makePrisma({})).preview("t1");
    expect(preview.warnings).toEqual([]);
  });
});

describe("CuinerStockService.apply", () => {
  it("sin almacén elegido descuenta del stock general (sin almacén)", async () => {
    const prisma = makePrisma({ warehouseId: null, lines: [line("l1")] });
    await serviceWith(prisma).apply("t1");
    expect(prisma.stock.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "t1", productId: "carne", warehouseId: null },
    });
    expect(prisma.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ warehouseId: null }),
    });
  });

  it("descuenta un movimiento por artículo y marca las líneas", async () => {
    const prisma = makePrisma({});
    const result = await serviceWith(prisma).apply("t1");
    expect(result).toEqual({ applied: 3, unmapped: 1, movements: 2 });

    expect(prisma.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: "carne",
        warehouseId: "w1",
        type: "EXIT",
        quantity: 0.2,
        unit: "Kilo",
        reason: "Ventas Cuiner del 2026-10-04",
      }),
    });
    expect(prisma.stock.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: expect.objectContaining({ quantity: { increment: -0.2 } }),
    });
    // Reserva primero las líneas aplicables y deja las demás como SIN_MAPEO.
    expect(prisma.cuinerSaleLine.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: { in: ["l1", "l2", "l4"] },
        tenantId: "t1",
        status: "PENDIENTE",
      },
      data: { status: "APLICADA" },
    });
    expect(prisma.cuinerSaleLine.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: { in: ["l3"] }, tenantId: "t1", status: "PENDIENTE" },
      data: { status: "SIN_MAPEO" },
    });
  });

  it("una devolución neta (más anulaciones que ventas) suma stock", async () => {
    const prisma = makePrisma({ lines: [line("l1", { unidades: -2 })] });
    await serviceWith(prisma).apply("t1");
    expect(prisma.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "ENTRANCE", quantity: 0.4 }),
    });
  });

  it("crea el stock (puede quedar negativo) si el artículo no tenía", async () => {
    const prisma = makePrisma({ lines: [line("l1")], existingStock: false });
    await serviceWith(prisma).apply("t1");
    expect(prisma.stock.create).toHaveBeenCalledWith({
      data: {
        tenantId: "t1",
        productId: "carne",
        warehouseId: "w1",
        quantity: -0.4,
      },
    });
  });

  it("no aplica dos veces si otra sesión ya reservó las líneas", async () => {
    const prisma = makePrisma({ claimedCount: 1 });
    await expect(serviceWith(prisma).apply("t1")).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it("sin líneas pendientes no hace nada", async () => {
    const prisma = makePrisma({ lines: [] });
    expect(await serviceWith(prisma).apply("t1")).toEqual({
      applied: 0,
      unmapped: 0,
      movements: 0,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("CuinerStockService.requeueUnmapped", () => {
  it("devuelve a pendiente solo las líneas de platos ya enlazados", async () => {
    const prisma = makePrisma({});
    await serviceWith(prisma).requeueUnmapped("t1");
    expect(prisma.cuinerSaleLine.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: "t1",
        status: "SIN_MAPEO",
        OR: [
          { tipo: "P", producto: "00002" },
          { tipo: "P", producto: "00099" },
        ],
      },
      data: { status: "PENDIENTE" },
    });
  });
});
