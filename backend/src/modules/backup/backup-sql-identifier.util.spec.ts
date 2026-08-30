import { quoteSqlIdent } from "./backup-sql-identifier.util";

describe("quoteSqlIdent", () => {
  it("entrecomilla identificadores válidos", () => {
    expect(quoteSqlIdent("products")).toBe('"products"');
    expect(quoteSqlIdent("tenantId")).toBe('"tenantId"');
    expect(quoteSqlIdent("_prisma_migrations")).toBe('"_prisma_migrations"');
  });

  it("rechaza nombres con caracteres peligrosos o vacíos", () => {
    for (const bad of [
      "",
      "products; DROP TABLE users",
      'a" OR "1"="1',
      "table name",
      "1abc",
      "público",
    ]) {
      expect(() => quoteSqlIdent(bad)).toThrow(/Identificador SQL no válido/);
    }
  });
});
