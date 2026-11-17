import { UserRole } from "@prisma/client";
import { roleCanPunch } from "./punch-roles.util";

describe("roleCanPunch", () => {
  it("lets employees without an account and plain users punch", () => {
    expect(roleCanPunch(null)).toBe(true);
    expect(roleCanPunch(undefined)).toBe(true);
    expect(roleCanPunch(UserRole.USER)).toBe(true);
  });

  it("keeps management, office and Cuiner roles out of punching", () => {
    for (const role of [
      UserRole.SUPERADMIN,
      UserRole.OWNER,
      UserRole.ADMIN,
      UserRole.GESTION,
      UserRole.USER_CUINER,
    ]) {
      expect(roleCanPunch(role)).toBe(false);
    }
  });
});
