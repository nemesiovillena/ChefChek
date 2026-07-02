import { Test, TestingModule } from "@nestjs/testing";
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { SuperadminGuard } from "./superadmin.guard";

describe("SuperadminGuard", () => {
  let guard: SuperadminGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SuperadminGuard],
    }).compile();
    guard = module.get<SuperadminGuard>(SuperadminGuard);
  });

  const buildContext = (requestMock: any) =>
    ({
      switchToHttp: () => ({ getRequest: () => requestMock }),
    }) as unknown as ExecutionContext;

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  it("should allow access for SUPERADMIN role", () => {
    const context = buildContext({
      user: { id: "sa-1", role: "SUPERADMIN" },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it("should reject OWNER role with ForbiddenException", () => {
    const context = buildContext({
      user: { id: "owner-1", role: "OWNER" },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(
      "Solo SUPERADMIN puede acceder a esta operación.",
    );
  });

  it("should reject ADMIN role with ForbiddenException", () => {
    const context = buildContext({
      user: { id: "admin-1", role: "ADMIN" },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("should reject unauthenticated request with UnauthorizedException", () => {
    const context = buildContext({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow("User not authenticated");
  });
});
