import { BadRequestException, ConflictException } from "@nestjs/common";
import { EmployeesService, splitFullName } from "./employees.service";

function makeService() {
  const users: any[] = [
    {
      id: "u-free",
      name: "Ana López Mora",
      tenantId: "t1",
      isSharedAccount: false,
      employee: null,
    },
    { id: "u-shared", tenantId: "t1", isSharedAccount: true, employee: null },
    {
      id: "u-taken",
      tenantId: "t1",
      isSharedAccount: false,
      employee: { id: "e0" },
    },
    { id: "u-other", tenantId: "t2", isSharedAccount: false, employee: null },
  ];
  const locations: any[] = [
    { id: "loc-a", tenantId: "t1", isDefault: true },
    { id: "loc-b", tenantId: "t1", isDefault: false },
    { id: "loc-x", tenantId: "t2", isDefault: true },
  ];
  const employees: any[] = [];
  const withRelations = (employee: any) => ({
    ...employee,
    user: null,
    locations: employee._locationIds.map((locationId: string) => ({
      locationId,
    })),
  });
  const employeeDelegate = {
    create: jest.fn(async ({ data }: any) => {
      const { locations: nested, ...rest } = data;
      const employee = {
        id: `e${employees.length + 1}`,
        pinHash: "hash-secreto",
        pinFailedAttempts: 0,
        pinLockedUntil: null,
        ...rest,
        _locationIds: nested.create.map((l: any) => l.locationId),
      };
      employees.push(employee);
      return withRelations(employee);
    }),
    findFirst: jest.fn(async ({ where }: any) => {
      const found = employees.find(
        (e) => e.id === where.id && e.tenantId === where.tenantId,
      );
      return found ? withRelations(found) : null;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const employee = employees.find((e) => e.id === where.id);
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          employee[key] = value;
        }
      }
      return withRelations(employee);
    }),
  };
  const employeeLocationDelegate = {
    deleteMany: jest.fn(async ({ where }: any) => {
      employees.find((e) => e.id === where.employeeId)._locationIds = [];
    }),
    createMany: jest.fn(async ({ data }: any) => {
      for (const row of data) {
        employees
          .find((e) => e.id === row.employeeId)
          ._locationIds.push(row.locationId);
      }
    }),
  };
  const prisma: any = {
    employee: employeeDelegate,
    employeeLocation: employeeLocationDelegate,
    sictedJobAssignment: {
      findMany: jest.fn(async () => [
        { userId: "u-free", profile: { title: "Jefe de cocina" } },
      ]),
    },
    user: {
      findMany: jest.fn(async ({ where }: any) =>
        users
          .filter(
            (u) =>
              u.tenantId === where.tenantId &&
              !u.isSharedAccount &&
              u.employee === null,
          )
          .map((u) => ({ id: u.id, name: u.name, email: `${u.id}@test.com` })),
      ),
      findFirst: jest.fn(
        async ({ where }: any) =>
          users.find(
            (u) => u.id === where.id && u.tenantId === where.tenantId,
          ) ?? null,
      ),
    },
    location: {
      findFirst: jest.fn(
        async ({ where }: any) =>
          locations.find(
            (l) =>
              l.tenantId === where.tenantId && l.isDefault === where.isDefault,
          ) ?? null,
      ),
      findMany: jest.fn(async ({ where }: any) =>
        locations.filter(
          (l) => l.tenantId === where.tenantId && where.id.in.includes(l.id),
        ),
      ),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  return { service: new EmployeesService(prisma), employees };
}

const BASE = { firstName: "Luis", lastName: "García" };

describe("EmployeesService", () => {
  it("no expone el hash del PIN", async () => {
    const { service } = makeService();
    const created: any = await service.create("t1", BASE);
    expect(created.pinHash).toBeUndefined();
    expect(created.hasPin).toBe(true);
  });

  it("asigna el centro por defecto del tenant si no se indica ninguno", async () => {
    const { service } = makeService();
    const created = await service.create("t1", BASE);
    expect(created.locationIds).toEqual(["loc-a"]);
    expect(created.defaultLocationId).toBe("loc-a");
  });

  it("admite varios centros", async () => {
    const { service } = makeService();
    const created = await service.create("t1", {
      ...BASE,
      locationIds: ["loc-a", "loc-b"],
      defaultLocationId: "loc-b",
    });
    expect(created.locationIds.sort()).toEqual(["loc-a", "loc-b"]);
    expect(created.defaultLocationId).toBe("loc-b");
  });

  it("rechaza centros de otro tenant", async () => {
    const { service } = makeService();
    await expect(
      service.create("t1", { ...BASE, locationIds: ["loc-x"] }),
    ).rejects.toThrow(BadRequestException);
  });

  it("vincula una cuenta personal libre del mismo tenant", async () => {
    const { service } = makeService();
    const created = await service.create("t1", { ...BASE, userId: "u-free" });
    expect(created.userId).toBe("u-free");
  });

  it("rechaza cuentas compartidas, ya vinculadas o de otro tenant", async () => {
    const { service } = makeService();
    await expect(
      service.create("t1", { ...BASE, userId: "u-shared" }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create("t1", { ...BASE, userId: "u-taken" }),
    ).rejects.toThrow(ConflictException);
    await expect(
      service.create("t1", { ...BASE, userId: "u-other" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("no deja ver ni editar empleados de otro tenant", async () => {
    const { service } = makeService();
    const created = await service.create("t1", BASE);
    await expect(service.getOne("t2", created.id)).rejects.toThrow(
      "Empleado no encontrado",
    );
    await expect(
      service.update("t2", created.id, { firstName: "X" }),
    ).rejects.toThrow("Empleado no encontrado");
  });

  it("al cambiar los centros reemplaza la asignación y recoloca el centro por defecto", async () => {
    const { service } = makeService();
    const created = await service.create("t1", BASE);
    const updated = await service.update("t1", created.id, {
      locationIds: ["loc-b"],
    });
    expect(updated.locationIds).toEqual(["loc-b"]);
    expect(updated.defaultLocationId).toBe("loc-b");
  });

  it("separa nombre y apellidos", () => {
    expect(splitFullName("  Marta  Ruiz García ")).toEqual({
      firstName: "Marta",
      lastName: "Ruiz García",
    });
    expect(splitFullName("Nito")).toEqual({ firstName: "Nito", lastName: "" });
  });

  it("sugiere el puesto de SICTED en las cuentas sin ficha", async () => {
    const { service } = makeService();
    const linkable = await service.listLinkableUsers("t1");
    expect(linkable).toEqual([
      expect.objectContaining({
        id: "u-free",
        suggestedJobTitle: "Jefe de cocina",
      }),
    ]);
  });

  it("importa cuentas del equipo como fichas con nombre y puesto", async () => {
    const { service } = makeService();
    const [created] = await service.importFromUsers("t1", ["u-free"]);
    expect(created).toMatchObject({
      firstName: "Ana",
      lastName: "López Mora",
      jobTitle: "Jefe de cocina",
      userId: "u-free",
      locationIds: ["loc-a"],
    });
  });

  it("no importa cuentas compartidas, ya vinculadas o de otro tenant", async () => {
    const { service } = makeService();
    for (const id of ["u-shared", "u-taken", "u-other"]) {
      await expect(service.importFromUsers("t1", [id])).rejects.toThrow(
        "Alguna de las cuentas",
      );
    }
  });

  it("dar de baja conserva la ficha", async () => {
    const { service, employees } = makeService();
    const created = await service.create("t1", BASE);
    const updated = await service.update("t1", created.id, {
      isActive: false,
      terminationDate: new Date("2026-10-31"),
    });
    expect(updated.isActive).toBe(false);
    expect(employees).toHaveLength(1);
  });
});
