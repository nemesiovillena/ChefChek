import { ForbiddenException } from "@nestjs/common";
import { CuinerTenantRequiredGuard } from "./cuiner-tenant-required.guard";

const context = (request: Record<string, unknown>) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as never;

describe("CuinerTenantRequiredGuard", () => {
  const guard = new CuinerTenantRequiredGuard();

  it("rechaza con 403 al superadministrador sin restaurante", () => {
    expect(() =>
      guard.canActivate(context({ user: { role: "SUPERADMIN" } })),
    ).toThrow(ForbiddenException);
  });

  it("deja pasar a un usuario con restaurante", () => {
    expect(guard.canActivate(context({ tenantId: "t1" }))).toBe(true);
  });
});
