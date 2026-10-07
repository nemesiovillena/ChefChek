import { PrismaService } from "../../common/services/prisma.service";
import { CuinerOverviewService } from "./cuiner-overview.service";

const catalogSuppliers = [
  {
    codigo: "00009",
    nombre: "HIJOS DE GARCIA",
    razon: "HIJOS DE GARCIA SL",
    cif: "B-12345678",
    baja: false,
  },
  {
    codigo: "00019",
    nombre: "LACTEOS DEL SUR",
    razon: "LÁCTEOS DEL SUR SA",
    cif: null,
    baja: false,
  },
  {
    codigo: "00031",
    nombre: "YA ENLAZADO",
    razon: null,
    cif: "A99999999",
    baja: false,
  },
];

function makePrisma() {
  return {
    supplier: {
      findMany: jest.fn(async () => [
        { id: "s1", name: "García", legalName: null, cifNif: "b12345678" },
        {
          id: "s2",
          name: "Lacteos del Sur",
          legalName: "Lácteos del Sur S.A.",
          cifNif: null,
        },
        {
          id: "s3",
          name: "Sin parecido",
          legalName: null,
          cifNif: "A99999999",
        },
        { id: "s4", name: "Enlazado", legalName: null, cifNif: null },
      ]),
    },
    cuinerSupplierMap: {
      findMany: jest.fn(async () => [{ supplierId: "s4", codigo: "00031" }]),
    },
    cuinerSupplier: { findMany: jest.fn(async () => catalogSuppliers) },
    cuinerDish: {
      findMany: jest.fn(async () => [
        { tipo: "P", producto: "00001", nombre: "CAFE" },
        { tipo: "P", producto: "00002", nombre: "HAMBURGUESA" },
        { tipo: "P", producto: "00003", nombre: "AGUA" },
      ]),
    },
    cuinerDishMap: {
      findMany: jest.fn(async () => [
        { tipo: "P", producto: "00002", recipeId: "r1", productId: null },
      ]),
    },
    cuinerSaleLine: {
      groupBy: jest.fn(async () => [
        { producto: "00002", _sum: { unidades: 40 } },
        { producto: "00001", _sum: { unidades: 120 } },
      ]),
    },
    recipe: {
      findMany: jest.fn(async () => [
        { id: "r1", name: "Hamburguesa clásica" },
      ]),
    },
    product: { findMany: jest.fn(async () => []) },
  };
}

const service = () =>
  new CuinerOverviewService(makePrisma() as unknown as PrismaService);

describe("CuinerOverviewService.suppliers", () => {
  it("sugiere por CIF normalizado antes que por nombre", async () => {
    const rows = await service().suppliers("t1");
    expect(rows.find((r) => r.supplierId === "s1")?.suggestion).toEqual({
      codigo: "00009",
      nombre: "HIJOS DE GARCIA",
      reason: "cif",
    });
  });

  it("sugiere por parecido de nombre sin tildes ni puntuación", async () => {
    const rows = await service().suppliers("t1");
    expect(rows.find((r) => r.supplierId === "s2")?.suggestion).toMatchObject({
      codigo: "00019",
      reason: "nombre",
    });
  });

  it("no sugiere códigos ya enlazados a otro proveedor", async () => {
    const rows = await service().suppliers("t1");
    expect(rows.find((r) => r.supplierId === "s3")?.suggestion).toBeNull();
  });

  it("devuelve el enlace actual sin sugerencia", async () => {
    const rows = await service().suppliers("t1");
    expect(rows.find((r) => r.supplierId === "s4")).toMatchObject({
      mapped: { codigo: "00031", nombre: "YA ENLAZADO" },
      suggestion: null,
    });
  });
});

describe("CuinerOverviewService.dishes", () => {
  it("ordena por unidades vendidas y resuelve la receta enlazada", async () => {
    const { items, total } = await service().dishes("t1", {});
    expect(total).toBe(3);
    expect(items.map((d) => [d.producto, d.sold])).toEqual([
      ["00001", 120],
      ["00002", 40],
      ["00003", 0],
    ]);
    expect(items[1].mapped).toEqual({
      kind: "recipe",
      id: "r1",
      name: "Hamburguesa clásica",
    });
  });

  it("filtra los ya enlazados y busca por nombre sin tildes", async () => {
    const unmapped = await service().dishes("t1", { onlyUnmapped: true });
    expect(unmapped.items.map((d) => d.producto)).toEqual(["00001", "00003"]);
    const search = await service().dishes("t1", { search: "café" });
    expect(search.items.map((d) => d.producto)).toEqual(["00001"]);
  });
});
