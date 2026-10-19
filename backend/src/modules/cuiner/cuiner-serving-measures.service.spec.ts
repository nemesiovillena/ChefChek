import { BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { CuinerMappingService } from "./cuiner-mapping.service";
import {
  CuinerServingMeasuresService,
  DEFAULT_SERVING_MEASURES,
} from "./cuiner-serving-measures.service";

const unidad = {
  id: "m-ud",
  tenantId: "t1",
  name: "Unidad",
  quantity: 1,
  unit: "ud",
  keywords: [],
};
const cana = {
  id: "m-cana",
  tenantId: "t1",
  name: "Caña",
  quantity: 20,
  unit: "cl",
  keywords: ["CAÑA"],
};

function makePrisma(opts: { measureCount?: number; linked?: number } = {}) {
  return {
    servingMeasure: {
      count: jest.fn(async () => opts.measureCount ?? 1),
      createMany: jest.fn(async () => ({
        count: DEFAULT_SERVING_MEASURES.length,
      })),
      findMany: jest.fn(async () => [cana]),
      findFirst: jest.fn(
        async (args: { where: { id: string } }) =>
          ({ [cana.id]: cana, [unidad.id]: unidad })[args.where.id] ?? null,
      ),
      create: jest.fn(async (args: { data: object }) => ({
        id: "new",
        ...args.data,
      })),
      update: jest.fn(async (args: { data: object }) => ({
        ...cana,
        ...args.data,
      })),
      delete: jest.fn(async () => cana),
    },
    cuinerDishMap: {
      groupBy: jest.fn(async () => [
        { servingMeasureId: "m-cana", _count: { _all: 3 } },
      ]),
      count: jest.fn(async () => opts.linked ?? 0),
      findMany: jest.fn(async () => []),
      upsert: jest.fn(async (args: { create: object }) => args.create),
    },
    $transaction: jest.fn(async (ops: unknown[]) => ops),
    product: {
      findFirst: jest.fn(
        async (args: { where: { id: string } }) =>
          ({
            barril: {
              id: "barril",
              name: "Barril 30 L",
              referenceUnit: "litro",
            },
            lata: {
              id: "lata",
              name: "Coca-Cola lata",
              referenceUnit: "unidad",
            },
            vieira: {
              id: "vieira",
              name: "Vieira",
              referenceUnit: "kilo",
              avgUnitWeight: null,
            },
            zamburina: {
              id: "zamburina",
              name: "Zamburiña",
              referenceUnit: "kilo",
              avgUnitWeight: 0.04,
            },
          })[args.where.id] ?? null,
      ),
      findMany: jest.fn(async () => []),
    },
    recipe: { findFirst: jest.fn(async () => ({ id: "r1" })) },
    cuinerDish: { findUnique: jest.fn(async () => ({ id: "d1" })) },
  };
}

const services = (prisma: ReturnType<typeof makePrisma>) => {
  const measures = new CuinerServingMeasuresService(
    prisma as unknown as PrismaService,
  );
  const mapping = new CuinerMappingService(
    prisma as unknown as PrismaService,
    measures,
  );
  return { measures, mapping };
};

describe("CuinerServingMeasuresService", () => {
  it("la primera vez crea las medidas por defecto", async () => {
    const prisma = makePrisma({ measureCount: 0 });
    await services(prisma).measures.list("t1");
    expect(prisma.servingMeasure.createMany).toHaveBeenCalledTimes(1);
  });

  it("no vuelve a sembrar si el local ya tiene medidas", async () => {
    const prisma = makePrisma({ measureCount: 4 });
    const list = await services(prisma).measures.list("t1");
    expect(prisma.servingMeasure.createMany).not.toHaveBeenCalled();
    expect(list[0].linkedDishes).toBe(3);
  });

  it("normaliza las palabras clave y rechaza unidades desconocidas", async () => {
    const prisma = makePrisma();
    const { measures } = services(prisma);
    await measures.create("t1", {
      name: " Chupito ",
      quantity: 4,
      unit: "CL",
      keywords: ["chupito", " chup ", "CHUPITO", ""],
    });
    expect(prisma.servingMeasure.create).toHaveBeenCalledWith({
      data: {
        tenantId: "t1",
        name: "Chupito",
        quantity: 4,
        unit: "cl",
        keywords: ["CHUPITO", "CHUP"],
      },
    });
    await expect(
      measures.create("t1", { name: "Vaso", quantity: 1, unit: "vaso" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("no deja borrar una medida que usan platos", async () => {
    const { measures } = services(makePrisma({ linked: 2 }));
    await expect(measures.remove("t1", "m-cana")).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe("CuinerMappingService.setDishMap con medida", () => {
  it("guarda artículo + medida cuando las unidades encajan", async () => {
    const prisma = makePrisma();
    await services(prisma).mapping.setDishMap("t1", {
      tipo: "P",
      producto: "00777",
      productId: "barril",
      servingMeasureId: "m-cana",
    });
    expect(prisma.cuinerDishMap.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          productId: "barril",
          servingMeasureId: "m-cana",
        }),
      }),
    );
  });

  it("rechaza una medida en cl sobre un artículo contado por unidades", async () => {
    await expect(
      services(makePrisma()).mapping.setDishMap("t1", {
        tipo: "P",
        producto: "00778",
        productId: "lata",
        servingMeasureId: "m-cana",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("por unidades sobre artículo en kilos: vale con peso medio, si no pide rellenarlo", async () => {
    const prisma = makePrisma();
    await services(prisma).mapping.setDishMap("t1", {
      tipo: "P",
      producto: "00481",
      productId: "zamburina",
      servingMeasureId: "m-ud",
    });
    expect(prisma.cuinerDishMap.upsert).toHaveBeenCalled();
    await expect(
      services(makePrisma()).mapping.setDishMap("t1", {
        tipo: "P",
        producto: "00481",
        productId: "vieira",
        servingMeasureId: "m-ud",
      }),
    ).rejects.toThrow(/peso medio por unidad/);
  });

  it("rechaza medida si el plato va a receta", async () => {
    await expect(
      services(makePrisma()).mapping.setDishMap("t1", {
        tipo: "P",
        producto: "00779",
        recipeId: "r1",
        servingMeasureId: "m-cana",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("CuinerMappingService.setDishMaps (en bloque)", () => {
  it("guarda todos si todos son válidos", async () => {
    const prisma = makePrisma();
    const result = await services(prisma).mapping.setDishMaps("t1", [
      {
        tipo: "P",
        producto: "00062",
        productId: "barril",
        servingMeasureId: "m-cana",
      },
      { tipo: "P", producto: "00090", productId: "lata" },
    ]);
    expect(result).toEqual({ linked: 2 });
    expect(prisma.cuinerDishMap.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("no guarda ninguno si uno falla y dice cuál", async () => {
    const prisma = makePrisma();
    await expect(
      services(prisma).mapping.setDishMaps("t1", [
        {
          tipo: "P",
          producto: "00062",
          productId: "barril",
          servingMeasureId: "m-cana",
        },
        {
          tipo: "P",
          producto: "00777",
          productId: "lata",
          servingMeasureId: "m-cana",
        },
      ]),
    ).rejects.toThrow(/00777/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
