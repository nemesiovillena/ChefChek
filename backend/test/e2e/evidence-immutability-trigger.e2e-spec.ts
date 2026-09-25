import { PrismaClient } from "@prisma/client";

/**
 * Fase 1 SICTED — prueba las funciones `forbid_mutation()` y
 * `forbid_mutation_after_seal()` (migración `immutability_guard`) contra
 * Postgres real. Como ninguna tabla `checklist_*`/`sicted_*` existe todavía
 * (llegan en fases 2+), se crean dos tablas desechables en `beforeAll` y se
 * borran en `afterAll`, con el trigger adjunto igual que lo hará cada
 * migración de dominio futura: `CREATE TRIGGER ... EXECUTE FUNCTION
 * forbid_mutation()`.
 */
describe("E2E - Evidence immutability trigger (fase 1)", () => {
  const prisma = new PrismaClient();
  const plainTable = "e2e_forbid_mutation_scratch";
  const sealedTable = "e2e_forbid_mutation_after_seal_scratch";

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      `CREATE TABLE "${plainTable}" (id text PRIMARY KEY, note text)`,
    );
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER trg_forbid_mutation
        BEFORE UPDATE OR DELETE ON "${plainTable}"
        FOR EACH ROW EXECUTE FUNCTION forbid_mutation()
    `);
    await prisma.$executeRawUnsafe(
      `CREATE TABLE "${sealedTable}" (id text PRIMARY KEY, "supervisedAt" timestamptz)`,
    );
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER trg_forbid_mutation_after_seal
        BEFORE UPDATE OR DELETE ON "${sealedTable}"
        FOR EACH ROW EXECUTE FUNCTION forbid_mutation_after_seal()
    `);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${plainTable}"`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${sealedTable}"`);
    await prisma.$disconnect();
  });

  it("forbid_mutation: permite INSERT", async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "${plainTable}" (id, note) VALUES ('r1', 'a')`,
      ),
    ).resolves.toBeDefined();
  });

  it("forbid_mutation: bloquea UPDATE", async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "${plainTable}" SET note = 'b' WHERE id = 'r1'`,
      ),
    ).rejects.toThrow();
  });

  it("forbid_mutation: bloquea DELETE", async () => {
    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM "${plainTable}" WHERE id = 'r1'`),
    ).rejects.toThrow();
  });

  it("forbid_mutation: el escape SET LOCAL permite UPDATE y DELETE", async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL chefchek.allow_evidence_purge = 'on'`,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "${plainTable}" SET note = 'c' WHERE id = 'r1'`,
      );
      await tx.$executeRawUnsafe(`DELETE FROM "${plainTable}" WHERE id = 'r1'`);
    });
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "${plainTable}" WHERE id = 'r1'`,
    );
    expect(rows).toHaveLength(0);
  });

  it("forbid_mutation_after_seal: permite UPDATE mientras supervisedAt es NULL", async () => {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${sealedTable}" (id, "supervisedAt") VALUES ('s1', NULL)`,
    );
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "${sealedTable}" SET "supervisedAt" = "supervisedAt" WHERE id = 's1'`,
      ),
    ).resolves.toBeDefined();
  });

  it("forbid_mutation_after_seal: sellar la fila y luego bloquear UPDATE", async () => {
    await prisma.$executeRawUnsafe(
      `UPDATE "${sealedTable}" SET "supervisedAt" = now() WHERE id = 's1'`,
    );
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "${sealedTable}" SET "supervisedAt" = NULL WHERE id = 's1'`,
      ),
    ).rejects.toThrow();
  });

  it("forbid_mutation_after_seal: bloquea DELETE incluso antes de sellar", async () => {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${sealedTable}" (id, "supervisedAt") VALUES ('s2', NULL)`,
    );
    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM "${sealedTable}" WHERE id = 's2'`),
    ).rejects.toThrow();
  });
});
