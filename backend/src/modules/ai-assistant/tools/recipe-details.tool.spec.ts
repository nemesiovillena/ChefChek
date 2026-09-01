import { createRecipeDetailsTool } from "./recipe-details.tool";
import { RecipesService } from "../../recipes/recipes.service";

describe("get_recipe_details tool", () => {
  const build = (findNameMatches: any) => {
    const recipesMock = {
      findNameMatches: jest.fn().mockResolvedValue(findNameMatches),
    } as unknown as RecipesService;
    return { tool: createRecipeDetailsTool(recipesMock), recipesMock };
  };

  it("devuelve solo id, nombre y acción open_recipe cuando el nombre resuelve único", async () => {
    const { tool } = build([{ id: "rec-1", name: "Caramelo", isActive: true }]);
    const result: any = await tool.handler("t1", { recipeName: "caramelo" });

    expect(result).toEqual({
      recipeId: "rec-1",
      name: "Caramelo",
      action: { type: "open_recipe", recipeId: "rec-1", label: "Abrir receta" },
    });
    // El chat no reproduce el contenido de la receta.
    expect(result).not.toHaveProperty("ingredients");
    expect(result).not.toHaveProperty("elaborationSteps");
    expect(result).not.toHaveProperty("portions");
  });

  it("no llama a findOne — no necesita cargar el contenido de la receta", async () => {
    const { tool, recipesMock } = build([
      { id: "rec-1", name: "Caramelo", isActive: true },
    ]);
    await tool.handler("t1", { recipeName: "caramelo" });
    expect((recipesMock as any).findOne).toBeUndefined();
  });

  it("pide desambiguación cuando hay varias coincidencias, sin tomar la primera", async () => {
    const { tool } = build([
      { id: "rec-1", name: "Caramelo salado", isActive: true },
      { id: "rec-2", name: "Caramelo de nata", isActive: true },
    ]);
    const result: any = await tool.handler("t1", { recipeName: "caramelo" });

    expect(result.ambiguous).toBe(true);
    expect(result.matches).toHaveLength(2);
    expect(result).not.toHaveProperty("recipeId");
    expect(result).not.toHaveProperty("action");
  });

  it("devuelve error legible cuando no hay coincidencias", async () => {
    const { tool } = build([]);
    const result: any = await tool.handler("t1", { recipeName: "inexistente" });
    expect(result.error).toContain("inexistente");
  });
});
