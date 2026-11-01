import { ForbiddenException } from "@nestjs/common";
import { CorreoAccessGuard } from "./correo-access.guard";

function ctx(req: any): any {
  return { switchToHttp: () => ({ getRequest: () => req }) };
}

describe("CorreoAccessGuard", () => {
  let modules: any;
  let guard: CorreoAccessGuard;

  beforeEach(() => {
    modules = { isModuleEnabled: jest.fn().mockResolvedValue(true) };
    guard = new CorreoAccessGuard(modules);
  });

  it("SUPERADMIN siempre 403, aunque traiga tenant", async () => {
    await expect(
      guard.canActivate(ctx({ user: { role: "SUPERADMIN" }, tenantId: "t1" })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(modules.isModuleEnabled).not.toHaveBeenCalled();
  });

  it("sin tenant → 403", async () => {
    await expect(
      guard.canActivate(ctx({ user: { role: "ADMIN" } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("módulo desactivado → 403 también para ADMIN", async () => {
    modules.isModuleEnabled.mockResolvedValue(false);
    await expect(
      guard.canActivate(ctx({ user: { role: "ADMIN" }, tenantId: "t1" })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("módulo activo y rol de tenant → pasa", async () => {
    await expect(
      guard.canActivate(ctx({ user: { role: "USER" }, tenantId: "t1" })),
    ).resolves.toBe(true);
    expect(modules.isModuleEnabled).toHaveBeenCalledWith("t1", "correo");
  });
});
