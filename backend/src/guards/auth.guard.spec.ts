import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { SessionService } from "../modules/auth/session.service";

describe("AuthGuard", () => {
  let guard: AuthGuard;
  let sessionService: { validateSession: jest.Mock };

  beforeEach(async () => {
    sessionService = { validateSession: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: SessionService, useValue: sessionService },
      ],
    }).compile();
    guard = module.get<AuthGuard>(AuthGuard);
  });

  const buildContext = (headers: Record<string, string>) => {
    const req = {
      headers,
      user: undefined,
      sessionId: undefined,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as unknown as ExecutionContext;
  };

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  it("should throw UnauthorizedException if Authorization header is missing", async () => {
    const context = buildContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException("Authorization header is required"),
    );
  });

  it("should throw UnauthorizedException if Authorization header format is invalid (empty session ID)", async () => {
    const context = buildContext({ authorization: "Bearer " });
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException("Invalid authorization header format"),
    );
  });

  it("should throw UnauthorizedException if session is invalid", async () => {
    const context = buildContext({ authorization: "Bearer invalid-session" });
    sessionService.validateSession.mockResolvedValue({ valid: false });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException("Invalid or expired session"),
    );
    expect(sessionService.validateSession).toHaveBeenCalledWith(
      "invalid-session",
    );
  });

  it("should throw UnauthorizedException if session is valid but user is missing", async () => {
    const context = buildContext({ authorization: "Bearer valid-session" });
    sessionService.validateSession.mockResolvedValue({
      valid: true,
      user: null,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException("Invalid or expired session"),
    );
  });

  it("should attach user and sessionId to request and return true for valid session", async () => {
    const context = buildContext({ authorization: "Bearer valid-session" });
    const mockUser = { id: "u-1", email: "user@chefchek.com", tenantId: "t-1" };
    sessionService.validateSession.mockResolvedValue({
      valid: true,
      user: mockUser,
    });

    const request = context.switchToHttp().getRequest() as any;
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual(mockUser);
    expect(request.sessionId).toBe("valid-session");
    expect(sessionService.validateSession).toHaveBeenCalledWith(
      "valid-session",
    );
  });
});
