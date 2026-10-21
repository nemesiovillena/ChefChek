import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateCaptureIngredientDto } from "./update-capture-ingredient.dto";

describe("UpdateCaptureIngredientDto", () => {
  const errorsFor = (quantity: number) =>
    validate(plainToInstance(UpdateCaptureIngredientDto, { quantity }));

  it("acepta cantidades con muchos decimales (pesos calculados)", async () => {
    expect(await errorsFor(14.90585774058579)).toHaveLength(0);
  });

  it("sigue rechazando cantidades cero o negativas", async () => {
    expect(await errorsFor(0)).not.toHaveLength(0);
    expect(await errorsFor(-1)).not.toHaveLength(0);
  });
});
