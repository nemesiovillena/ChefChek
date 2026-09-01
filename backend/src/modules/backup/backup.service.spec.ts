import { Test } from "@nestjs/testing";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { PrismaService } from "../../common/services/prisma.service";
import { BunnyStorageService } from "../../common/bunny/bunny-storage.service";
import { BackupService } from "./backup.service";
import { BackupExportService } from "./backup-export.service";
import { BackupRestoreService } from "./backup-restore.service";
import { BackupIntrospectionService } from "./backup-introspection.service";
import { BackupProgressRegistry } from "./backup-progress.registry";

/**
 * Cobertura de las rutas sensibles añadidas por la migración a Bunny:
 * lectura/descarga/borrado de una copia según tenga `storageKey` (Bunny) o no
 * (disco local).
 */
describe("BackupService — rutas de almacenamiento de copias", () => {
  let service: BackupService;
  let bunny: {
    backupsEnabled: boolean;
    downloadBackup: jest.Mock;
    openBackupStream: jest.Mock;
    deleteBackup: jest.Mock;
  };
  const prisma = {
    backup: { delete: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  beforeEach(async () => {
    bunny = {
      backupsEnabled: true,
      downloadBackup: jest.fn(),
      openBackupStream: jest.fn(),
      deleteBackup: jest.fn().mockResolvedValue(undefined),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        BackupService,
        { provide: PrismaService, useValue: prisma },
        { provide: BackupExportService, useValue: {} },
        { provide: BackupRestoreService, useValue: {} },
        { provide: BackupIntrospectionService, useValue: {} },
        { provide: BackupProgressRegistry, useValue: { clear: jest.fn() } },
        { provide: BunnyStorageService, useValue: bunny },
      ],
    }).compile();
    service = moduleRef.get(BackupService);
    jest.clearAllMocks();
  });

  const row = (over: Record<string, unknown> = {}) =>
    ({
      id: "bk1",
      scope: "TENANT",
      tenantId: "t1",
      filename: "t1_2026.json",
      storageKey: null,
      ...over,
    }) as never;

  describe("readBackupJson", () => {
    it("lee de Bunny cuando hay storageKey y la zona está activa", async () => {
      bunny.downloadBackup.mockResolvedValue(Buffer.from('{"ok":1}', "utf8"));
      const out = await service.readBackupJson(
        row({ storageKey: "backups/t1/t1_2026.json" }),
      );
      expect(out).toBe('{"ok":1}');
      expect(bunny.downloadBackup).toHaveBeenCalledWith(
        "backups/t1/t1_2026.json",
      );
    });

    it("lee de disco cuando no hay storageKey", async () => {
      const dir = await mkdtemp(join(tmpdir(), "bk-"));
      const path = join(dir, "local.json");
      await writeFile(path, '{"disk":1}', "utf8");
      jest.spyOn(service, "filepathOf").mockReturnValue(path);

      const out = await service.readBackupJson(row({ storageKey: null }));
      expect(out).toBe('{"disk":1}');
      expect(bunny.downloadBackup).not.toHaveBeenCalled();
    });

    it("lee de disco si hay storageKey pero la zona Bunny está inactiva", async () => {
      bunny.backupsEnabled = false;
      const dir = await mkdtemp(join(tmpdir(), "bk-"));
      const path = join(dir, "local.json");
      await writeFile(path, '{"fallback":1}', "utf8");
      jest.spyOn(service, "filepathOf").mockReturnValue(path);

      const out = await service.readBackupJson(
        row({ storageKey: "backups/t1/x.json" }),
      );
      expect(out).toBe('{"fallback":1}');
    });
  });

  describe("openBackupDownload", () => {
    it("devuelve el stream de Bunny + nombre de fichero", async () => {
      const s = Readable.from(["{}"]);
      bunny.openBackupStream.mockResolvedValue(s);
      const res = await service.openBackupDownload(
        row({ storageKey: "backups/t1/t1_2026.json" }),
      );
      expect(res.stream).toBe(s);
      expect(res.filename).toBe("t1_2026.json");
    });

    it("devuelve un read stream de disco cuando no hay storageKey", async () => {
      const dir = await mkdtemp(join(tmpdir(), "bk-"));
      const path = join(dir, "d.json");
      await writeFile(path, "hola", "utf8");
      jest.spyOn(service, "filepathOf").mockReturnValue(path);

      const { stream } = await service.openBackupDownload(row());
      const chunks: Buffer[] = [];
      for await (const c of stream) {
        chunks.push(c as Buffer);
      }
      expect(Buffer.concat(chunks).toString()).toBe("hola");
    });
  });

  describe("deleteBackup", () => {
    beforeEach(() => {
      jest
        .spyOn(service, "getOne")
        .mockImplementation(async () =>
          row({ storageKey: "backups/t1/t1_2026.json" }),
        );
    });

    it("borra de Bunny cuando la copia tiene storageKey", async () => {
      await service.deleteBackup("bk1", "TENANT", "t1", "u1");
      expect(bunny.deleteBackup).toHaveBeenCalledWith(
        "backups/t1/t1_2026.json",
      );
      expect(prisma.backup.delete).toHaveBeenCalledWith({
        where: { id: "bk1" },
      });
    });

    it("no falla el borrado del registro si Bunny lanza", async () => {
      bunny.deleteBackup.mockRejectedValue(new Error("boom"));
      await expect(
        service.deleteBackup("bk1", "TENANT", "t1", "u1"),
      ).resolves.toBeUndefined();
      expect(prisma.backup.delete).toHaveBeenCalled();
    });
  });
});
