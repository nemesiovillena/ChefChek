import { BadRequestException, NotFoundException } from "@nestjs/common";
import { TeamPositionsService } from "./team-positions.service";

describe("TeamPositionsService", () => {
  const tenantId = "t1";
  let prisma: any;
  let roleAccess: any;
  let service: TeamPositionsService;

  beforeEach(() => {
    prisma = {
      sictedJobProfile: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: "p1", title: "Cocina" }),
        update: jest.fn().mockResolvedValue({ id: "p1", title: "Cocina" }),
      },
      sictedJobAssignment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
      user: { findFirst: jest.fn() },
      $transaction: jest.fn((arg: any) =>
        Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
      ),
    };
    roleAccess = {
      getPositionAccess: jest.fn().mockResolvedValue({}),
      updatePositionAccess: jest.fn().mockResolvedValue({}),
    };
    service = new TeamPositionsService(prisma, roleAccess);
  });

  it("no deja crear un puesto con el nombre de otro activo", async () => {
    prisma.sictedJobProfile.findFirst.mockResolvedValue({ id: "p0" });
    await expect(service.create(tenantId, "  cocina ")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("crea el puesto con el nombre limpio", async () => {
    prisma.sictedJobProfile.findFirst.mockResolvedValue(null);
    await service.create(tenantId, "  Sala   2 ");
    expect(prisma.sictedJobProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { tenantId, title: "Sala 2" } }),
    );
  });

  it("cambiar de puesto cierra el vigente y abre el nuevo", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "u1", name: "Ana" });
    prisma.sictedJobProfile.findFirst.mockResolvedValue({ id: "p2" });
    await service.setUserPosition(tenantId, "u1", "p2");
    expect(prisma.sictedJobAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, userId: "u1", until: null },
      }),
    );
    expect(prisma.sictedJobAssignment.create).toHaveBeenCalledWith({
      data: { tenantId, profileId: "p2", userId: "u1", userName: "Ana" },
    });
  });

  it("sin puesto solo cierra el vigente", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "u1", name: "Ana" });
    await service.setUserPosition(tenantId, "u1", null);
    expect(prisma.sictedJobAssignment.updateMany).toHaveBeenCalled();
    expect(prisma.sictedJobAssignment.create).not.toHaveBeenCalled();
  });

  it("no asigna un puesto archivado o de otro tenant", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "u1", name: "Ana" });
    prisma.sictedJobProfile.findFirst.mockResolvedValue(null);
    await expect(service.setUserPosition(tenantId, "u1", "px")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("archivar deja sin puesto a sus personas", async () => {
    prisma.sictedJobProfile.findFirst.mockResolvedValue({ id: "p1" });
    await service.archive(tenantId, "p1");
    expect(prisma.sictedJobAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, profileId: "p1", until: null },
      }),
    );
  });
});
