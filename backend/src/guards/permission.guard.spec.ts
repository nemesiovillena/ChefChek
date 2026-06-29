import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionGuard, RequirePermissions } from "./permission.guard";
import { PermissionsService } from "../modules/auth/permissions.service";

describe("PermissionGuard", () => {
  let guard: PermissionGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let permissionsService: { hasAllPermissions: jest.Mock };

  beforeEach(async () => {
    reflector = { getAllAndOverride: jest.fn() };
    permissionsService = { hasAllPermissions: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionGuard,
        { provide: Reflector, useValue: reflector },
        { provide: PermissionsService, useValue: permissionsService },
      ],
    }).compile();
    guard = module.get<PermissionGuard>(PermissionGuard);
  });

  afterEach(() => jest.clearAllMocks());

  const buildContext = (user: any) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  it("allows access when no permissions are required", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(buildContext({ id: "u1" }))).resolves.toBe(
      true,
    );
    expect(permissionsService.hasAllPermissions).not.toHaveBeenCalled();
  });

  it("allows access when the required permissions list is empty", async () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    await expect(guard.canActivate(buildContext({ id: "u1" }))).resolves.toBe(
      true,
    );
  });

  it("throws Forbidden when no user is present", async () => {
    reflector.getAllAndOverride.mockReturnValue(["products:create"]);
    await expect(guard.canActivate(buildContext(null))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("throws Forbidden when the user lacks a required permission", async () => {
    reflector.getAllAndOverride.mockReturnValue(["products:create"]);
    permissionsService.hasAllPermissions.mockResolvedValue(false);
    await expect(guard.canActivate(buildContext({ id: "u1" }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("allows access when the user has all required permissions", async () => {
    reflector.getAllAndOverride.mockReturnValue(["products:create"]);
    permissionsService.hasAllPermissions.mockResolvedValue(true);
    await expect(guard.canActivate(buildContext({ id: "u1" }))).resolves.toBe(
      true,
    );
    expect(permissionsService.hasAllPermissions).toHaveBeenCalledWith("u1", [
      "products:create",
    ]);
  });

  describe("permission decorator factories", () => {
    it("build RequirePermissions and resource helpers without error", () => {
      // SetMetadata returns a decorator function, not a plain object
      expect(typeof RequirePermissions("a", "b")).toBe("function");
    });
  });
});
