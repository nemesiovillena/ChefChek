import {
  calculateSimilarity,
  normalizeProductDescription,
} from "../../common/utils/string-similarity";

const STOPWORDS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "con",
  "sin",
]);

/**
 * Palabras de la consulta que describen el artículo. Se descartan las de
 * formato de compra («260g», «c/24u», «6x1») y las vacías: el nombre de un
 * artículo en ChefChek suele venir del albarán del proveedor y lleva un
 * formato que la descripción de Cuiner no tiene.
 */
function significantWords(normalizedQuery: string): string[] {
  const words = normalizedQuery.split(" ").filter(Boolean);
  const significant = words.filter(
    (w) => w.length >= 3 && !/\d/.test(w) && !STOPWORDS.has(w),
  );
  return significant.length > 0 ? significant : words;
}

/**
 * Ordena los artículos del catálogo de Cuiner por lo bien que casan con la
 * consulta: primero los que coinciden por código, después los que contienen
 * más palabras de la consulta y, a igualdad, los de nombre más parecido.
 * Compara sin tildes ni puntuación. Un artículo que no comparte ninguna
 * palabra ni el código queda fuera.
 */
export function rankCuinerArticles<
  T extends { codigo: string; descripcion: string },
>(query: string, articles: T[], limit: number): T[] {
  const term = query.trim();
  const normalizedQuery = normalizeProductDescription(term);
  if (!term) {
    return [];
  }
  const words = significantWords(normalizedQuery);

  return articles
    .map((article) => {
      const description = normalizeProductDescription(article.descripcion);
      return {
        article,
        byCode: article.codigo.includes(term),
        words: words.filter((w) => description.includes(w)).length,
        similarity: calculateSimilarity(normalizedQuery, description),
      };
    })
    .filter((r) => r.byCode || r.words > 0)
    .sort(
      (a, b) =>
        Number(b.byCode) - Number(a.byCode) ||
        b.words - a.words ||
        b.similarity - a.similarity ||
        a.article.descripcion.localeCompare(b.article.descripcion, "es"),
    )
    .slice(0, limit)
    .map((r) => r.article);
}
