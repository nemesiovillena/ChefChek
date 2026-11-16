import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ReadOnlyRolesGuard } from "./read-only-roles.guard";

function contextFor(method: string, role?: string): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ method, user: role ? { role } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe("ReadOnlyRolesGuard", () => {
  const reflector = new Reflector();
  const guard = new ReadOnlyRolesGuard(reflector);

  beforeEach(() => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["GESTION"]);
  });

  it("deja consultar al rol de solo lectura", () => {
    expect(guard.canActivate(contextFor("GET", "GESTION"))).toBe(true);
  });

  it.each(["POST", "PATCH", "PUT", "DELETE"])(
    "le impide escribir con %s",
    (method) => {
      expect(() => guard.canActivate(contextFor(method, "GESTION"))).toThrow(
        ForbiddenException,
      );
    },
  );

  it("no afecta a otros roles", () => {
    expect(guard.canActivate(contextFor("POST", "USER"))).toBe(true);
    expect(guard.canActivate(contextFor("DELETE", "ADMIN"))).toBe(true);
  });

  it("deja escribir en un handler marcado con AllowWriteForRoles", () => {
    jest.spyOn(reflector, "get").mockReturnValue(["GESTION"]);
    expect(guard.canActivate(contextFor("POST", "GESTION"))).toBe(true);
    jest.spyOn(reflector, "get").mockReturnValue(undefined);
  });

  it("sin metadatos no hace nada", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(undefined);
    expect(guard.canActivate(contextFor("POST", "GESTION"))).toBe(true);
  });
});
