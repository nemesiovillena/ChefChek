import { Test, TestingModule } from "@nestjs/testing";
import { SessionService } from "./session.service";
import { LuciaAuthService } from "./lucia-auth.service";
import { PrismaService } from "../../common/services/prisma.service";

describe("SessionService", () => {
  let service: SessionService;
  let luciaAuthService: any;
  let prismaService: any;

  const mockLucia = {
    createSession: jest.fn(),
    validateSession: jest.fn(),
    invalidateSession: jest.fn(),
    createSessionCookie: jest.fn(),
    createBlankSessionCookie: jest.fn(),
  };

  beforeEach(async () => {
    luciaAuthService = {
      getLucia: jest.fn().mockReturnValue(mockLucia),
    };

    prismaService = {
      session: {
        deleteMany: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: LuciaAuthService,
          useValue: luciaAuthService,
        },
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createSession", () => {
    it("should create a session and return cookie", async () => {
      const mockSession = {
        id: "session-1",
        userId: "user-1",
        expiresAt: new Date(),
      };
      const mockCookie = {
        serialize: jest.fn().mockReturnValue("session-cookie-string"),
      };

      mockLucia.createSession.mockResolvedValue(mockSession);
      mockLucia.createSessionCookie.mockReturnValue(mockCookie);

      const result = await service.createSession(
        "user-1",
        "127.0.0.1",
        "Mozilla",
      );

      expect(result.session).toBe(mockSession);
      expect(result.cookie).toBe("session-cookie-string");
      expect(mockLucia.createSession).toHaveBeenCalledWith("user-1", {});
      expect(mockLucia.createSessionCookie).toHaveBeenCalledWith("session-1");
    });

    it("should create session without optional parameters", async () => {
      const mockSession = { id: "session-1" };
      const mockCookie = {
        serialize: jest.fn().mockReturnValue("cookie"),
      };

      mockLucia.createSession.mockResolvedValue(mockSession);
      mockLucia.createSessionCookie.mockReturnValue(mockCookie);

      const result = await service.createSession("user-1");

      expect(result.session).toBeDefined();
      expect(result.cookie).toBeDefined();
      expect(mockLucia.createSession).toHaveBeenCalledWith("user-1", {});
    });
  });

  describe("validateSession", () => {
    it("should return valid session with user", async () => {
      const mockSession = {
        id: "session-1",
        userId: "user-1",
        expiresAt: new Date(Date.now() + 3600000),
      };
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
      };

      mockLucia.validateSession.mockResolvedValue({
        session: mockSession,
        user: mockUser,
      });

      const result = await service.validateSession("session-1");

      expect(result.valid).toBe(true);
      expect(result.user).toBe(mockUser);
      expect(result.session).toBe(mockSession);
    });

    it("should return invalid for expired or non-existent session", async () => {
      mockLucia.validateSession.mockResolvedValue({
        session: null,
        user: null,
      });

      const result = await service.validateSession("invalid-session");

      expect(result.valid).toBe(false);
      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
    });
  });

  describe("invalidateSession", () => {
    it("should invalidate session and return blank cookie", async () => {
      const mockBlankCookie = {
        serialize: jest.fn().mockReturnValue("blank-cookie"),
      };

      mockLucia.invalidateSession.mockResolvedValue(undefined);
      mockLucia.createBlankSessionCookie.mockReturnValue(mockBlankCookie);

      const result = await service.invalidateSession("session-1");

      expect(result.cookie).toBe("blank-cookie");
      expect(mockLucia.invalidateSession).toHaveBeenCalledWith("session-1");
      expect(mockLucia.createBlankSessionCookie).toHaveBeenCalled();
    });
  });

  describe("invalidateAllUserSessions", () => {
    it("should delete all sessions for a user", async () => {
      prismaService.session.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.invalidateAllUserSessions("user-1");

      expect(result.success).toBe(true);
      expect(result.message).toBe("All sessions invalidated");
      expect(prismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
    });
  });

  describe("getUserActiveSessions", () => {
    it("should return all active sessions for user", async () => {
      const mockSessions = [
        {
          id: "session-1",
          userId: "user-1",
          expiresAt: new Date(Date.now() + 3600000),
          user: { id: "user-1", email: "test@example.com" },
        },
        {
          id: "session-2",
          userId: "user-1",
          expiresAt: new Date(Date.now() + 7200000),
          user: { id: "user-1", email: "test@example.com" },
        },
      ];

      prismaService.session.findMany.mockResolvedValue(mockSessions);

      const result = await service.getUserActiveSessions("user-1", "tenant-1");

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("session-1");
      expect(prismaService.session.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          user: { tenantId: "tenant-1" },
          expiresAt: { gt: expect.any(Date) },
        },
        include: { user: true },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should work without tenant filter", async () => {
      prismaService.session.findMany.mockResolvedValue([]);

      await service.getUserActiveSessions("user-1");

      expect(prismaService.session.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          user: { tenantId: undefined },
          expiresAt: { gt: expect.any(Date) },
        },
        include: { user: true },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("refreshSession", () => {
    it("should refresh session and return new cookie", async () => {
      const oldSession = {
        id: "session-1",
        userId: "user-1",
        ipAddress: "192.168.1.1",
        userAgent: "Chrome",
      };
      const newSession = {
        id: "session-2",
        userId: "user-1",
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      };
      const mockCookie = {
        serialize: jest.fn().mockReturnValue("new-cookie"),
      };

      mockLucia.validateSession.mockResolvedValue({
        session: oldSession,
        user: { id: "user-1" },
      });
      prismaService.session.findUnique.mockResolvedValue(oldSession);
      prismaService.session.delete.mockResolvedValue(undefined);
      prismaService.session.create.mockResolvedValue(newSession);
      prismaService.$transaction.mockImplementation(async (callback) => {
        return callback(prismaService);
      });
      mockLucia.createSessionCookie.mockReturnValue(mockCookie);

      const result = await service.refreshSession(
        "session-1",
        "127.0.0.1",
        "Mozilla",
      );

      expect(result.session.id).toBe("session-2");
      expect(result.cookie).toBe("new-cookie");
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it("should throw error for invalid session", async () => {
      mockLucia.validateSession.mockResolvedValue({
        session: null,
        user: null,
      });

      await expect(service.refreshSession("invalid")).rejects.toThrow(
        "Invalid session",
      );
    });

    it("should throw error if session already invalidated", async () => {
      mockLucia.validateSession.mockResolvedValue({
        session: { id: "session-1", userId: "user-1" },
        user: { id: "user-1" },
      });
      prismaService.session.findUnique.mockResolvedValue(null);
      prismaService.$transaction.mockImplementation(async (callback) => {
        return callback(prismaService);
      });

      await expect(service.refreshSession("session-1")).rejects.toThrow(
        "Session already invalidated",
      );
    });
  });
});
