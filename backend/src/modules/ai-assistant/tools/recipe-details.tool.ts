import { RecipesService } from "../../recipes/recipes.service";
import {
  resolveRecipeByName,
  ambiguousMatchPayload,
} from "./recipe-match.util";
import { ToolDefinition } from "./tool-definition.interface";

/**
 * "Muéstrame la receta X" — resuelve el nombre y devuelve SOLO el identificador
 * más un `action` open_recipe que el backend convierte en botón "Abrir receta".
 *
 * Decisión de producto: el chat NO reproduce el contenido de la receta
 * (ingredientes, cantidades, pasos); el usuario abre la ficha visual con el
 * botón. Si el nombre no resuelve a una única receta se pide desambiguación.
 */
export function createRecipeDetailsTool(
  recipesService: RecipesService,
): ToolDefinition {
  return {
    name: "get_recipe_details",
    description:
      "Localiza una receta por nombre para ofrecer al usuario un botón que abre su ficha. NO devuelve ingredientes, cantidades ni pasos: responde de forma breve (p. ej. «Aquí tienes la receta X») y deja que el usuario la abra con el botón. Para costes está get_recipe_cost.",
    parameters: {
      type: "object",
      properties: {
        recipeName: {
          type: "string",
          description: "Nombre (o parte del nombre) de la receta",
        },
      },
      required: ["recipeName"],
    },
    handler: async (tenantId, params) => {
      const resolution = await resolveRecipeByName(
        recipesService,
        tenantId,
        params.recipeName,
      );
      if (resolution.status === "not_found") {
        return { error: resolution.error };
      }
      if (resolution.status === "ambiguous") {
        return ambiguousMatchPayload(params.recipeName, resolution.matches);
      }
      return {
        recipeId: resolution.match.id,
        name: resolution.match.name,
        action: {
          type: "open_recipe",
          recipeId: resolution.match.id,
          label: "Abrir receta",
        },
      };
    },
  };
}
