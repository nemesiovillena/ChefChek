/**
 * Valida y entrecomilla un identificador SQL (nombre de tabla o columna) para
 * embeberlo en `$queryRawUnsafe` / `Prisma.raw`.
 *
 * En el módulo de backup los identificadores provienen siempre de
 * `information_schema` o de constantes estáticas, nunca de input de usuario.
 * Esta comprobación es defensa en profundidad: un nombre inesperado aborta la
 * operación en vez de acabar interpolado en el SQL.
 */
export function quoteSqlIdent(name: string): string {
  if (typeof name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Identificador SQL no válido: ${JSON.stringify(name)}`);
  }
  return `"${name}"`;
}
