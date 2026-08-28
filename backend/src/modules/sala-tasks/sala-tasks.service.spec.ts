import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { SalaTasksService } from "./sala-tasks.service";
import { PrismaService } from "../../common/services/prisma.service";
import { SalaTaskStatus } from "./dto/sala-task.dto";

describe("SalaTasksService", () => {
  let service: SalaTasksService;

  const mockPrismaService = {
    salaTask: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  const TENANT_ID = "tenant-1";

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalaTasksService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SalaTasksService>(SalaTasksService);
  });

  describe("create", () => {
    it("appends the new task at the end of its column (last sortOrder + 1)", async () => {
      mockPrismaService.salaTask.findFirst.mockResolvedValue({ sortOrder: 2 });
      mockPrismaService.salaTask.create.mockResolvedValue({
        id: "t1",
        sortOrder: 3,
      });

      const result = await service.create(TENANT_ID, "user-1", {
        title: "Comida empresa",
        eventDate: new Date("2026-09-01"),
      });

      expect(mockPrismaService.salaTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            status: SalaTaskStatus.PENDIENTE,
            sortOrder: 3,
            createdBy: "user-1",
          }),
        }),
      );
      expect(result).toEqual({
        success: true,
        data: { id: "t1", sortOrder: 3 },
      });
    });

    it("starts sortOrder at 0 for the first task in an empty column", async () => {
      mockPrismaService.salaTask.findFirst.mockResolvedValue(null);
      mockPrismaService.salaTask.create.mockResolvedValue({ id: "t1" });

      await service.create(TENANT_ID, "user-1", {
        title: "Reserva",
        eventDate: new Date("2026-09-01"),
      });

      expect(mockPrismaService.salaTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sortOrder: 0 }),
        }),
      );
    });
  });

  describe("findAll", () => {
    it("scopes by tenantId and excludes soft-deleted rows", async () => {
      mockPrismaService.salaTask.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_ID);

      expect(mockPrismaService.salaTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID, deletedAt: null },
        }),
      );
    });
  });

  describe("findOne", () => {
    it("throws NotFoundException when the task does not belong to the tenant", async () => {
      mockPrismaService.salaTask.findFirst.mockResolvedValue(null);

      await expect(service.findOne(TENANT_ID, "missing")).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.salaTask.findFirst).toHaveBeenCalledWith({
        where: { id: "missing", tenantId: TENANT_ID, deletedAt: null },
      });
    });
  });

  describe("update", () => {
    it("throws NotFoundException when not owned by the tenant", async () => {
      mockPrismaService.salaTask.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, "t1", { title: "Nuevo título" }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.salaTask.update).not.toHaveBeenCalled();
    });

    it("only sends the fields present in the DTO", async () => {
      mockPrismaService.salaTask.findFirst.mockResolvedValue({ id: "t1" });
      mockPrismaService.salaTask.update.mockResolvedValue({ id: "t1" });

      await service.update(TENANT_ID, "t1", { title: "Nuevo título" });

      expect(mockPrismaService.salaTask.update).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { title: "Nuevo título" },
      });
    });
  });

  describe("remove", () => {
    it("soft-deletes: sets deletedAt instead of physically deleting", async () => {
      mockPrismaService.salaTask.findFirst.mockResolvedValue({ id: "t1" });
      mockPrismaService.salaTask.update.mockResolvedValue({ id: "t1" });

      await service.remove(TENANT_ID, "t1");

      expect(mockPrismaService.salaTask.update).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it("throws NotFoundException when not owned by the tenant", async () => {
      mockPrismaService.salaTask.findFirst.mockResolvedValue(null);

      await expect(service.remove(TENANT_ID, "t1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("reorder", () => {
    it("throws BadRequestException if an item does not belong to the tenant", async () => {
      mockPrismaService.salaTask.findMany.mockResolvedValue([{ id: "t1" }]);

      await expect(
        service.reorder(TENANT_ID, {
          items: [
            { id: "t1", status: SalaTaskStatus.PENDIENTE, sortOrder: 0 },
            { id: "t2", status: SalaTaskStatus.PENDIENTE, sortOrder: 1 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it("persists status and sortOrder for every owned item in one transaction", async () => {
      mockPrismaService.salaTask.findMany.mockResolvedValue([
        { id: "t1" },
        { id: "t2" },
      ]);
      mockPrismaService.salaTask.update.mockResolvedValue({});

      await service.reorder(TENANT_ID, {
        items: [
          { id: "t1", status: SalaTaskStatus.EN_CURSO, sortOrder: 0 },
          { id: "t2", status: SalaTaskStatus.PENDIENTE, sortOrder: 1 },
        ],
      });

      expect(mockPrismaService.salaTask.update).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { status: SalaTaskStatus.EN_CURSO, sortOrder: 0 },
      });
      expect(mockPrismaService.salaTask.update).toHaveBeenCalledWith({
        where: { id: "t2" },
        data: { status: SalaTaskStatus.PENDIENTE, sortOrder: 1 },
      });
    });
  });
});
