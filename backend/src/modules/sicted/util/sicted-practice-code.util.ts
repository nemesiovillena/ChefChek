/**
 * Orden de un `code` de práctica. SICTED 2026 usa 4 dígitos con ceros
 * ("0001".."0825"), que ya ordenan bien como texto. El legado v4 ("1.1",
 * "1.10", "1.2"...) necesita orden numérico por sección y sufijo: Prisma
 * `orderBy: { code: "asc" }` ponía "1.10" antes de "1.2". Se ordena en memoria
 * porque el catálogo por tenant es pequeño (unos cientos de prácticas).
 */
export function sortByPracticeCode<T extends { code: string }>(
  items: T[],
): T[] {
  const key = (code: string): number[] =>
    code.includes(".")
      ? code.split(".").map((n) => Number(n) || 0)
      : [Number(code) || 0];
  return [...items].sort((a, b) => {
    const [ka, kb] = [key(a.code), key(b.code)];
    for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
      const diff = (ka[i] ?? 0) - (kb[i] ?? 0);
      if (diff !== 0) {
        return diff;
      }
    }
    return 0;
  });
}
