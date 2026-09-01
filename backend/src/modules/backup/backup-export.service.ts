import { Injectable, Logger } from "@nestjs/common";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaService } from "../../common/services/prisma.service";
import { BunnyStorageService } from "../../common/bunny/bunny-storage.service";
import {
  BACKUP_DIR,
  BACKUP_SCHEMA_VERSION,
  BACKUP_STORAGE_PREFIX,
} from "./backup.constants";
import { BackupIntrospectionService } from "./backup-introspection.service";
import { BackupProgressRegistry } from "./backup-progress.registry";
import { buildScopeClause } from "./backup-scope.util";
import { quoteSqlIdent } from "./backup-sql-identifier.util";
import { serializeRow } from "./backup.serializer";
import { BackupPayload, BackupScope } from "./dto/backup.dto";

/** Resultado del snapshot: payload + metadatos calculados. */
export interface ExportResult {
  payload: BackupPayload;
  json: string;
  checksum: string;
  rowCount: number;
  filename: string;
  /** Key en la Storage Zone de backups si se subió a Bunny; null si a disco. */
  storageKey: string | null;
  /** Tablas que NO se respaldaron por carecer de regla de scope. */
  coverageGap: string[];
}

@Injectable()
export class BackupExportService {
  private readonly logger = new Logger(BackupExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly introspection: BackupIntrospectionService,
    private readonly progress: BackupProgressRegistry,
    private readonly bunny: BunnyStorageService,
  ) {}

  /**
   * Genera el snapshot del scope/tenant indicado. Recorre todas las tablas
   * físicas, aplica el scope por tenant, serializa y escribe un .json con
   * checksum sha256. El SQL crudo salta el middleware de soft-delete, así que
   * las filas en papelera (deletedAt) quedan incluidas.
   */
  async run(
    backupId: string,
    scope: BackupScope,
    tenantId: string | null,
    tenantSlug: string | null,
  ): Promise<ExportResult> {
    const tables = await this.introspection.getTables();
    const data: BackupPayload["data"] = {};
    const counts: Record<string, number> = {};
    const coverageGap: string[] = [];
    let rowCount = 0;

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const scopeRes = await buildScopeClause(
        this.introspection,
        table,
        scope,
        tenantId,
      );

      if (scopeRes.skip) {
        // Sólo es brecha si la tabla no es global-only (ésas se excluyen a propósito)
        coverageGap.push(table);
        continue;
      }

      const rows = scopeRes.whereText
        ? await this.prisma.$queryRawUnsafe(
            `SELECT * FROM ${quoteSqlIdent(table)} WHERE ${scopeRes.whereText}`,
            ...scopeRes.params,
          )
        : await this.prisma.$queryRawUnsafe(
            `SELECT * FROM ${quoteSqlIdent(table)}`,
          );

      const list = (rows as Record<string, unknown>[]).map((r) =>
        serializeRow(r),
      );
      data[table] = list;
      counts[table] = list.length;
      rowCount += list.length;

      this.progress.set(backupId, {
        status: "RUNNING",
        progress: Math.round(((i + 1) / tables.length) * 100),
        step: `Exportando ${table} (${list.length})`,
      });
    }

    const payload: BackupPayload = {
      meta: {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        app: "chefchek",
        exportedAt: new Date().toISOString(),
        scope,
        tenantId,
        tenantSlug,
        counts,
        coverageGap,
      },
      data,
    };
    const json = JSON.stringify(payload);
    const checksum = createHash("sha256").update(json, "utf8").digest("hex");

    const dir = scope === "GLOBAL" ? "global" : (tenantId ?? "unknown");
    const safeSlug = (tenantSlug ?? dir).replace(/[^a-zA-Z0-9-_]/g, "_");
    const ts = payload.meta.exportedAt.replace(/[:.]/g, "-");
    const filename = `${scope === "GLOBAL" ? "global" : safeSlug}_${ts}.json`;

    // Zona privada de Bunny (sin Pull Zone) si está configurada; si no, disco
    // local — sin servir de forma estática (ver main.ts).
    let storageKey: string | null = null;
    if (this.bunny.backupsEnabled) {
      storageKey = `${BACKUP_STORAGE_PREFIX}/${dir}/${filename}`;
      await this.bunny.uploadBackup(storageKey, Buffer.from(json, "utf8"));
    } else {
      await mkdir(join(process.cwd(), BACKUP_DIR, dir), { recursive: true });
      await writeFile(
        join(process.cwd(), BACKUP_DIR, dir, filename),
        json,
        "utf8",
      );
    }

    if (coverageGap.length) {
      this.logger.warn(
        `Backup ${backupId}: ${coverageGap.length} tabla(s) sin regla de scope, omitidas: ${coverageGap.join(", ")}`,
      );
    }

    return {
      payload,
      json,
      checksum,
      rowCount,
      filename,
      storageKey,
      coverageGap,
    };
  }
}
