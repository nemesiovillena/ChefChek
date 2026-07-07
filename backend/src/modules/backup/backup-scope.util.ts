import { BackupIntrospectionService } from "./backup-introspection.service";
import {
  CHILD_SCOPE_RULES,
  GLOBAL_ONLY_TABLES,
  IMPLICIT_JOIN_TABLES,
} from "./backup.constants";
import { BackupScope } from "./dto/backup.dto";

export interface ScopeResult {
  /** true = la tabla no aplica a este scope (p. ej. allergens en scope TENANT). */
  skip: boolean;
  /** Fragmento WHERE con marcadores posicionales ($1...) listos para
   *  $queryRawUnsafe/$executeRawUnsafe, o null si no hay filtro (GLOBAL). */
  whereText: string | null;
  /** Parámetros posicionales que acompañan a whereText. */
  params: unknown[];
}

/**
 * Construye la cláusula WHERE (texto plano con $1) que delimita las filas de
 * una tabla a un tenant (o a todo, en scope GLOBAL). El texto se embebe en
 * `$queryRawUnsafe`/`$executeRawUnsafe` con los params por separado.
 *
 * Nota de seguridad: todos los identificadores (tabla/columna) provienen de
 * information_schema o de constantes estáticas, nunca de input de usuario. El
 * `tenantId` se pasa siempre parametrizado ($1), nunca interpolado.
 */
export async function buildScopeClause(
  introspection: BackupIntrospectionService,
  table: string,
  scope: BackupScope,
  tenantId: string | null,
): Promise<ScopeResult> {
  // GLOBAL: sin filtro, se respalda/restaura toda la tabla.
  if (scope === "GLOBAL") {
    return { skip: false, whereText: null, params: [] };
  }

  // TENANT: las tablas de catálogo/raíz no se tocan por tenant.
  if (GLOBAL_ONLY_TABLES.has(table)) {
    return { skip: true, whereText: null, params: [] };
  }

  // Tabla con columna tenantId -> filtro directo.
  if (await introspection.hasColumn(table, "tenantId")) {
    return { skip: false, whereText: '"tenantId" = $1', params: [tenantId] };
  }

  // m-n implícita de Prisma (p. ej. _SprintToTeamMember).
  const implicit = IMPLICIT_JOIN_TABLES[table];
  if (implicit) {
    return {
      skip: false,
      whereText: `"${implicit.scopeCol}" IN (SELECT id FROM "${implicit.parent}" WHERE "tenantId" = $1)`,
      params: [tenantId],
    };
  }

  // Hija sin tenantId -> por cadena de padres hasta una tabla tenant-rooted.
  const hops = CHILD_SCOPE_RULES[table];
  if (hops?.length) {
    // innermost: SELECT id FROM "<último padre>" WHERE "tenantId" = $1
    let inner = `SELECT id FROM "${hops[hops.length - 1].parent}" WHERE "tenantId" = $1`;
    // envolver hacia afuera saltando de padre en padre
    for (let i = hops.length - 2; i >= 0; i--) {
      inner = `SELECT id FROM "${hops[i].parent}" WHERE "${hops[i + 1].col}" IN (${inner})`;
    }
    return {
      skip: false,
      whereText: `"${hops[0].col}" IN (${inner})`,
      params: [tenantId],
    };
  }

  // Sin regla conocida: no se puede scopear de forma segura -> saltar y
  // registrar en coverageGap para avisar al usuario.
  return { skip: true, whereText: null, params: [] };
}
