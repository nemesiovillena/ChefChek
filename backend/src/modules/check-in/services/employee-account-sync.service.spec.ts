import { EmployeeAccountSyncService } from "./employee-account-sync.service";

const ACCOUNT = {
  id: "u1",
  tenantId: "t1",
  name: "Marta Ruiz García",
  isActive: true,
  isSharedAccount: false,
};

function makeService({ moduleEnabled = true, hasEmployee = false } = {}) {
  const prisma: any = {
    employee: {
      findFirst: jest.fn(async () => (hasEmployee ? { id: "e1" } : null)),
      create: jest.fn(async ({ data }: any) => data),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    location: {
      findFirst: jest.fn(async () => ({ id: "loc-a" })),
      findMany: jest.fn(async () => []),
    },
  };
  const modules: any = { isModuleEnabled: jest.fn(async () => moduleEnabled) };
  return { service: new EmployeeAccountSyncService(prisma, modules), prisma };
}

describe("EmployeeAccountSyncService", () => {
  it("crea la ficha de una cuenta personal nueva con su nombre y el centro por defecto", async () => {
    const { service, prisma } = makeService();
    await service.onAccountCreated(ACCOUNT);
    expect(prisma.employee.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "t1",
        userId: "u1",
        firstName: "Marta",
        lastName: "Ruiz García",
        defaultLocationId: "loc-a",
        locations: { create: [{ tenantId: "t1", locationId: "loc-a" }] },
      }),
    });
  });

  it("no crea ficha para cuentas compartidas, sin tenant o ya vinculadas", async () => {
    const shared = makeService();
    await shared.service.onAccountCreated({
      ...ACCOUNT,
      isSharedAccount: true,
    });
    expect(shared.prisma.employee.create).not.toHaveBeenCalled();

    const noTenant = makeService();
    await noTenant.service.onAccountCreated({ ...ACCOUNT, tenantId: null });
    expect(noTenant.prisma.employee.create).not.toHaveBeenCalled();

    const linked = makeService({ hasEmployee: true });
    await linked.service.onAccountCreated(ACCOUNT);
    expect(linked.prisma.employee.create).not.toHaveBeenCalled();
  });

  it("no crea ficha si el restaurante no usa Fichar", async () => {
    const { service, prisma } = makeService({ moduleEnabled: false });
    await service.onAccountCreated(ACCOUNT);
    expect(prisma.employee.create).not.toHaveBeenCalled();
  });

  it("copia nombre y estado a la ficha cuando cambia la cuenta", async () => {
    const { service, prisma } = makeService();
    await service.onAccountUpdated({
      ...ACCOUNT,
      name: "Marta Ruiz",
      isActive: false,
    });
    expect(prisma.employee.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      data: { firstName: "Marta", lastName: "Ruiz", isActive: false },
    });
  });

  it("desvincula la ficha si la cuenta pasa a ser compartida", async () => {
    const { service, prisma } = makeService();
    await service.onAccountUpdated({ ...ACCOUNT, isSharedAccount: true });
    expect(prisma.employee.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      data: { userId: null },
    });
  });

  it("da de baja la ficha al eliminar la cuenta, sin borrarla", async () => {
    const { service, prisma } = makeService();
    await service.onAccountRemoved("u1");
    expect(prisma.employee.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      data: { isActive: false },
    });
  });
});
