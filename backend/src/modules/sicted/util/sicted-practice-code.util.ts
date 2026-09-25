/**
 * Orden numérico de un `code` de práctica ("1.1", "1.10", "1.2"...) — Prisma
 * `orderBy: { code: "asc" }` ordena como string y coloca "1.10" antes de
 * "1.2" (bug real cazado en navegador: BP1 mostraba 1.1, 1.10, 1.11, 1.12...
 * 1.2). Se ordena en memoria tras la consulta en vez de en SQL porque el
 * número de prácticas por tenant es pequeño (144 como máximo) y evita tener
 * que mantener una columna `sortOrder` redundante con `code`.
 */
export function sortByPracticeCode<T extends { code: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const [, aSuffix] = a.code.split(".");
    const [, bSuffix] = b.code.split(".");
    return (Number(aSuffix) || 0) - (Number(bSuffix) || 0);
  });
}
