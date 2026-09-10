/**
 * Nombres de los 14 alérgenos de declaración obligatoria (Reglamento UE
 * 1169/2011, Anexo II). Los ids coinciden con la numeración canónica UE y
 * con los catálogos internos (recetas, etiquetas, fichas técnicas).
 */
export const EU_ALLERGEN_NAMES: Record<number, string> = {
  1: "Gluten",
  2: "Crustáceos",
  3: "Huevos",
  4: "Pescado",
  5: "Cacahuetes",
  6: "Soja",
  7: "Leche",
  8: "Apio",
  9: "Mostaza",
  10: "Sésamo",
  11: "Sulfitos",
  12: "Altramuces",
  13: "Moluscos",
  14: "Frutos de Cáscara",
};

export function euAllergenName(id: number): string {
  return EU_ALLERGEN_NAMES[id] ?? `Alérgeno ${id}`;
}
