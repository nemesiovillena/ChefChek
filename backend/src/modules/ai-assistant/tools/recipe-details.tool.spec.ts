import { createRecipeDetailsTool } from "./recipe-details.tool";
import { RecipesService } from "../../recipes/recipes.service";

/** Receta de prueba con el shape que devuelve findOne(includeCost=false). */
function recipeFixture(overrides: Record<string, any> = {}) {
  return {
    id: "rec-1",
    name: "Caramelo",
    description: "Caramelo casero",
    elaboration: JSON.stringify({
      steps: [
        { description: "Disolver el azúcar a fuego medio" },
        { description: "Añadir la mantequilla" },
      ],
    }),
    portions: 40,
    portionSize: null,
    totalYieldWeight: 1200,
    ingredients: [
      {
        productId: "p1",
        productName: "Azúcar",
        quantity: 1,
        unit: "kilo",
      },
      {
        productId: "p2",
        productName: "Mantequilla",
        quantity: 200,
        unit: "gramo",
      },
    ],
    subRecipes: [
      {
        subRecipeId: "sr1",
        subRecipeName: "Fondo",
        quantity: 100,
        unit: "gramo",
      },
    ],
    categories: [{ categoryId: "c1", categoryName: "Postres" }],
    ...overrides,
  };
}

describe("get_recipe_details tool", () => {
  const build = (findNameMatches: any, findOne?: any) => {
    const recipesMock = {
      findNameMatches: jest.fn().mockResolvedValue(findNameMatches),
      findOne: findOne ?? jest.fn().mockResolvedValue(recipeFixture()),
    } as unknown as RecipesService;
    return { tool: createRecipeDetailsTool(recipesMock), recipesMock };
  };

  it("devuelve contenido sin costes más acción open_recipe cuando el nombre resuelve único", async () => {
    const { tool } = build([{ id: "rec-1", name: "Caramelo", isActive: true }]);
    const result: any = await tool.handler("t1", { recipeName: "caramelo" });

    expect(result.recipeId).toBe("rec-1");
    expect(result.portions).toBe(40);
    expect(result.ingredients).toEqual([
      { name: "Azúcar", quantity: 1, unit: "kilo" },
      { name: "Mantequilla", quantity: 200, unit: "gramo" },
    ]);
    expect(result.subRecipes).toEqual([
      { name: "Fondo", quantity: 100, unit: "gramo" },
    ]);
    expect(result.elaborationSteps).toEqual([
      "Disolver el azúcar a fuego medio",
      "Añadir la mantequilla",
    ]);
    expect(result.categories).toEqual(["Postres"]);
    // Sin cifras de coste: la tool es de contenido, el coste vive en get_recipe_cost
    expect(result).not.toHaveProperty("totalCost");
    expect(result).not.toHaveProperty("pricing");
    expect(result.action).toEqual({
      type: "open_recipe",
      recipeId: "rec-1",
      label: "Abrir receta",
    });
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

  it("cae a texto plano cuando elaboration no es JSON estructurado", async () => {
    const { tool } = build(
      [{ id: "rec-1", name: "Caramelo", isActive: true }],
      jest
        .fn()
        .mockResolvedValue(
          recipeFixture({ elaboration: "Paso uno.\nPaso dos." }),
        ),
    );
    const result: any = await tool.handler("t1", { recipeName: "caramelo" });
    expect(result.elaborationSteps).toEqual(["Paso uno.", "Paso dos."]);
  });
});
