import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { PrismaService } from "../../common/services/prisma.service";
import { Backup, Prisma } from "@prisma/client";
import { BACKUP_DIR, BACKUP_SCHEMA_VERSION } from "./backup.constants";
import { BackupExportService } from "./backup-export.service";
import { BackupRestoreService } from "./backup-restore.service";
import { BackupIntrospectionService } from "./backup-introspection.service";
import { BackupProgressRegistry } from "./backup-progress.registry";
import { BackupFileMeta, BackupPayload, BackupScope } from "./dto/backup.dto";

/** Tiempo máximo razonable de un job antes de considerarse colgado. */
const STALE_AFTER_MS = 10 * 60 * 1000;

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly exportService: BackupExportService,
    private readonly restoreService: BackupRestoreService,
    private readonly introspection: BackupIntrospectionService,
    private readonly progress: BackupProgressRegistry,
  ) {}

  // ───────────────────────────────────────────────────────── EXPORT

  /** Crea la fila de backup y dispara la generación asíncrona (fire-and-forget). */
  async createExport(
    scope: BackupScope,
    tenantId: string | null,
    tenantSlug: string | null,
    userId: string | null,
    notes?: string,
  ): Promise<{ id: string; status: string }> {
    const backup = await this.prisma.backup.create({
      data: {
        tenantId: scope === "TENANT" ? tenantId : null,
        scope,
        kind: "EXPORT",
        type: "MANUAL",
        status: "PENDING",
        format: "json",
        schemaVersion: BACKUP_SCHEMA_VERSION,
        createdBy: userId,
        notes,
      },
    });
    this.progress.set(backup.id, {
      status: "PENDING",
      progress: 0,
      step: "En cola",
    });
    // No se await: el request devuelve el id y el frontend hace polling.
    void this.runExport(backup.id, scope, tenantId, tenantSlug, userId).catch(
      (e) => this.logger.error(`runExport unhandled: ${e?.message ?? e}`),
    );
    return { id: backup.id, status: "PENDING" };
  }

  private async runExport(
    backupId: string,
    scope: BackupScope,
    tenantId: string | null,
    tenantSlug: string | null,
    userId: string | null,
  ): Promise<void> {
    try {
      this.progress.set(backupId, {
        status: "RUNNING",
        progress: 0,
        step: "Iniciando",
      });
      await this.prisma.backup.update({
        where: { id: backupId },
        data: { status: "RUNNING" },
      });

      const result = await this.exportService.run(
        backupId,
        scope,
        tenantId,
        tenantSlug,
      );

      await this.prisma.backup.update({
        where: { id: backupId },
        data: {
          status: "COMPLETED",
          filename: result.filename,
          fileSizeBytes: BigInt(Buffer.byteLength(result.json, "utf8")),
          rowCount: result.rowCount,
          checksum: result.checksum,
          completedAt: new Date(),
        },
      });
      this.progress.set(backupId, {
        status: "COMPLETED",
        progress: 100,
        step: "Completado",
      });
      await this.audit(tenantId, userId, "BACKUP_EXPORT", backupId, {
        scope,
        rowCount: result.rowCount,
      });
    } catch (e) {
      await this.fail(backupId, e);
    }
  }

  // ───────────────────────────────────────────────────────── RESTORE

  /**
   * Restaura desde un payload (subido o leído de una copia existente). Crea
   * SIEMPRE un auto-backup previo (anchor de rollback) antes de mutar; si ese
   * snapshot falla, aborta sin tocar nada. La restauración mutante corre async.
   */
  async restoreFromPayload(
    payload: BackupPayload,
    scope: BackupScope,
    tenantId: string | null,
    tenantSlug: string | null,
    userId: string | null,
    sourceBackupId?: string | null,
    notes?: string,
  ): Promise<{ id: string; preBackupId: string; status: string }> {
    this.validatePayload(payload, scope, tenantId);

    // 1) Auto-backup previo obligatorio (síncrono: debe completar antes de mutar).
    const preBackup = await this.prisma.backup.create({
      data: {
        tenantId: scope === "TENANT" ? tenantId : null,
        scope,
        kind: "EXPORT",
        type: "AUTO_PRE_RESTORE",
        status: "RUNNING",
        format: "json",
        schemaVersion: BACKUP_SCHEMA_VERSION,
        createdBy: userId,
        notes: "Auto-backup previo a restauración",
      },
    });
    try {
      const pre = await this.exportService.run(
        preBackup.id,
        scope,
        tenantId,
        tenantSlug,
      );
      await this.prisma.backup.update({
        where: { id: preBackup.id },
        data: {
          status: "COMPLETED",
          filename: pre.filename,
          fileSizeBytes: BigInt(Buffer.byteLength(pre.json, "utf8")),
          rowCount: pre.rowCount,
          checksum: pre.checksum,
          completedAt: new Date(),
        },
      });
    } catch (e) {
      await this.prisma.backup.update({
        where: { id: preBackup.id },
        data: {
          status: "FAILED",
          errorMessage: String(e?.message ?? e).slice(0, 2000),
        },
      });
      throw new BadRequestException(
        "No se pudo crear el auto-backup previo; restauración abortada por seguridad.",
      );
    }

    // 2) Job de restauración (async).
    const job = await this.prisma.backup.create({
      data: {
        tenantId: scope === "TENANT" ? tenantId : null,
        scope,
        kind: "RESTORE",
        type: "MANUAL",
        status: "PENDING",
        schemaVersion: BACKUP_SCHEMA_VERSION,
        createdBy: userId,
        sourceBackupId: sourceBackupId ?? preBackup.id,
        notes,
      },
    });
    this.progress.set(job.id, {
      status: "PENDING",
      progress: 0,
      step: "En cola",
    });
    void this.runRestore(job.id, payload, scope, tenantId, userId).catch((e) =>
      this.logger.error(`runRestore unhandled: ${e?.message ?? e}`),
    );
    return { id: job.id, preBackupId: preBackup.id, status: "PENDING" };
  }

  private async runRestore(
    jobId: string,
    payload: BackupPayload,
    scope: BackupScope,
    tenantId: string | null,
    userId: string | null,
  ): Promise<void> {
    try {
      this.progress.set(jobId, {
        status: "RUNNING",
        progress: 0,
        step: "Iniciando restauración",
      });
      await this.prisma.backup.update({
        where: { id: jobId },
        data: { status: "RUNNING" },
      });

      const { insertedRows } = await this.restoreService.run(
        jobId,
        payload,
        scope,
        tenantId,
      );

      await this.prisma.backup.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          rowCount: insertedRows,
          completedAt: new Date(),
        },
      });
      this.progress.set(jobId, {
        status: "COMPLETED",
        progress: 100,
        step: "Restauración completada",
      });
      await this.audit(tenantId, userId, "BACKUP_RESTORE", jobId, {
        scope,
        insertedRows,
      });
    } catch (e) {
      await this.fail(jobId, e);
    }
  }

  /** Lee el .json de una copia existente y la restaura. */
  async restoreFromExisting(
    backupId: string,
    scope: BackupScope,
    tenantId: string | null,
    tenantSlug: string | null,
    userId: string | null,
    notes?: string,
  ): Promise<{ id: string; preBackupId: string; status: string }> {
    const backup = await this.getOne(backupId, scope, tenantId);
    if (
      backup.kind !== "EXPORT" ||
      backup.status !== "COMPLETED" ||
      !backup.filename
    ) {
      throw new BadRequestException(
        "La copia no está disponible para restaurar.",
      );
    }
    const { readFile } = await import("node:fs/promises");
    const payload = this.parseJson(
      await readFile(this.filepathOf(backup), "utf8"),
    );
    return this.restoreFromPayload(
      payload,
      scope,
      tenantId,
      tenantSlug,
      userId,
      backupId,
      notes,
    );
  }

  // ───────────────────────────────────────────────────────── READ / DELETE

  /** Lista las copias EXPORT (manuales + auto-pre-restore) del ámbito. */
  async list(
    scope: BackupScope,
    tenantId: string | null,
  ): Promise<BackupFileMeta[]> {
    await this.reconcileStale();
    const rows = await this.prisma.backup.findMany({
      where: {
        kind: "EXPORT",
        ...(scope === "TENANT" ? { tenantId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((r) => this.toMeta(r));
  }

  async getOne(
    id: string,
    scope: BackupScope,
    tenantId: string | null,
  ): Promise<Backup> {
    const row = await this.prisma.backup.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException("Copia no encontrada.");
    }
    // Aislamiento por tenant: no filtrar la existencia (no leak).
    if (scope === "TENANT" && row.tenantId !== tenantId) {
      throw new NotFoundException("Copia no encontrada.");
    }
    return row;
  }

  /** Estado en vivo de un job (export o restore) para el polling del frontend. */
  async getJobStatus(
    id: string,
    scope: BackupScope,
    tenantId: string | null,
  ): Promise<{
    id: string;
    status: string;
    progress: number;
    step: string;
    error: string | null;
    kind: string;
    scope: string;
  }> {
    const row = await this.getOne(id, scope, tenantId);
    const reg = this.progress.get(id);
    if (reg) {
      return {
        id,
        status: reg.status,
        progress: reg.progress,
        step: reg.step,
        error: reg.error ?? null,
        kind: row.kind,
        scope: row.scope,
      };
    }
    return {
      id,
      status: row.status,
      progress: row.status === "COMPLETED" ? 100 : 0,
      step:
        row.status === "COMPLETED"
          ? "Completado"
          : row.status === "FAILED"
            ? "Falló"
            : "",
      error: row.errorMessage,
      kind: row.kind,
      scope: row.scope,
    };
  }

  async deleteBackup(
    id: string,
    scope: BackupScope,
    tenantId: string | null,
    userId: string | null,
  ): Promise<void> {
    const row = await this.getOne(id, scope, tenantId);
    if (row.filename) {
      try {
        await unlink(this.filepathOf(row));
      } catch {
        // archivo ya ausente: no bloquear el borrado del registro
      }
    }
    await this.prisma.backup.delete({ where: { id } });
    this.progress.clear(id);
    await this.audit(row.tenantId, userId, "BACKUP_DELETE", id, { scope });
  }

  /** Ruta absoluta del archivo de una copia (para descarga). */
  filepathOf(row: Backup): string {
    const dir = row.scope === "GLOBAL" ? "global" : (row.tenantId ?? "unknown");
    return join(process.cwd(), BACKUP_DIR, dir, row.filename ?? "");
  }

  // ───────────────────────────────────────────────────────── HELPERS

  parseJson(raw: string): BackupPayload {
    try {
      return JSON.parse(raw) as BackupPayload;
    } catch {
      throw new BadRequestException("El archivo no es un JSON válido.");
    }
  }

  private validatePayload(
    payload: BackupPayload,
    scope: BackupScope,
    tenantId: string | null,
  ): void {
    if (!payload?.meta || !payload?.data) {
      throw new BadRequestException("Estructura de copia inválida.");
    }
    if (payload.meta.schemaVersion > BACKUP_SCHEMA_VERSION) {
      throw new BadRequestException(
        `La copia es de schema v${payload.meta.schemaVersion}; esta aplicación es v${BACKUP_SCHEMA_VERSION}. Actualiza antes de restaurar.`,
      );
    }
    if (payload.meta.scope !== scope) {
      throw new BadRequestException(
        `La copia es de ámbito ${payload.meta.scope}; no coincide con el ámbito ${scope}.`,
      );
    }
    // Evita restaurar en un tenant una copia de otro (subida manual maliciosa).
    if (
      scope === "TENANT" &&
      payload.meta.tenantId &&
      payload.meta.tenantId !== tenantId
    ) {
      throw new BadRequestException(
        "La copia pertenece a otro tenant; no se puede restaurar aquí.",
      );
    }
  }

  /** Marca como FAILED los jobs RUNNING antiguos (proceso reiniciado a mitad). */
  private async reconcileStale(): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_AFTER_MS);
    await this.prisma.backup.updateMany({
      where: { status: "RUNNING", createdAt: { lt: cutoff } },
      data: {
        status: "FAILED",
        errorMessage: "Job interrumpido (reinicio de proceso).",
        completedAt: new Date(),
      },
    });
  }

  private async fail(id: string, e: unknown): Promise<void> {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 2000);
    this.logger.error(`Job ${id} failed: ${msg}`);
    this.progress.set(id, {
      status: "FAILED",
      progress: 0,
      step: "Falló",
      error: msg,
    });
    try {
      await this.prisma.backup.update({
        where: { id },
        data: { status: "FAILED", errorMessage: msg, completedAt: new Date() },
      });
    } catch {
      // si la fila ya no existe, nada que hacer
    }
  }

  private async audit(
    tenantId: string | null,
    userId: string | null,
    action: string,
    entityId: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    if (!tenantId || !userId) {
      return;
    }
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action,
          entityType: "Backup",
          entityId,
          details: details as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      this.logger.warn(`audit log falló: ${(e as Error).message}`);
    }
  }

  /** BigInt -> string para que la respuesta sea JSON-serializable. */
  private toMeta(r: Backup): BackupFileMeta {
    return {
      id: r.id,
      scope: r.scope,
      status: r.status,
      kind: r.kind,
      type: r.type,
      format: r.format,
      filename: r.filename,
      fileSizeBytes: r.fileSizeBytes ? r.fileSizeBytes.toString() : null,
      rowCount: r.rowCount,
      checksum: r.checksum,
      schemaVersion: r.schemaVersion,
      sourceBackupId: r.sourceBackupId,
      notes: r.notes,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    };
  }
}
