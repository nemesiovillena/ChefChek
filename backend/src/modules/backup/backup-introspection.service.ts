import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import { EXCLUDED_TABLES } from "./backup.constants";

export interface ColumnMeta {
  name: string;
  dataType: string; // information_schema.data_type: 'ARRAY','timestamp with time zone','bigint','text',...
  udtName: string; // '_int4','int8','jsonb','bool',...
  isArray: boolean;
}

interface FkEdge {
  fromTable: string;
  fromCol: string;
  toTable: string;
}

/**
 * Descubre en runtime la estructura física de la BD (tablas, columnas y grafo
 * de FKs) para que el backup sea genérico y auto-mantenido: nuevas tablas se
 * respaldan automáticamente sin tocar el allowlist.
 *
 * El orden topológico (padres antes que hijos) se deriva de las FKs reales, lo
 * que resuelve los casos delicados del schema de ChefChek: FKs `Restrict`
 * (knowledge_articles.createdBy → users), la m-n implícita `_SprintToTeamMember`
 * y las auto-referencias (Category/KnowledgeCategory.parentId).
 */
@Injectable()
export class BackupIntrospectionService {
  private readonly logger = new Logger(BackupIntrospectionService.name);
  private tablesCache: string[] | null = null;
  private columnsCache = new Map<string, ColumnMeta[]>();
  private fkEdgesCache: FkEdge[] | null = null;
  private insertOrderCache: string[] | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Tablas de `public` respaldables (excluye sessions/backups/_prisma_migrations). */
  async getTables(): Promise<string[]> {
    if (this.tablesCache) {
      return this.tablesCache;
    }
    const rows = await this.prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    this.tablesCache = rows
      .map((r) => r.table_name)
      .filter((t) => !EXCLUDED_TABLES.has(t));
    return this.tablesCache;
  }

  /** Columnas de una tabla, en orden físico. */
  async getColumns(table: string): Promise<ColumnMeta[]> {
    const cached = this.columnsCache.get(table);
    if (cached) {
      return cached;
    }
    const rows = await this.prisma.$queryRaw<
      { column_name: string; data_type: string; udt_name: string }[]
    >`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
      ORDER BY ordinal_position
    `;
    const cols: ColumnMeta[] = rows.map((r) => ({
      name: r.column_name,
      dataType: r.data_type,
      udtName: r.udt_name,
      isArray: r.data_type === "ARRAY",
    }));
    this.columnsCache.set(table, cols);
    return cols;
  }

  async hasColumn(table: string, col: string): Promise<boolean> {
    const cols = await this.getColumns(table);
    return cols.some((c) => c.name === col);
  }

  /** Aristas del grafo de FKs (fromTable.col → toTable). Excluye auto-referencias. */
  private async getFkEdges(): Promise<FkEdge[]> {
    if (this.fkEdgesCache) {
      return this.fkEdgesCache;
    }
    const rows = await this.prisma.$queryRaw<
      { from_table: string; from_col: string; to_table: string }[]
    >`
      SELECT kcu.table_name  AS from_table,
             kcu.column_name AS from_col,
             ccu.table_name  AS to_table
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema    = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema    = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema    = 'public'
    `;
    this.fkEdgesCache = rows
      .map((r) => ({
        fromTable: r.from_table,
        fromCol: r.from_col,
        toTable: r.to_table,
      }))
      .filter((e) => e.fromTable !== e.toTable); // auto-ref se maneja en el INSERT
    return this.fkEdgesCache;
  }

