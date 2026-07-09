import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ModuleGuard, RequireModule } from "./module.guard";
import { ModulesService } from "../modules/modules/modules.service";

describe("ModuleGuard", () => {
  let guard: ModuleGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let modulesService: { isModuleEnabled: jest.Mock };

  beforeEach(async () => {
    reflector = { getAllAndOverride: jest.fn() };
    modulesService = { isModuleEnabled: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModuleGuard,
        { provide: Reflector, useValue: reflector },
        { provide: ModulesService, useValue: modulesService },
      ],
    }).compile();
    guard = module.get<ModuleGuard>(ModuleGuard);
  });

  afterEach(() => jest.clearAllMocks());

  const buildContext = (user: any, tenantId?: string) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user, tenantId }),
      }),
    }) as unknown as ExecutionContext;

  it("allows access when no module is required (no metadata)", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(
      guard.canActivate(buildContext({ id: "u1", role: "USER" }, "t1")),
    ).resolves.toBe(true);
    expect(modulesService.isModuleEnabled).not.toHaveBeenCalled();
  });

  it("allows SUPERADMIN regardless of module state", async () => {
    reflector.getAllAndOverride.mockReturnValue("appcc");
    await expect(
      guard.canActivate(buildContext({ id: "su", role: "SUPERADMIN" }, "t1")),
    ).resolves.toBe(true);
    expect(modulesService.isModuleEnabled).not.toHaveBeenCalled();
  });

  it("allows access when the module is enabled for the tenant", async () => {
    reflector.getAllAndOverride.mockReturnValue("appcc");
    modulesService.isModuleEnabled.mockResolvedValue(true);
    await expect(
      guard.canActivate(buildContext({ id: "u1", role: "USER" }, "t1")),
    ).resolves.toBe(true);
    expect(modulesService.isModuleEnabled).toHaveBeenCalledWith("t1", "appcc");
  });

  it("throws Forbidden when the module is disabled for the tenant", async () => {
    reflector.getAllAndOverride.mockReturnValue("appcc");
    modulesService.isModuleEnabled.mockResolvedValue(false);
    await expect(
      guard.canActivate(buildContext({ id: "u1", role: "USER" }, "t1")),
    ).rejects.toThrow(ForbiddenException);
    expect(modulesService.isModuleEnabled).toHaveBeenCalledWith("t1", "appcc");
  });

  it("throws Forbidden when no tenant context is available", async () => {
    reflector.getAllAndOverride.mockReturnValue("appcc");
    await expect(
      guard.canActivate(buildContext({ id: "u1", role: "USER" }, undefined)),
    ).rejects.toThrow(ForbiddenException);
    expect(modulesService.isModuleEnabled).not.toHaveBeenCalled();
  });

  it("falls back to user.tenantId when request.tenantId is unset", async () => {
    reflector.getAllAndOverride.mockReturnValue("recipes");
    modulesService.isModuleEnabled.mockResolvedValue(true);
    await expect(
      guard.canActivate(
        buildContext(
          { id: "u1", role: "USER", tenantId: "fromUser" },
          undefined,
        ),
      ),
    ).resolves.toBe(true);
    expect(modulesService.isModuleEnabled).toHaveBeenCalledWith(
      "fromUser",
      "recipes",
    );
  });

  describe("RequireModule decorator", () => {
    it("builds a decorator function", () => {
      expect(typeof RequireModule("appcc")).toBe("function");
    });
  });
});
