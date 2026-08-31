import { RecipesService } from "../../recipes/recipes.service";
import {
  resolveRecipeByName,
  ambiguousMatchPayload,
} from "./recipe-match.util";
import { ToolDefinition } from "./tool-definition.interface";

/**
 * Espejo minimalista del parseSteps del frontend
 * (recipes/components/elaboration-step-editor.tsx): admite el formato
 * estructurado {steps:[{description,...}]}, el legacy TipTap JSON y texto
 * plano. Devuelve solo las descripciones — el detalle (equipo/tiempo/temp)
 * se ve en la ficha.
 */
function parseElaborationSteps(
  elaboration: string | null | undefined,
): string[] {
  if (!elaboration?.trim()) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(elaboration);
  } catch {
    return elaboration
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray((parsed as { steps?: unknown })?.steps)) {
    return (parsed as { steps: Array<Record<string, unknown>> }).steps
      .map((s) =>
        typeof s.description === "string" ? s.description.trim() : "",
      )
      .filter(Boolean);
  }
  if (
    (parsed as { type?: string })?.type === "doc" &&
    Array.isArray((parsed as { content?: unknown[] })?.content)
  ) {
    const texts: string[] = [];
    const extract = (node: unknown) => {
      if (!node || typeof node !== "object") {
        return;
      }
      const n = node as { text?: unknown; content?: unknown[] };
      if (typeof n.text === "string" && n.text.trim()) {
        texts.push(n.text.trim());
      }
      n.content?.forEach(extract);
    };
    (parsed as { content: unknown[] }).content.forEach(extract);
    return texts;
  }
  return [];
}

/**
 * "Muéstrame la receta X" — contenido SIN costes: raciones, ingredientes con
 * cantidades, sub-recetas y pasos de elaboración. El resultado incluye un
 * `action` open_recipe que el backend convierte en botón de navegación a la
 * vista visual de la ficha.
 */
export function createRecipeDetailsTool(
  recipesService: RecipesService,
): ToolDefinition {
  return {
    name: "get_recipe_details",
    description:
      "Contenido de una receta buscada por nombre: raciones, ingredientes con cantidades, sub-recetas y pasos de elaboración. NO incluye costes ni precios (para eso está get_recipe_cost).",
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
      // includeCost=false: la tool es de contenido; el coste vive en
      // get_recipe_cost, que sí está sujeto al permiso recipes.cost.
      const recipe = await recipesService.findOne(
        tenantId,
        resolution.match.id,
        false,
      );
      return {
        recipeId: recipe.id,
        name: recipe.name,
        description: recipe.description || undefined,
        portions: recipe.portions,
        portionSize: recipe.portionSize ?? undefined,
        totalYieldWeight: recipe.totalYieldWeight ?? undefined,
        categories:
          recipe.categories?.map((c) => c.categoryName).filter(Boolean) ?? [],
        ingredients: recipe.ingredients.map((i) => ({
          name: i.productName ?? `(artículo ${i.productId})`,
          quantity: i.quantity,
          unit: i.unit,
        })),
        subRecipes:
          recipe.subRecipes?.map((s) => ({
            name: s.subRecipeName,
            quantity: s.quantity,
            unit: s.unit,
          })) ?? [],
        elaborationSteps: parseElaborationSteps(recipe.elaboration),
        action: {
          type: "open_recipe",
          recipeId: recipe.id,
          label: "Abrir receta",
        },
      };
    },
  };
}
