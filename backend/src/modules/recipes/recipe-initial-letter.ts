/**
 * Filtro del listado de recetas por primera letra (abecedario táctil del
 * monitor de cocina). Abecedario español: A–Z más Ñ, que es letra propia
 * (la N no incluye «Ñoquis»). Las vocales con tilde cuentan como su vocal
 * («Ácido» sale en la A).
 */
export const RECIPE_INITIAL_LETTERS = [
  ..."ABCDEFGHIJKLMN",
  "Ñ",
  ..."OPQRSTUVWXYZ",
] as const;

export type RecipeInitialLetter = (typeof RECIPE_INITIAL_LETTERS)[number];

const ACCENTED_VARIANTS: Record<string, string[]> = {
  A: ["Á", "À"],
  E: ["É", "È"],
  I: ["Í", "Ì"],
  O: ["Ó", "Ò"],
  U: ["Ú", "Ù", "Ü"],
};

/** Condición Prisma `where` para los nombres que empiezan por `letter`. */
export function recipeNameStartsWithWhere(letter: string) {
  const prefixes = [letter, ...(ACCENTED_VARIANTS[letter] ?? [])];
  return {
    OR: prefixes.map((prefix) => ({
      name: { startsWith: prefix, mode: "insensitive" as const },
    })),
  };
}

/** Letra del abecedario por la que empieza `name`, o null (número/símbolo). */
export function recipeInitialLetter(name: string): RecipeInitialLetter | null {
  const first = name.trimStart().charAt(0).toUpperCase();
  if (first === "Ñ") {
    return "Ñ";
  }
  // NFD separa la tilde de la vocal: «Á» → «A» + acento combinable.
  const base = first.normalize("NFD").charAt(0);
  return (RECIPE_INITIAL_LETTERS as readonly string[]).includes(base)
    ? (base as RecipeInitialLetter)
    : null;
}
