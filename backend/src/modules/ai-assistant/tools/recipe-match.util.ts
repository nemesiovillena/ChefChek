import { RecipesService } from "../../recipes/recipes.service";

export interface RecipeNameMatch {
  id: string;
  name: string;
}

/** Resultado de resolver un nombre fuzzy contra el catálogo de recetas del tenant. */
export type RecipeNameResolution =
  | { status: "not_found"; error: string }
  | { status: "ambiguous"; matches: RecipeNameMatch[] }
  | { status: "unique"; match: RecipeNameMatch };

/** Máximo de nombres que se devuelven al LLM cuando el match es ambiguo. */
const MAX_AMBIGUOUS_MATCHES = 8;

/**
 * Resuelve "caramelo" → una receta concreta. Compartido por las tools de
 * recetas del asistente: cuando findNameMatches devuelve más de una, NO se
 * toma la primera en silencio — se devuelve la lista para que el modelo
 * pregunte al usuario cuál quería.
 */
export async function resolveRecipeByName(
  recipesService: RecipesService,
  tenantId: string,
  recipeName: string,
): Promise<RecipeNameResolution> {
  const matches = await recipesService.findNameMatches(tenantId, recipeName);
  if (matches.length === 0) {
    return {
      status: "not_found",
      error: `No encuentro ninguna receta llamada "${recipeName}".`,
    };
  }
  if (matches.length > 1) {
    return {
      status: "ambiguous",
      matches: matches
        .slice(0, MAX_AMBIGUOUS_MATCHES)
        .map(({ id, name }) => ({ id, name })),
    };
  }
  return {
    status: "unique",
    match: { id: matches[0].id, name: matches[0].name },
  };
}

/**
 * Payload estándar que las tools devuelven al LLM cuando el nombre no resuelve
 * a una receta única: el modelo debe pedir al usuario que elija.
 */
export function ambiguousMatchPayload(
  recipeName: string,
  matches: RecipeNameMatch[],
) {
  return {
    ambiguous: true,
    message: `Hay varias recetas que coinciden con "${recipeName}". Pregunta al usuario cuál de estas quiere:`,
    matches,
  };
}