  /**
   * Orden topológico para INSERT (padres antes que hijos). Kahn: una tabla se
   * emite cuando todas las tablas a las que referencia (sus FKs) ya están
   * emitidas. Lanza si hay un ciclo (no debería existir en este schema).
   */
  async getInsertOrder(): Promise<string[]> {
    if (this.insertOrderCache) {
      return this.insertOrderCache;
    }
    const tables = await this.getTables();
    const tableSet = new Set(tables);
    const edges = (await this.getFkEdges()).filter(
      (e) => tableSet.has(e.fromTable) && tableSet.has(e.toTable),
    );

    // dependencias[from] = conjunto de tablas a las que 'from' referencia
    const deps = new Map<string, Set<string>>();
    const dependents = new Map<string, Set<string>>();
    for (const t of tables) {
      deps.set(t, new Set());
      dependents.set(t, new Set());
    }
    for (const e of edges) {
      deps.get(e.fromTable)!.add(e.toTable);
      dependents.get(e.toTable)!.add(e.fromTable);
    }

    // empuja las tablas sin dependencias (roots absolutas) primero, pero
    // ordenadas alfabéticamente para un output determinista
    const order: string[] = [];
    const done = new Set<string>();
    const ready = tables
      .filter((t) => deps.get(t)!.size === 0)
      .sort((a, b) => a.localeCompare(b));
    while (ready.length) {
      const t = ready.shift()!;
      if (done.has(t)) {
        continue;
      }
      order.push(t);
      done.add(t);
      const newly: string[] = [];
      for (const d of dependents.get(t)!) {
        const remaining = deps.get(d)!;
        remaining.delete(t);
        if (remaining.size === 0 && !done.has(d)) {
          newly.push(d);
        }
      }
      newly.sort((a, b) => a.localeCompare(b));
      ready.push(...newly);
    }

    if (order.length !== tables.length) {
      const cyclic = tables.filter((t) => !done.has(t));
      throw new Error(
        `Ciclo de FKs detectado, no se puede ordenar: ${cyclic.join(", ")}`,
      );
    }
    this.insertOrderCache = order;
    this.logger.log(`Orden de inserción calculado (${order.length} tablas)`);
    return order;
  }

  /**
   * Cast PG para un valor parametrizado, por tipo de columna. Necesario sobre
   * todo para `bigint` (Telegram IDs > int4) y `jsonb`/arrays. Identificadores
   * nunca vienen de input de usuario (vienen de information_schema).
   */
  castFor(col: ColumnMeta): string {
    if (col.isArray) {
      // udt '_int4' -> 'int[]'; '_text' -> 'text[]'
      const inner = col.udtName.startsWith("_")
        ? col.udtName.slice(1).replace(/^int/, "int")
        : col.udtName;
      return this.arrayCast(inner);
    }
    // Tipos enum personalizados de Prisma (CategoryContext, AlbaranStatus, ...)
    // llegan como USER-DEFINED; al insertar un text hace falta cast al enum.
    if (col.dataType === "USER-DEFINED") {
      return `::"${col.udtName}"`;
    }
    switch (col.udtName) {
      case "int8":
        return "::bigint";
      case "int2":
        return "::smallint";
      case "int4":
        return "::integer";
      case "jsonb":
        return "::jsonb";
      case "json":
        return "::json";
      case "bool":
        return "::boolean";
      case "float4":
        return "::real";
      case "float8":
        return "::double precision";
      case "numeric":
        return "::numeric";
      default:
        return "";
    }
  }

  private arrayCast(inner: string): string {
    // _int4 -> int4[], _text -> text[]
    const base =
      inner === "int8" ? "bigint" : inner === "int4" ? "integer" : inner;
    return `::${base}[]`;
  }

  /**
   * Columnas con auto-referencia (FK de una tabla a sí misma, p. ej.
   * categories.parentId). Se insertan en dos fases (null + UPDATE) para evitar
   * violaciones de FK sin importar el orden de las filas.
   */
  async getSelfRefColumns(table: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ column_name: string }[]>`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema    = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema    = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema    = 'public'
        AND tc.table_name      = ${table}
        AND ccu.table_name     = ${table}
    `;
    return rows.map((r) => r.column_name);
  }

  /** Utilidad: envuelve un identificador seguro en comillas dobles. */
  quote(ident: string): Prisma.Sql {
    return Prisma.raw(`"${ident}"`);
  }
}
