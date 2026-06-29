import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { TenantGuard } from "./tenant.guard";

describe("TenantGuard", () => {
  let guard: TenantGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantGuard],
    }).compile();
    guard = module.get<TenantGuard>(TenantGuard);
  });

  const buildContext = (requestMock: any) => {
    return {
      switchToHttp: () => ({
        getRequest: () => requestMock,
      }),
    } as unknown as ExecutionContext;
  };

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  it("should return true if tenantId is already present on request", () => {
    const request = { tenantId: "t-123" };
    const context = buildContext(request);

    expect(guard.canActivate(context)).toBe(true);
    expect(request.tenantId).toBe("t-123");
  });

  it("should copy tenantId from user to request and return true if request.tenantId is missing but user.tenantId exists", () => {
    const request = { user: { tenantId: "t-456" } } as any;
    const context = buildContext(request);

    expect(guard.canActivate(context)).toBe(true);
    expect(request.tenantId).toBe("t-456");
  });

  it("should throw ForbiddenException if both request.tenantId and user.tenantId are missing", () => {
    const request1 = {};
    const context1 = buildContext(request1);
    expect(() => guard.canActivate(context1)).toThrow(
      new ForbiddenException("Tenant context is required"),
    );

    const request2 = { user: {} };
    const context2 = buildContext(request2);
    expect(() => guard.canActivate(context2)).toThrow(
      new ForbiddenException("Tenant context is required"),
    );
  });
});
