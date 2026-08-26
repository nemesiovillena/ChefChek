import { RecipesService } from "../../recipes/recipes.service";
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
      const matches = await recipesService.findNameMatches(
        tenantId,
        params.recipeName,
      );
      if (matches.length === 0) {
        return {
          error: `No encuentro ninguna receta llamada "${params.recipeName}".`,
        };
      }
      const cost = await recipesService.calculateRecipeCost(
        tenantId,
        matches[0].id,
      );
      return {
        recipeName: matches[0].name,
        totalCost: cost.totalCost,
        costPerPortion: cost.costPerPortion,
        pricing: cost.pricing,
      };
    },
  };
}
