import { RecipesService } from "../../recipes/recipes.service";
import {
  resolveRecipeByName,
  ambiguousMatchPayload,
} from "./recipe-match.util";
import { ToolDefinition } from "./tool-definition.interface";

/** "¿Cuánto me cuesta la receta X?" — resuelve por nombre (fuzzy) y envuelve calculateRecipeCost. */
export function createRecipeCostTool(
  recipesService: RecipesService,
): ToolDefinition {
  return {
    name: "get_recipe_cost",
    description:
      "Coste de una receta (total y por ración/porción), buscada por nombre.",
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
      const cost = await recipesService.calculateRecipeCost(
        tenantId,
        resolution.match.id,
      );
      return {
        recipeName: resolution.match.name,
        totalCost: cost.totalCost,
        costPerPortion: cost.costPerPortion,
        pricing: cost.pricing,
      };
    },
  };
}
