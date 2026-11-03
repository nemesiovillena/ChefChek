/**
 * Nombres de artículo que llegan enteros en mayúsculas (sobre todo leídos de
 * albaranes: «TOMATE PERA EXITO 1KG») se guardan como una frase: primera letra
 * en mayúscula y el resto en minúsculas («Tomate pera exito 1kg»). Un nombre
 * que ya mezcla mayúsculas y minúsculas se respeta tal cual: lo ha escrito o
 * corregido una persona.
 *
 * Misma regla que la migración que convirtió los nombres existentes
 * (prisma/migrations/20261103170000_product_names_sentence_case).
 */
export function normalizeProductNameCase(name: string): string {
  const trimmed = name.trim();
  const hasLetters =
    trimmed.toLocaleLowerCase("es") !== trimmed.toLocaleUpperCase("es");
  const isAllCaps = hasLetters && trimmed === trimmed.toLocaleUpperCase("es");
  if (!isAllCaps) {
    return trimmed;
  }
  const lower = trimmed.toLocaleLowerCase("es");
  return lower.charAt(0).toLocaleUpperCase("es") + lower.slice(1);
}
