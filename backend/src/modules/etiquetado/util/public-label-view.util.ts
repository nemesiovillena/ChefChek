import type { FoodLabel, FoodLabelIngredientLot, Lot } from "@prisma/client";

type FoodLabelWithRelations = FoodLabel & {
  ingredientLots: FoodLabelIngredientLot[];
  recipe: { id: string; name: string } | null;
  product: { id: string; name: string } | null;
  sourceLot:
    | (Pick<Lot, "id" | "lotNumber" | "receivedAt" | "expiryDate"> & {
        supplier: { name: string } | null;
      })
    | null;
};

/**
 * Iniciales del nombre del responsable para la ficha pública (sin login).
 * "Ana López" -> "A. L." · "" -> "—".
 */
export function toInitials(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) {
    return "—";
  }
  return parts.map((p) => `${p[0].toUpperCase()}.`).join(" ");
}

/**
 * Proyección pública de una etiqueta: ficha completa de trazabilidad SIN el
 * nombre completo del responsable (solo iniciales). Se sirve por `qrToken` sin
 * autenticación.
 */
export function toPublicLabelView(label: FoodLabelWithRelations) {
  return {
    lotNumber: label.lotNumber,
    labelType: label.labelType,
    itemName: label.itemName,
    preparedAt: label.preparedAt,
    useByDate: label.useByDate,
    manufacturerExpiryDate: label.manufacturerExpiryDate,
    frozenAt: label.frozenAt,
    frozenUseByDate: label.frozenUseByDate,
    storageCondition: label.storageCondition,
    storageTempMin: label.storageTempMin,
    storageTempMax: label.storageTempMax,
    shelfLifeDaysApplied: label.shelfLifeDaysApplied,
    quantity: label.quantity,
    quantityUnit: label.quantityUnit,
    portions: label.portions,
    allergens: label.allergens,
    // `notes` es texto libre del operario: no se expone en la ficha pública sin
    // login (sí se ve en el detalle interno autenticado y en el PDF impreso).
    responsibleInitials: toInitials(label.createdByName),
    voidedAt: label.voidedAt,
    supplier: label.sourceLot?.supplier?.name ?? null,
    sourceLotNumber: label.sourceLot?.lotNumber ?? null,
    ingredientLots: label.ingredientLots.map((il) => ({
      productName: il.productName,
      lotNumber: il.lotNumber,
    })),
  };
}
