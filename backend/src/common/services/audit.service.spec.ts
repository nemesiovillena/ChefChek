import { Test, TestingModule } from "@nestjs/testing";
import { AuditService, AuditAction, EntityType } from "./audit.service";
import { PrismaService } from "./prisma.service";

describe("AuditService", () => {
  let service: AuditService;

  const prisma = {
    auditLog: { create: jest.fn(), findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<AuditService>(AuditService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("log", () => {
    it("persists an audit log entry", async () => {
      prisma.auditLog.create.mockResolvedValue({ id: "al-1" });

      await service.log("u1", "t1", {
        action: AuditAction.CREATE,
        entityType: EntityType.PRODUCT,
        entityId: "p1",
        details: { foo: "bar" },
        ipAddress: "1.1.1.1",
        userAgent: "jest",
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          tenantId: "t1",
          userId: "u1",
          action: AuditAction.CREATE,
          entityType: EntityType.PRODUCT,
          entityId: "p1",
          details: { foo: "bar" },
          ipAddress: "1.1.1.1",
          userAgent: "jest",
        },
      });
    });

    it("swallows errors so the main operation is not affected", async () => {
      prisma.auditLog.create.mockRejectedValue(new Error("db down"));

      await expect(
        service.log("u1", "t1", {
          action: AuditAction.LOGIN,
          entityType: EntityType.USER,
          entityId: "u1",
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("getAuditLogs", () => {
    beforeEach(() => prisma.auditLog.findMany.mockResolvedValue([]));

    it("builds a where with only tenantId when no filters given", async () => {
      await service.getAuditLogs("t1");
      expect(prisma.auditLog.findMany.mock.calls[0][0].where).toEqual({
        tenantId: "t1",
      });
    });

    it("applies all provided filters", async () => {
      const start = new Date("2024-01-01");
      const end = new Date("2024-02-01");
      await service.getAuditLogs("t1", {
        userId: "u1",
        action: AuditAction.UPDATE,
        entityType: EntityType.RECIPE,
        entityId: "r1",
        startDate: start,
        endDate: end,
      });

      const { where } = prisma.auditLog.findMany.mock.calls[0][0];
      expect(where).toEqual({
        tenantId: "t1",
        userId: "u1",
        action: AuditAction.UPDATE,
        entityType: EntityType.RECIPE,
        entityId: "r1",
        createdAt: { gte: start, lte: end },
      });
    });

    it("builds createdAt range with only startDate", async () => {
      const start = new Date("2024-01-01");
      await service.getAuditLogs("t1", { startDate: start });
      const { createdAt } = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(createdAt.gte).toEqual(start);
      expect(createdAt.lte).toBeUndefined();
    });

    it("builds createdAt range with only endDate", async () => {
      const end = new Date("2024-02-01");
      await service.getAuditLogs("t1", { endDate: end });
      const { createdAt } = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(createdAt.lte).toEqual(end);
      expect(createdAt.gte).toBeUndefined();
    });
  });

  describe("getUserActivity", () => {
    it("queries activity since the given number of days", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      await service.getUserActivity("u1", "t1", 14);
      const arg = prisma.auditLog.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({
        userId: "u1",
        tenantId: "t1",
        createdAt: { gte: expect.any(Date) },
      });
    });
  });

  describe("getEntityHistory", () => {
    it("queries history for an entity", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      await service.getEntityHistory(EntityType.ORDER, "o1", "t1");
      expect(prisma.auditLog.findMany.mock.calls[0][0].where).toEqual({
        entityType: EntityType.ORDER,
        entityId: "o1",
        tenantId: "t1",
      });
    });
  });
});
