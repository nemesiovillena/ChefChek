import type { FoodLabel, FoodLabelIngredientLot, Lot } from "@prisma/client";

/** Etiqueta + relaciones necesarias para generar cualquier salida imprimible (PDF o ZPL). */
export type FoodLabelForPrint = FoodLabel & {
  ingredientLots: FoodLabelIngredientLot[];
  sourceLot:
    | (Pick<Lot, "lotNumber"> & { supplier: { name: string } | null })
    | null;
};
