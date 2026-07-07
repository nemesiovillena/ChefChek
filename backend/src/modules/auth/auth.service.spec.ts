import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";
import { TenantsService } from "../tenants/tenants.service";
import { SessionService } from "./session.service";
import { UnauthorizedException, BadRequestException } from "@nestjs/common";
import * as bcrypt from "bcrypt";

jest.mock("bcrypt");

describe("AuthService", () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let tenantsService: jest.Mocked<TenantsService>;
  let sessionService: jest.Mocked<SessionService>;

  const mockTenant = {
    id: "tenant-123",
    name: "Test Tenant",
    slug: "test-tenant",
    domain: "test.com",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    users: [],
  };

  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    passwordHash: "hashedPassword",
    name: "Test User",
    role: "USER" as const,
    tenantId: "tenant-123",
    isActive: true,
    avatarUrl: null,
  };

  const mockSession = {
    id: "session-123",
    userId: "user-123",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    fresh: true,
  };

  beforeEach(async () => {
    const mockUsersService = {
      findByEmail: jest.fn(),
      findSuperadminByEmail: jest.fn(),
      create: jest.fn(),
    };

    const mockTenantsService = {
      findBySlug: jest.fn(),
    };

    const mockSessionService = {
      createSession: jest.fn(),
      invalidateSession: jest.fn(),
      validateSession: jest.fn(),
      refreshSession: jest.fn(),
      getUserActiveSessions: jest.fn(),
      invalidateAllUserSessions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: TenantsService, useValue: mockTenantsService },
        { provide: SessionService, useValue: mockSessionService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    tenantsService = module.get(TenantsService);
    sessionService = module.get(SessionService);

    jest.clearAllMocks();
  });

  describe("validateUser", () => {
    it("should return user when credentials are valid", async () => {
      tenantsService.findBySlug.mockResolvedValue(mockTenant);
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        "test@example.com",
        "password123",
        "test-tenant",
      );

      expect(result).toEqual(mockUser);
      expect(tenantsService.findBySlug).toHaveBeenCalledWith("test-tenant");
      expect(usersService.findByEmail).toHaveBeenCalledWith(
        "test@example.com",
        "tenant-123",
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        "password123",
        "hashedPassword",
      );
    });

    it("should throw UnauthorizedException when tenant not found", async () => {
      tenantsService.findBySlug.mockResolvedValue(null);

      await expect(
        service.validateUser(
          "test@example.com",
          "password123",
          "invalid-tenant",
        ),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.validateUser(
          "test@example.com",
          "password123",
          "invalid-tenant",
        ),
      ).rejects.toThrow("Tenant not found or inactive");
    });

    it("should throw UnauthorizedException when tenant is inactive", async () => {
      tenantsService.findBySlug.mockResolvedValue({
        ...mockTenant,
        isActive: false,
      });

      await expect(
        service.validateUser("test@example.com", "password123", "test-tenant"),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.validateUser("test@example.com", "password123", "test-tenant"),
      ).rejects.toThrow("Tenant not found or inactive");
    });

    it("should throw UnauthorizedException when user not found", async () => {
      tenantsService.findBySlug.mockResolvedValue(mockTenant);
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.validateUser("test@example.com", "password123", "test-tenant"),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.validateUser("test@example.com", "password123", "test-tenant"),
      ).rejects.toThrow("Invalid credentials");
    });

    it("should throw UnauthorizedException when user is inactive", async () => {
      tenantsService.findBySlug.mockResolvedValue(mockTenant);
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(
        service.validateUser("test@example.com", "password123", "test-tenant"),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.validateUser("test@example.com", "password123", "test-tenant"),
      ).rejects.toThrow("Invalid credentials");
    });

    it("should throw UnauthorizedException when password is invalid", async () => {
      tenantsService.findBySlug.mockResolvedValue(mockTenant);
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateUser(
          "test@example.com",
          "wrongpassword",
          "test-tenant",
        ),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.validateUser(
          "test@example.com",
          "wrongpassword",
          "test-tenant",
        ),
      ).rejects.toThrow("Invalid credentials");
    });
  });

  describe("login", () => {
    it("should return login response with session and cookie", async () => {
      tenantsService.findBySlug.mockResolvedValue(mockTenant);
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      sessionService.createSession.mockResolvedValue({
        session: mockSession,
        cookie: "session-cookie-serialized",
      });

      const result = await service.login(
        "test@example.com",
        "password123",
        "test-tenant",
        "127.0.0.1",
        "Mozilla/5.0",
      );

      expect(result).toEqual({
        success: true,
        data: {
          user: {
            id: mockUser.id,
            email: mockUser.email,
            name: mockUser.name,
            role: mockUser.role,
            tenantId: mockUser.tenantId,
            avatarUrl: mockUser.avatarUrl,
          },
          session: {
            id: mockSession.id,
            expiresAt: mockSession.expiresAt,
          },
          cookie: "session-cookie-serialized",
        },
        message: "Login successful",
      });
      expect(sessionService.createSession).toHaveBeenCalledWith(
        mockUser.id,
        "127.0.0.1",
        "Mozilla/5.0",
      );
    });

    it("should throw UnauthorizedException when validation fails", async () => {
      tenantsService.findBySlug.mockResolvedValue(null);

      await expect(
        service.login("test@example.com", "password123", "invalid-tenant"),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("superadminLogin", () => {
    const mockSuperadmin = {
      id: "sa-1",
      email: "superadmin@chefchek.io",
      passwordHash: "hashedPassword",
      name: "ChefChek Superadmin",
      role: "SUPERADMIN" as const,
      tenantId: null,
      isActive: true,
      avatarUrl: null,
    };

    it("should login SUPERADMIN without tenantSlug and return tenantId null", async () => {
      usersService.findSuperadminByEmail.mockResolvedValue(mockSuperadmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      sessionService.createSession.mockResolvedValue({
        session: mockSession,
        cookie: "session-cookie-serialized",
      });

      const result = await service.superadminLogin(
        "superadmin@chefchek.io",
        "password123",
        "127.0.0.1",
        "Mozilla/5.0",
      );

      expect(usersService.findSuperadminByEmail).toHaveBeenCalledWith(
        "superadmin@chefchek.io",
      );
      expect(result).toEqual({
        success: true,
        data: {
          user: {
            id: mockSuperadmin.id,
            email: mockSuperadmin.email,
            name: mockSuperadmin.name,
            role: mockSuperadmin.role,
            tenantId: null,
          },
          session: {
            id: mockSession.id,
            expiresAt: mockSession.expiresAt,
          },
          cookie: "session-cookie-serialized",
        },
        message: "Login successful",
      });
      expect(sessionService.createSession).toHaveBeenCalledWith(
        mockSuperadmin.id,
        "127.0.0.1",
        "Mozilla/5.0",
      );
    });

    it("should reject when user is not found", async () => {
      usersService.findSuperadminByEmail.mockResolvedValue(null);

      await expect(
        service.superadminLogin("superadmin@chefchek.io", "password123"),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.superadminLogin("superadmin@chefchek.io", "password123"),
      ).rejects.toThrow("Invalid credentials");
    });

    it("should reject when found user role is not SUPERADMIN", async () => {
      usersService.findSuperadminByEmail.mockResolvedValue({
        ...mockSuperadmin,
        role: "OWNER" as const,
      });

      await expect(
        service.superadminLogin("superadmin@chefchek.io", "password123"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should reject when account is inactive", async () => {
      usersService.findSuperadminByEmail.mockResolvedValue({
        ...mockSuperadmin,
        isActive: false,
      });

      await expect(
        service.superadminLogin("superadmin@chefchek.io", "password123"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should reject when password is invalid", async () => {
      usersService.findSuperadminByEmail.mockResolvedValue(mockSuperadmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.superadminLogin("superadmin@chefchek.io", "wrongpassword"),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.superadminLogin("superadmin@chefchek.io", "wrongpassword"),
      ).rejects.toThrow("Invalid credentials");
    });
  });

  describe("logout", () => {
    it("should return logout response with cookie", async () => {
      sessionService.invalidateSession.mockResolvedValue({
        cookie: "blank-session-cookie",
      });

      const result = await service.logout("session-123");

      expect(result).toEqual({
        success: true,
        data: { cookie: "blank-session-cookie" },
        message: "Logout successful",
      });
      expect(sessionService.invalidateSession).toHaveBeenCalledWith(
        "session-123",
      );
    });
  });

  describe("validateSession", () => {
    it("should return valid session with user", async () => {
      sessionService.validateSession.mockResolvedValue({
        valid: true,
        user: mockUser,
        session: mockSession,
      });

      const result = await service.validateSession("session-123");

      expect(result).toEqual({
        valid: true,
        user: mockUser,
      });
      expect(sessionService.validateSession).toHaveBeenCalledWith(
        "session-123",
      );
    });

    it("should throw UnauthorizedException when session is invalid", async () => {
      sessionService.validateSession.mockResolvedValue({
        valid: false,
        user: null,
        session: null,
      });

      await expect(service.validateSession("invalid-session")).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateSession("invalid-session")).rejects.toThrow(
        "Invalid or expired session",
      );
    });

    it("should throw UnauthorizedException when user is null", async () => {
      sessionService.validateSession.mockResolvedValue({
        valid: true,
        user: null,
        session: mockSession,
      });

      await expect(service.validateSession("session-123")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("register", () => {
    const newUser = {
      id: "new-user-123",
      email: "new@example.com",
      name: "New User",
      role: "USER" as const,
      isActive: true,
      avatarUrl: null,
      street: null,
      city: null,
      phone: null,
      whatsapp: null,
      payrollEmail: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should register a new user successfully", async () => {
      tenantsService.findBySlug.mockResolvedValue(mockTenant);
      usersService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue("newHashedPassword");
      usersService.create.mockResolvedValue({
        success: true,
        data: newUser,
        message: "User created successfully",
      });

      const result = await service.register(
        "new@example.com",
        "password123",
        "New User",
        "test-tenant",
      );

      expect(result).toEqual({
        success: true,
        data: newUser,
        message: "Registration successful",
      });
      expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);
      expect(usersService.create).toHaveBeenCalledWith(
        {
          email: "new@example.com",
          password: "newHashedPassword",
          name: "New User",
          role: "USER",
          tenantId: "tenant-123",
        },
        "tenant-123",
      );
    });

    it("should register a user with custom role", async () => {
      tenantsService.findBySlug.mockResolvedValue(mockTenant);
      usersService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue("newHashedPassword");
      usersService.create.mockResolvedValue({
        success: true,
        data: { ...newUser, role: "ADMIN" },
        message: "User created successfully",
      });

      await service.register(
        "admin@example.com",
        "password123",
        "Admin User",
        "test-tenant",
        "ADMIN",
      );

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: "ADMIN" }),
        "tenant-123",
      );
    });

    it("should throw BadRequestException when tenant not found", async () => {
      tenantsService.findBySlug.mockResolvedValue(null);

      await expect(
        service.register(
          "new@example.com",
          "password123",
          "New User",
          "invalid-tenant",
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.register(
          "new@example.com",
          "password123",
          "New User",
          "invalid-tenant",
        ),
      ).rejects.toThrow("Tenant not found or inactive");
    });

    it("should throw BadRequestException when tenant is inactive", async () => {
      tenantsService.findBySlug.mockResolvedValue({
        ...mockTenant,
        isActive: false,
      });

      await expect(
        service.register(
          "new@example.com",
          "password123",
          "New User",
          "test-tenant",
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.register(
          "new@example.com",
          "password123",
          "New User",
          "test-tenant",
        ),
      ).rejects.toThrow("Tenant not found or inactive");
    });

    it("should throw BadRequestException when user already exists", async () => {
      tenantsService.findBySlug.mockResolvedValue(mockTenant);
      usersService.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register(
          "test@example.com",
          "password123",
          "Test User",
          "test-tenant",
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.register(
          "test@example.com",
          "password123",
          "Test User",
          "test-tenant",
        ),
      ).rejects.toThrow("User already exists");
    });
  });

  describe("refreshSession", () => {
    it("should refresh session successfully", async () => {
      const newSession = {
        id: "new-session-123",
        userId: "user-123",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0",
        createdAt: new Date(),
      };

      sessionService.refreshSession.mockResolvedValue({
        session: newSession,
        cookie: "new-session-cookie",
      });

      const result = await service.refreshSession(
        "session-123",
        "127.0.0.1",
        "Mozilla/5.0",
      );

      expect(result).toEqual({
        success: true,
        data: {
          id: newSession.id,
          expiresAt: newSession.expiresAt,
          cookie: "new-session-cookie",
        },
      });
      expect(sessionService.refreshSession).toHaveBeenCalledWith(
        "session-123",
        "127.0.0.1",
        "Mozilla/5.0",
      );
    });

    it("should throw UnauthorizedException when refresh fails", async () => {
      sessionService.refreshSession.mockRejectedValue(
        new Error("Invalid session"),
      );

      await expect(service.refreshSession("invalid-session")).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshSession("invalid-session")).rejects.toThrow(
        "Invalid or expired session",
      );
    });
  });

  describe("getUserActiveSessions", () => {
    it("should return user active sessions", async () => {
      const sessions = [
        {
          id: "session-1",
          userId: "user-123",
          expiresAt: new Date(),
          fresh: true,
        },
        {
          id: "session-2",
          userId: "user-123",
          expiresAt: new Date(),
          fresh: true,
        },
      ];

      sessionService.getUserActiveSessions.mockResolvedValue(sessions as any);

      const result = await service.getUserActiveSessions(
        "user-123",
        "tenant-123",
      );

      expect(result).toEqual({
        success: true,
        data: sessions,
      });
      expect(sessionService.getUserActiveSessions).toHaveBeenCalledWith(
        "user-123",
        "tenant-123",
      );
    });

    it("should return user active sessions without tenant filter", async () => {
      const sessions = [
        {
          id: "session-1",
          userId: "user-123",
          expiresAt: new Date(),
          fresh: true,
        },
      ];

      sessionService.getUserActiveSessions.mockResolvedValue(sessions as any);

      const result = await service.getUserActiveSessions("user-123");

      expect(result).toEqual({
        success: true,
        data: sessions,
      });
      expect(sessionService.getUserActiveSessions).toHaveBeenCalledWith(
        "user-123",
        undefined,
      );
    });
  });

  describe("invalidateAllUserSessions", () => {
    it("should invalidate all user sessions", async () => {
      sessionService.invalidateAllUserSessions.mockResolvedValue({
        success: true,
        message: "All sessions invalidated",
      });

      const result = await service.invalidateAllUserSessions(
        "user-123",
        "tenant-123",
      );

      expect(result).toEqual({
        success: true,
        data: {
          success: true,
          message: "All sessions invalidated",
        },
      });
      expect(sessionService.invalidateAllUserSessions).toHaveBeenCalledWith(
        "user-123",
      );
    });

    it("should invalidate all user sessions without tenant filter", async () => {
      sessionService.invalidateAllUserSessions.mockResolvedValue({
        success: true,
        message: "All sessions invalidated",
      });

      const result = await service.invalidateAllUserSessions("user-123");

      expect(result).toEqual({
        success: true,
        data: {
          success: true,
          message: "All sessions invalidated",
        },
      });
    });
  });
});
