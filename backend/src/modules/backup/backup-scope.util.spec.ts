import { buildScopeClause } from "./backup-scope.util";
import { BackupIntrospectionService } from "./backup-introspection.service";

describe("buildScopeClause", () => {
  // Tabla hija sin tenantId: solo entra en un backup de tenant si tiene regla
  // de padre; sin ella se salta y al restaurar el padre se pierde en cascada.
  const introspection = {
    hasColumn: jest.fn().mockResolvedValue(false),
  } as unknown as BackupIntrospectionService;

  it("scopes recipe_capture_ingredients through its parent capture", async () => {
    const result = await buildScopeClause(
      introspection,
      "recipe_capture_ingredients",
      "TENANT",
      "tenant-1",
    );

    expect(result).toEqual({
      skip: false,
      whereText:
        '"captureId" IN (SELECT id FROM "recipe_captures" WHERE "tenantId" = $1)',
      params: ["tenant-1"],
    });
  });

  it("skips a child table that has no scope rule", async () => {
    const result = await buildScopeClause(
      introspection,
      "tabla_sin_regla",
      "TENANT",
      "tenant-1",
    );

    expect(result.skip).toBe(true);
  });
});
