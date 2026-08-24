import { Test, TestingModule } from "@nestjs/testing";
import { NotificationsService } from "./notifications.service";
import { PrismaService } from "../../common/services/prisma.service";
import { WebSocketService } from "../../websocket/websocket.service";

describe("NotificationsService", () => {
  let service: NotificationsService;
  let prismaService: PrismaService;
  let websocketService: jest.Mocked<WebSocketService>;

  const mockPrismaService = {
    alert: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: WebSocketService,
          useValue: {
            broadcastNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prismaService = module.get<PrismaService>(PrismaService);
    websocketService = module.get(WebSocketService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createNotification", () => {
    it("should create a notification mapped to the real Alert schema, with title and message stored separately", async () => {
      const mockAlert = {
        id: "alert-1",
        tenantId: "tenant-1",
        type: "INFO",
        alertType: "INFO",
        title: "Test",
        severity: "INFO",
        message: "Test message",
        createdBy: "system",
        createdAt: new Date("2026-07-20T10:00:00Z"),
      };

      mockPrismaService.alert.create.mockResolvedValue(mockAlert);

      const result = await service.createNotification("tenant-1", {
        type: "INFO",
        title: "Test",
        message: "Test message",
      });

      expect(result).toEqual({
        success: true,
        data: mockAlert,
        message: "Notification created successfully",
      });
      expect(mockPrismaService.alert.create).toHaveBeenCalledWith({
        data: {
          tenantId: "tenant-1",
          type: "INFO",
          alertType: "INFO",
          title: "Test",
          severity: "INFO",
          message: "Test message",
          createdBy: "system",
        },
      });
    });

    it("emits a WebSocket 'notification' broadcast to the tenant room after persisting", async () => {
      const mockAlert = {
        id: "alert-1",
        title: "Test",
        message: "Test message",
        createdAt: new Date("2026-07-20T10:00:00Z"),
      };
      mockPrismaService.alert.create.mockResolvedValue(mockAlert);

      await service.createNotification("tenant-1", {
        type: "WARNING",
        title: "Test",
        message: "Test message",
        severity: "WARNING",
      });

      expect(websocketService.broadcastNotification).toHaveBeenCalledWith({
        id: "alert-1",
        type: "WARNING",
        title: "Test",
        message: "Test message",
        createdAt: mockAlert.createdAt,
        tenantId: "tenant-1",
      });
    });

    it("does not fail notification creation if the WebSocket broadcast throws", async () => {
      mockPrismaService.alert.create.mockResolvedValue({ id: "alert-1" });
      (websocketService.broadcastNotification as jest.Mock).mockImplementation(
        () => {
          throw new Error("socket down");
        },
      );

      await expect(
        service.createNotification("tenant-1", {
          type: "INFO",
          title: "Test",
          message: "Test message",
        }),
      ).resolves.toEqual(expect.objectContaining({ success: true }));
    });

    it("should create notification with severity", async () => {
      const mockAlert = { id: "alert-1", severity: "WARNING" };

      mockPrismaService.alert.create.mockResolvedValue(mockAlert);

      await service.createNotification("tenant-1", {
        type: "ERROR",
        title: "Test",
        message: "Test message",
        severity: "WARNING",
      });

      expect(mockPrismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: "WARNING",
        }),
      });
    });

    it("should default createdBy to 'system' when no userId is given, and to userId otherwise", async () => {
      const mockAlert = { id: "alert-1", createdBy: "user-1" };

      mockPrismaService.alert.create.mockResolvedValue(mockAlert);

      await service.createNotification("tenant-1", {
        type: "INFO",
        title: "Test",
        message: "Test message",
        userId: "user-1",
      });

      expect(mockPrismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          createdBy: "user-1",
        }),
      });
    });

    it("stores title and message as separate columns (no concatenation)", async () => {
      mockPrismaService.alert.create.mockResolvedValue({ id: "alert-1" });

      await service.createNotification("tenant-1", {
        type: "INFO",
        title: "Cambio de precio",
        message: "Test message",
      });

      expect(mockPrismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: "Cambio de precio",
          message: "Test message",
        }),
      });
    });
  });

  describe("notifyPriceChange", () => {
    it("uses WARNING severity for a change up to 25%", async () => {
      mockPrismaService.alert.create.mockResolvedValue({ id: "alert-1" });

      await service.notifyPriceChange("tenant-1", "Aceite", 10, 12, 20);

      expect(mockPrismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: "WARNING",
          title: "Cambio de precio: Aceite",
          message: "Precio aumentado 20.0%. De 10.00€ a 12.00€.",
        }),
      });
    });

    it("uses ERROR severity for a change over 25%", async () => {
      mockPrismaService.alert.create.mockResolvedValue({ id: "alert-1" });

      await service.notifyPriceChange("tenant-1", "Aceite", 10, 4, 60);

      expect(mockPrismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: "ERROR",
          message: "Precio disminuido 60.0%. De 10.00€ a 4.00€.",
        }),
      });
    });
  });

  describe("getUserNotifications", () => {
    it("should get notifications for tenant", async () => {
      const mockAlerts = [
        { id: "alert-1", tenantId: "tenant-1" },
        { id: "alert-2", tenantId: "tenant-1" },
      ];

      mockPrismaService.alert.findMany.mockResolvedValue(mockAlerts);

      const result = await service.getUserNotifications("tenant-1");

      expect(result).toEqual({
        success: true,
        data: mockAlerts,
        message: "Notifications retrieved successfully",
      });
      expect(mockPrismaService.alert.findMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1" },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    });

    it("should get notifications for specific user", async () => {
      const mockAlerts = [{ id: "alert-1", userId: "user-1" }];

      mockPrismaService.alert.findMany.mockResolvedValue(mockAlerts);

      const result = await service.getUserNotifications("tenant-1", "user-1");

      expect(result).toEqual({
        success: true,
        data: mockAlerts,
        message: "Notifications retrieved successfully",
      });
      expect(mockPrismaService.alert.findMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", userId: "user-1" },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    });

    it("should use custom limit", async () => {
      mockPrismaService.alert.findMany.mockResolvedValue([]);

      await service.getUserNotifications("tenant-1", undefined, 10);

      expect(mockPrismaService.alert.findMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1" },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
    });

    it("should handle empty results", async () => {
      mockPrismaService.alert.findMany.mockResolvedValue([]);

      const result = await service.getUserNotifications("tenant-1");

      expect(result.data).toEqual([]);
    });
  });

  describe("markAsRead", () => {
    it("should persist isRead:true and readAt in the Alert row", async () => {
      const existing = { id: "alert-1", tenantId: "tenant-1", isRead: false };
      const updated = { ...existing, isRead: true, readAt: new Date() };

      mockPrismaService.alert.findFirst.mockResolvedValue(existing);
      mockPrismaService.alert.update.mockResolvedValue(updated);

      const result = await service.markAsRead("alert-1", "tenant-1");

      expect(result).toEqual({
        success: true,
        data: updated,
        message: "Notification marked as read",
      });
      expect(mockPrismaService.alert.findFirst).toHaveBeenCalledWith({
        where: { id: "alert-1", tenantId: "tenant-1" },
      });
      expect(mockPrismaService.alert.update).toHaveBeenCalledWith({
        where: { id: "alert-1" },
        data: { isRead: true, readAt: expect.any(Date) },
      });
    });

    it("should throw error if notification not found", async () => {
      mockPrismaService.alert.findFirst.mockResolvedValue(null);

      await expect(
        service.markAsRead("nonexistent-id", "tenant-1"),
      ).rejects.toThrow("Notification not found");
    });

    it("should return error in result format", async () => {
      mockPrismaService.alert.findFirst.mockResolvedValue(null);

      await expect(
        service.markAsRead("nonexistent-id", "tenant-1"),
      ).rejects.toThrow();
    });
  });

  describe("sendBulkNotifications", () => {
    it("should send to all users if no roles specified", async () => {
      const mockUsers = [{ id: "user-1" }, { id: "user-2" }, { id: "user-3" }];

      const mockAlert = { id: "alert-1" };
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.alert.create
        .mockResolvedValue(mockAlert)
        .mockResolvedValue(mockAlert)
        .mockResolvedValue(mockAlert);

      const result = await service.sendBulkNotifications("tenant-1", {
        type: "INFO",
        title: "Test",
        message: "Test message",
      });

      expect(result.success).toBe(true);
      expect(result.data.notifications).toHaveLength(3);
      expect(result.data.count).toBe(3);
      expect(result.message).toBe("Sent 3 notifications successfully");
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", isActive: true },
        select: { id: true },
      });
      expect(mockPrismaService.alert.create).toHaveBeenCalledTimes(3);
    });

    it("should send to users with specific roles", async () => {
      const mockUsers = [{ id: "user-1", role: "ADMIN" }];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.alert.create.mockResolvedValue({ id: "alert-1" });

      const result = await service.sendBulkNotifications("tenant-1", {
        type: "INFO",
        title: "Test",
        message: "Test message",
        userRoles: ["ADMIN"],
      });

      expect(result.success).toBe(true);
      expect(result.data.notifications).toHaveLength(1);
      expect(result.data.count).toBe(1);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          isActive: true,
          role: { in: ["ADMIN"] },
        },
        select: { id: true },
      });
    });

    it("should handle empty user list", async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.sendBulkNotifications("tenant-1", {
        type: "INFO",
        title: "Test",
        message: "Test message",
      });

      expect(result).toEqual({
        success: true,
        data: { count: 0, notifications: [] },
        message: "Sent 0 notifications successfully",
      });
      expect(mockPrismaService.alert.create).not.toHaveBeenCalled();
    });

    it("should handle multiple roles", async () => {
      const mockUsers = [
        { id: "user-1", role: "ADMIN" },
        { id: "user-2", role: "MANAGER" },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.alert.create
        .mockResolvedValue({ id: "alert-1" })
        .mockResolvedValue({ id: "alert-2" });

      const result = await service.sendBulkNotifications("tenant-1", {
        type: "INFO",
        title: "Test",
        message: "Test message",
        userRoles: ["ADMIN", "MANAGER"],
      });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          isActive: true,
          role: { in: ["ADMIN", "MANAGER"] },
        },
        select: { id: true },
      });
      expect(result.data.count).toBe(2);
    });

    describe("Error Handling", () => {
      it("should handle database errors on create", async () => {
        mockPrismaService.alert.create.mockRejectedValue(new Error("DB error"));

        await expect(
          service.createNotification("tenant-1", {
            type: "INFO",
            title: "Test",
            message: "Test",
          }),
        ).rejects.toThrow("DB error");
      });

      it("should handle database errors on getUserNotifications", async () => {
        mockPrismaService.alert.findMany.mockRejectedValue(
          new Error("DB error"),
        );

        await expect(service.getUserNotifications("tenant-1")).rejects.toThrow(
          "DB error",
        );
      });

      it("should handle database errors on markAsRead", async () => {
        mockPrismaService.alert.findFirst.mockRejectedValue(
          new Error("DB error"),
        );

        await expect(service.markAsRead("alert-1", "tenant-1")).rejects.toThrow(
          "DB error",
        );
      });

      it("should handle database errors on sendBulkNotifications", async () => {
        mockPrismaService.user.findMany.mockRejectedValue(
          new Error("DB error"),
        );

        await expect(
          service.sendBulkNotifications("tenant-1", {
            type: "INFO",
            title: "Test",
            message: "Test",
          }),
        ).rejects.toThrow("DB error");
      });
    });

    describe("Multi-tenancy", () => {
      it("should filter notifications by tenant", async () => {
        mockPrismaService.alert.findMany.mockResolvedValue([]);

        await service.getUserNotifications("tenant-1");

        expect(mockPrismaService.alert.findMany).toHaveBeenCalledWith({
          where: { tenantId: "tenant-1" },
          orderBy: { createdAt: "desc" },
          take: 50,
        });
      });

      it("should verify tenantId on markAsRead", async () => {
        mockPrismaService.alert.findFirst.mockResolvedValue({
          id: "alert-1",
          tenantId: "tenant-1",
        });

        await service.markAsRead("alert-1", "tenant-1");

        expect(mockPrismaService.alert.findFirst).toHaveBeenCalledWith({
          where: { id: "alert-1", tenantId: "tenant-1" },
        });
      });

      it("should verify tenantId on create", async () => {
        mockPrismaService.alert.create.mockResolvedValue({ id: "alert-1" });

        await service.createNotification("tenant-1", {
          type: "INFO",
          title: "Test",
          message: "Test",
        });

        expect(mockPrismaService.alert.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ tenantId: "tenant-1" }),
        });
      });

      it("should verify tenantId on bulk send", async () => {
        mockPrismaService.user.findMany.mockResolvedValue([]);
        mockPrismaService.alert.create.mockResolvedValue({ id: "alert-1" });

        await service.sendBulkNotifications("tenant-1", {
          type: "INFO",
          title: "Test",
          message: "Test",
        });

        expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
          where: { tenantId: "tenant-1", isActive: true },
          select: { id: true },
        });
      });
    });
  });
});
