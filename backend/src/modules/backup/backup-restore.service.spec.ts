import { Test } from "@nestjs/testing";
import { PrismaService } from "../../common/services/prisma.service";
import { BackupIntrospectionService } from "./backup-introspection.service";
import { BackupProgressRegistry } from "./backup-progress.registry";
import { BackupRestoreService } from "./backup-restore.service";
import { BackupPayload } from "./dto/backup.dto";

// `buildScopeClause` no se ejerce aquí: este test solo cubre el filtro de
// tablas de evidencia (`isEvidenceTable`) antes de tocar la BD. `skip: true`
// hace que `deleteScoped`/`insertRows` no lleguen a ejecutar SQL real.
jest.mock("./backup-scope.util", () => ({
  buildScopeClause: jest
    .fn()
    .mockResolvedValue({ skip: true, whereText: null, params: [] }),
}));

/**
 * Cobertura de la exclusión por defecto de tablas de evidencia inalterable
 * (`checklist_*`/`sicted_*`) en el restore — decisión confirmada 2026-09-24
 * (ver plans/260921-2256-sicted-calidad-turistica/plan.md).
 */
describe("BackupRestoreService — exclusión de tablas de evidencia", () => {
  let service: BackupRestoreService;
  let getInsertOrder: jest.Mock;
  // buildScopeClause está mockeado (skip:true) así que deleteScoped/insertRows
  // no llegan a usar tx; $executeRawUnsafe sí se invoca para el escape SET LOCAL.
  const tx = { $executeRawUnsafe: jest.fn() };

  beforeEach(async () => {
    getInsertOrder = jest
      .fn()
      .mockResolvedValue(["products", "checklist_foo", "sicted_bar"]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        BackupRestoreService,
        {
          provide: PrismaService,
          useValue: { $transaction: (cb: any) => cb(tx) },
        },
        {
          provide: BackupIntrospectionService,
          useValue: { getInsertOrder },
        },
        {
          provide: BackupProgressRegistry,
          useValue: { set: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(BackupRestoreService);
  });

  function payloadWith(tables: string[]): BackupPayload {
    const data: Record<string, unknown[]> = {};
    for (const t of tables) {
      data[t] = [];
    }
    return {
      meta: {
        schemaVersion: 1,
        app: "chefchek",
        exportedAt: new Date().toISOString(),
        scope: "TENANT",
        tenantId: "t1",
      },
      data,
    } as BackupPayload;
  }

  it("por defecto excluye checklist_* y sicted_* aunque estén en el payload, sin levantar el escape", async () => {
    const warn = jest.spyOn((service as any).logger, "warn");
    await service.run(
      "job1",
      payloadWith(["products", "checklist_foo", "sicted_bar"]),
      "TENANT",
      "t1",
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("checklist_foo"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("sicted_bar"));
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("con includeEvidenceTables=true las incluye, no avisa, y levanta el escape SET LOCAL", async () => {
    const warn = jest.spyOn((service as any).logger, "warn");
    await service.run(
      "job2",
      payloadWith(["products", "checklist_foo", "sicted_bar"]),
      "TENANT",
      "t1",
      true,
    );
    expect(warn).not.toHaveBeenCalled();
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("chefchek.allow_evidence_purge"),
    );
  });

  it("un payload sin tablas de evidencia no genera aviso", async () => {
    const warn = jest.spyOn((service as any).logger, "warn");
    await service.run("job3", payloadWith(["products"]), "TENANT", "t1");
    expect(warn).not.toHaveBeenCalled();
  });
});
