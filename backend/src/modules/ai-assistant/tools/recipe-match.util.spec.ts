import { resolveRecipeByName } from "./recipe-match.util";
import type { RecipesService } from "../../recipes/recipes.service";

describe("resolveRecipeByName", () => {
  const matches = [
    { id: "r-cafe", name: "Café cortado", isActive: true, isDrink: true },
    { id: "r-tira", name: "Tiramisú de café", isActive: true, isDrink: false },
  ];
  const recipesService = {
    findNameMatches: jest.fn().mockResolvedValue(matches),
  } as unknown as RecipesService;

  it("con permiso de bebidas ofrece comida y bebida", async () => {
    const res = await resolveRecipeByName(recipesService, "t1", "café", true);
    expect(res.status).toBe("ambiguous");
  });

  it("sin permiso de bebidas las bebidas no existen", async () => {
    const res = await resolveRecipeByName(recipesService, "t1", "café", false);
    expect(res).toEqual({
      status: "unique",
      match: { id: "r-tira", name: "Tiramisú de café" },
    });
  });
});
