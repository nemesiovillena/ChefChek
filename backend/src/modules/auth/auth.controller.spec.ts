import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";

describe("AuthController", () => {
  let controller: AuthController;

  const mockAuthService = {
    login: jest.fn(),
    logout: jest.fn(),
    validateSession: jest.fn(),
    refreshSession: jest.fn(),
    getUserActiveSessions: jest.fn(),
    invalidateAllUserSessions: jest.fn(),
  };

  const mockReq = {
    ip: "127.0.0.1",
    connection: { remoteAddress: "127.0.0.1" },
    headers: {
      "user-agent": "test-agent",
      "x-tenant-slug": "test-tenant",
    },
    tenantSlug: "test-tenant",
    tenantId: "tenant-1",
    user: { id: "user-1", role: "ADMIN" },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("login", () => {
    it("should return error when tenant slug is missing", async () => {
      const loginDto: LoginDto = {
        email: "test@test.com",
        password: "password",
      };
      const reqWithoutTenant = {
        ...mockReq,
        tenantSlug: undefined,
        headers: {},
      };

      const result = await controller.login(loginDto, reqWithoutTenant as any);

      expect(result).toEqual({
        success: false,
        error: {
          code: "TENANT_REQUIRED",
          message: "X-Tenant-Slug header is required",
        },
      });
    });

    it("should call authService.login with correct parameters", async () => {
      const loginDto: LoginDto = {
        email: "test@test.com",
        password: "password",
      };
      const mockLoginResult = {
        success: true,
        data: {
          user: { id: "user-1", email: "test@test.com" },
          session: { id: "session-1" },
        },
      };

      mockAuthService.login.mockResolvedValue(mockLoginResult);

      const result = await controller.login(loginDto, mockReq as any);

      expect(mockAuthService.login).toHaveBeenCalledWith(
        "test@test.com",
        "password",
        "test-tenant",
        "127.0.0.1",
        "test-agent",
      );
      expect(result).toEqual(mockLoginResult);
    });

    it("should use connection remoteAddress when ip is not available", async () => {
      const loginDto: LoginDto = {
        email: "test@test.com",
        password: "password",
      };
      const reqWithoutIp = {
        ...mockReq,
        ip: undefined,
        connection: { remoteAddress: "192.168.1.1" },
      };

      mockAuthService.login.mockResolvedValue({ success: true });

      await controller.login(loginDto, reqWithoutIp as any);

      expect(mockAuthService.login).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        "192.168.1.1",
        expect.any(String),
      );
    });
  });

  describe("logout", () => {
    it("should call authService.logout with sessionId", async () => {
      const mockLogoutResult = { success: true, message: "Logout successful" };
      mockAuthService.logout.mockResolvedValue(mockLogoutResult);

      const result = await controller.logout({ sessionId: "session-1" });

      expect(mockAuthService.logout).toHaveBeenCalledWith("session-1");
      expect(result).toEqual(mockLogoutResult);
    });
  });

  describe("refresh", () => {
    it("should call authService.refreshSession with correct parameters", async () => {
      const mockRefreshResult = {
        success: true,
        data: { id: "session-1", expiresAt: new Date() },
      };
      mockAuthService.refreshSession.mockResolvedValue(mockRefreshResult);

      const result = await controller.refresh(
        { sessionId: "session-1" },
        mockReq as any,
      );

      expect(mockAuthService.refreshSession).toHaveBeenCalledWith(
        "session-1",
        "127.0.0.1",
        "test-agent",
      );
      expect(result).toEqual(mockRefreshResult);
    });
  });

  describe("validate", () => {
    it("should return error when no session provided", async () => {
      const reqWithoutAuth = { headers: {} };

      const result = await controller.validate(reqWithoutAuth as any);

      expect(result).toEqual({
        success: false,
        error: {
          code: "NO_SESSION",
          message: "No session provided",
        },
      });
    });

    it("should return error for invalid session", async () => {
      const reqWithAuth = { headers: { authorization: "Bearer session-1" } };
      mockAuthService.validateSession.mockResolvedValue({ valid: false });

      const result = await controller.validate(reqWithAuth as any);

      expect(mockAuthService.validateSession).toHaveBeenCalledWith("session-1");
      expect(result).toEqual({
        success: false,
        error: {
          code: "INVALID_SESSION",
          message: "Invalid or expired session",
        },
      });
    });

    it("should return success for valid session", async () => {
      const reqWithAuth = { headers: { authorization: "Bearer session-1" } };
      const mockUser = { id: "user-1", email: "test@test.com" };
      mockAuthService.validateSession.mockResolvedValue({
        valid: true,
        user: mockUser,
      });

      const result = await controller.validate(reqWithAuth as any);

      expect(result).toEqual({
        success: true,
        data: { user: mockUser, isValid: true },
        message: "Session is valid",
      });
    });
  });

  describe("getUserSessions", () => {
    it("should return error when user not authenticated", async () => {
      const reqWithoutUser = { user: undefined, tenantId: undefined };

      const result = await controller.getUserSessions(reqWithoutUser as any);

      expect(result).toEqual({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        },
      });
    });

    it("should call authService.getUserActiveSessions with correct parameters", async () => {
      const mockSessions = [{ id: "session-1" }, { id: "session-2" }];
      mockAuthService.getUserActiveSessions.mockResolvedValue({
        success: true,
        data: mockSessions,
      });

      const result = await controller.getUserSessions(mockReq as any);

      expect(mockAuthService.getUserActiveSessions).toHaveBeenCalledWith(
        "user-1",
        "tenant-1",
      );
      expect(result).toEqual({ success: true, data: mockSessions });
    });
  });

  describe("invalidateSession", () => {
    it("should call authService.logout with sessionId", async () => {
      mockAuthService.logout.mockResolvedValue({ success: true });

      const result = await controller.invalidateSession(
        "session-1",
        mockReq as any,
      );

      expect(mockAuthService.logout).toHaveBeenCalledWith("session-1");
      expect(result).toEqual({ success: true });
    });
  });

  describe("invalidateAllSessions", () => {
    it("should return error when user not authenticated", async () => {
      const reqWithoutUser = { user: undefined, tenantId: undefined };

      const result = await controller.invalidateAllSessions(
        reqWithoutUser as any,
      );

      expect(result).toEqual({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        },
      });
    });

    it("should call authService.invalidateAllUserSessions with correct parameters", async () => {
      mockAuthService.invalidateAllUserSessions.mockResolvedValue({
        success: true,
      });

      const result = await controller.invalidateAllSessions(mockReq as any);

      expect(mockAuthService.invalidateAllUserSessions).toHaveBeenCalledWith(
        "user-1",
        "tenant-1",
      );
      expect(result).toEqual({ success: true });
    });
  });
});
