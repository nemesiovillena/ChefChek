import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import {
  BackupIntrospectionService,
  ColumnMeta,
} from "./backup-introspection.service";
import { BackupProgressRegistry } from "./backup-progress.registry";
import { buildScopeClause } from "./backup-scope.util";
import { deserializeRow } from "./backup.serializer";
import { BackupPayload, BackupScope } from "./dto/backup.dto";

/** Límite de parámetros por sentencia (PostgreSQL admite 65535; usamos margen). */
const MAX_PARAMS_PER_STMT = 1000;

@Injectable()
export class BackupRestoreService {
  private readonly logger = new Logger(BackupRestoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly introspection: BackupIntrospectionService,
    private readonly progress: BackupProgressRegistry,
  ) {}

  /**
   * Restaura un payload: deja el scope/tenant exactamente como en el snapshot.
   * Dentro de una transacción: borra las filas actuales (en orden FK inverso,
   * para respetar `Restrict`) y reinserta las del payload (en orden topológico,
   * padres antes que hijos). Las auto-referencias se insertan en dos fases.
   *
   * Sólo se tocan las tablas presentes en `payload.data`: una tabla nueva (que
   * el snapshot no capturó) se deja intacta para no perder datos desconocidos.
   */
  async run(
    restoreJobId: string,
    payload: BackupPayload,
    scope: BackupScope,
    tenantId: string | null,
  ): Promise<{ insertedRows: number }> {
    const order = await this.introspection.getInsertOrder();
    const tablesInBackup = Object.keys(payload.data);
    const tablesToTouch = order.filter((t) => tablesInBackup.includes(t));
    const totalSteps = tablesToTouch.length * 2; // delete + insert
    let step = 0;
    let insertedRows = 0;

    await this.prisma.$transaction(async (tx) => {
      // 1) DELETE en orden topológico inverso (hijos antes que padres).
      for (const table of [...tablesToTouch].reverse()) {
        const scopeRes = await buildScopeClause(
          this.introspection,
          table,
          scope,
          tenantId,
        );
        if (scopeRes.skip) {
          continue;
        }
        await this.deleteScoped(tx, table, scopeRes);
        step++;
        this.progress.set(restoreJobId, {
          status: "RUNNING",
          progress: Math.round((step / totalSteps) * 100),
          step: `Limpiando ${table}`,
        });
      }

      // 2) INSERT en orden topológico (padres antes que hijos).
      for (const table of tablesToTouch) {
        const rows = (payload.data[table] ?? []).map(deserializeRow);
        if (rows.length > 0) {
          const n = await this.insertRows(tx, table, rows);
          insertedRows += n;
        }
        step++;
        this.progress.set(restoreJobId, {
          status: "RUNNING",
          progress: Math.round((step / totalSteps) * 100),
          step: `Restaurando ${table} (${rows.length})`,
        });
      }
    });

    return { insertedRows };
  }

  private async deleteScoped(
    tx: Prisma.TransactionClient,
    table: string,
    scopeRes: { whereText: string | null; params: unknown[] },
  ): Promise<void> {
    if (scopeRes.whereText) {
      await tx.$executeRawUnsafe(
        `DELETE FROM "${table}" WHERE ${scopeRes.whereText}`,
        ...scopeRes.params,
      );
    } else {
      await tx.$executeRawUnsafe(`DELETE FROM "${table}"`);
    }
  }

  /**
   * INSERT por lotes de las filas de una tabla, con casts por tipo de columna y
   * auto-referencias resueltas en dos fases (inserta a null, luego UPDATE) para
   * no depender del orden de filas en jerarquías (Category, KnowledgeCategory).
   */
  private async insertRows(
    tx: Prisma.TransactionClient,
    table: string,
    rows: Record<string, unknown>[],
  ): Promise<number> {
    const cols = await this.introspection.getColumns(table);
    const selfRefCols = new Set(
      await this.introspection.getSelfRefColumns(table),
    );

    // Fase A: insertar con auto-referencias a null.
    const batchSize = Math.max(
      1,
      Math.floor(MAX_PARAMS_PER_STMT / cols.length),
    );
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize).map((r) => {
        if (!selfRefCols.size) {
          return r;
        }
        const copy: Record<string, unknown> = { ...r };
        for (const c of selfRefCols) {
          copy[c] = null;
        }
        return copy;
      });
      await this.bulkInsert(tx, table, cols, batch);
    }

    // Fase B: restaurar las auto-referencias a su valor real.
    if (selfRefCols.size) {
      for (const r of rows) {
        for (const c of selfRefCols) {
          const val = r[c];
          if (val !== undefined && val !== null) {
            await tx.$executeRaw`UPDATE ${Prisma.raw(`"${table}"`)} SET ${Prisma.raw(`"${c}"`)} = ${val} WHERE ${Prisma.raw(`"id"`)} = ${r.id}`;
          }
        }
      }
    }
    return rows.length;
  }

  /** Construye y ejecuta un INSERT multi-fila con casts por columna. */
  private async bulkInsert(
    tx: Prisma.TransactionClient,
    table: string,
    cols: ColumnMeta[],
    rows: Record<string, unknown>[],
  ): Promise<void> {
    const colList = cols.map((c) => `"${c.name}"`).join(", ");
    const valuesSql: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    for (const row of rows) {
      const markers = cols.map((c) => {
        params.push(this.prepareParam(c, row[c.name]));
        return `$${p++}${this.introspection.castFor(c)}`;
      });
      valuesSql.push(`(${markers.join(", ")})`);
    }
    const sql = `INSERT INTO "${table}" (${colList}) VALUES ${valuesSql.join(", ")}`;
    await tx.$executeRawUnsafe(sql, ...params);
  }

  /**
   * Ajusta un valor al formato que espera `pg` según el tipo de columna:
   *  - jsonb/json: los objetos/array van como texto JSON (la BD hace el cast).
   *  - arrays PG: se pasan como array nativo (pg los serializa).
   *  - resto: tal cual (Date/BigInt/number/string/boolean/null).
   */
  private prepareParam(col: ColumnMeta, value: unknown): unknown {
    if (value === undefined) {
      return null;
    }
    if (!col.isArray && (col.udtName === "jsonb" || col.udtName === "json")) {
      if (typeof value === "object" && value !== null) {
        return JSON.stringify(value);
      }
    }
    return value;
  }
}
