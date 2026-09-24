import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../src/common/services/prisma.service";
import { BackupIntrospectionService } from "../../src/modules/backup/backup-introspection.service";
import { BackupProgressRegistry } from "../../src/modules/backup/backup-progress.registry";
import { BackupRestoreService } from "../../src/modules/backup/backup-restore.service";
import { BackupPayload } from "../../src/modules/backup/dto/backup.dto";

/**
 * Fase 1 SICTED — integración real (Postgres): prueba que
 * `BackupRestoreService.run()` respeta el trigger `forbid_mutation` contra
 * una tabla de evidencia real (no solo con mocks, ver
 * backup-restore.service.spec.ts): sin `includeEvidenceTables`, la tabla
 * jamás se toca; con `includeEvidenceTables: true`, activa el escape `SET
 * LOCAL` y el DELETE+INSERT tienen éxito pese al trigger.
 */
describe("E2E - BackupRestoreService respeta el trigger de evidencia", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let restoreService: BackupRestoreService;
  const table = "checklist_e2e_restore_scratch"; // prefijo checklist_ -> isEvidenceTable=true

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        BackupRestoreService,
        BackupIntrospectionService,
        PrismaService,
        {
          provide: BackupProgressRegistry,
          useValue: { set: jest.fn() },
        },
      ],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    restoreService = moduleRef.get(BackupRestoreService);

    await prisma.$executeRawUnsafe(
      `CREATE TABLE "${table}" (id text PRIMARY KEY, note text)`,
    );
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER trg_forbid_mutation
        BEFORE UPDATE OR DELETE ON "${table}"
        FOR EACH ROW EXECUTE FUNCTION forbid_mutation()
    `);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${table}" (id, note) VALUES ('pre', 'existing')`,
    );
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${table}"`);
    await prisma.$disconnect();
    await moduleRef.close();
  });

  function payload(): BackupPayload {
    return {
      meta: {
        schemaVersion: 1,
        app: "chefchek",
        exportedAt: new Date().toISOString(),
        scope: "GLOBAL",
        tenantId: null,
        counts: { [table]: 1 },
      },
      data: { [table]: [{ id: "restored", note: "from backup" }] },
    } as BackupPayload;
  }

  it("por defecto NO toca la tabla de evidencia (la fila previa sigue igual)", async () => {
    await restoreService.run("job-default", payload(), "GLOBAL", null);
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "${table}" ORDER BY id`,
    );
    expect(rows.map((r) => r.id)).toEqual(["pre"]);
  });

  it("con includeEvidenceTables=true restaura la tabla (escape SET LOCAL funciona)", async () => {
    await restoreService.run("job-include", payload(), "GLOBAL", null, true);
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "${table}" ORDER BY id`,
    );
    expect(rows.map((r) => r.id)).toEqual(["restored"]);
  });
});
