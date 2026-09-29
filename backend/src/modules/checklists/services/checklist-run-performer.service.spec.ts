import { BadRequestException } from "@nestjs/common";
import { ChecklistRunService } from "./checklist-run.service";

const USERS: Record<
  string,
  {
    id: string;
    name: string;
    tenantId: string;
    isActive: boolean;
    isSharedAccount: boolean;
  }
> = {
  juan: {
    id: "juan",
    name: "Juan",
    tenantId: "t1",
    isActive: true,
    isSharedAccount: false,
  },
  ana: {
    id: "ana",
    name: "Ana",
    tenantId: "t1",
    isActive: true,
    isSharedAccount: false,
  },
  cocina: {
    id: "cocina",
    name: "Warynessy",
    tenantId: "t1",
    isActive: true,
    isSharedAccount: true,
  },
};

/** Emula `user.findFirst` con los filtros que usa resolvePerformer. */
function findUser({ where }: any) {
  const user = USERS[where.id];
  if (!user) {
    return null;
  }
  if (where.tenantId && user.tenantId !== where.tenantId) {
    return null;
  }
  if (where.isActive !== undefined && user.isActive !== where.isActive) {
    return null;
  }
  if (
    where.isSharedAccount !== undefined &&
    user.isSharedAccount !== where.isSharedAccount
  ) {
    return null;
  }
  return user;
}

describe("ChecklistRunService — quién firma el registro", () => {
  let prisma: any;
  let service: ChecklistRunService;

  beforeEach(() => {
    prisma = {
      user: { findFirst: jest.fn(async (args) => findUser(args)) },
      checklistRun: {
        findFirst: jest.fn(async () => ({
          id: "r1",
          status: "COMPLETED",
          supervisedAt: null,
          snapshot: {
            mode: "EXECUTION",
            items: [{ id: "i1", label: "Cafetera", isRequired: true }],
          },
          entries: [],
        })),
        update: jest.fn(async ({ data }) => data),
      },
      checklistEntry: { createMany: jest.fn() },
    };
    service = new ChecklistRunService(prisma);
    jest.spyOn(service, "getRun").mockResolvedValue({} as any);
  });

  const entry = (performedByUserId?: string) => ({
    itemId: "i1",
    outcome: "DONE",
    performedByUserId,
    performedByName: "Nombre falseado",
  });

  function savedEntry() {
    return prisma.checklistEntry.createMany.mock.calls[0][0].data[0];
  }

  it("una cuenta personal firma siempre con su nombre, aunque el cliente mande otro", async () => {
    await service.addEntries("t1", "sicted", "r1", "juan", [
      entry("ana") as any,
    ]);

    expect(savedEntry()).toMatchObject({
      performedByUserId: "juan",
      performedByName: "Juan",
      sessionUserId: "juan",
    });
  });

  it("la cuenta compartida firma con la persona elegida y el nombre de la BD", async () => {
    await service.addEntries("t1", "sicted", "r1", "cocina", [
      entry("ana") as any,
    ]);

    expect(savedEntry()).toMatchObject({
      performedByUserId: "ana",
      performedByName: "Ana",
      sessionUserId: "cocina",
    });
  });

  it("la cuenta compartida no puede marcar sin elegir quién", async () => {
    await expect(
      service.addEntries("t1", "sicted", "r1", "cocina", [entry() as any]),
    ).rejects.toThrow(BadRequestException);
  });

  it("la cuenta compartida no puede figurar como quien lo hizo", async () => {
    await expect(
      service.addEntries("t1", "sicted", "r1", "cocina", [
        entry("cocina") as any,
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it("rechaza marcas de personas distintas en un mismo envío", async () => {
    await expect(
      service.addEntries("t1", "sicted", "r1", "cocina", [
        entry("ana") as any,
        { ...entry("juan"), itemId: "i1" } as any,
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it("supervisar desde una cuenta personal firma con su nombre", async () => {
    await service.supervise("t1", "sicted", "r1", "juan", {
      supervisorName: "Otro",
    });

    expect(prisma.checklistRun.update.mock.calls[0][0].data).toMatchObject({
      supervisedByUserId: "juan",
      supervisorName: "Juan",
    });
  });

  it("supervisar desde la cuenta compartida exige elegir quién supervisa", async () => {
    await expect(
      service.supervise("t1", "sicted", "r1", "cocina", {}),
    ).rejects.toThrow(BadRequestException);

    await service.supervise("t1", "sicted", "r1", "cocina", {
      supervisorUserId: "ana",
    });
    expect(
      prisma.checklistRun.update.mock.calls[0][0].data.supervisorName,
    ).toBe("Ana");
  });
});
