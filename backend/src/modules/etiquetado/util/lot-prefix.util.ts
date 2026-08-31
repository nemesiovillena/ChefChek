/**
 * Deriva el prefijo del número de lote de un plato elaborado a partir del
 * nombre de la receta: mayúsculas, sin acentos, solo A-Z0-9, 3-4 caracteres
 * del primer token significativo. Fallback `ETIQ`.
 *
 * Ejemplos:
 *   "Jarrete de ternera"  -> "JARR"
 *   "Ñoquis"              -> "NOQU"
 *   "AA"                  -> "AA"   (no se rellena; el generador tolera <3)
 *   ""                    -> "ETIQ"
 */
export function deriveLotPrefix(recipeName: string): string {
  const normalized = (recipeName ?? "")
    .normalize("NFD")
    .replace(/[^\x20-\x7E]/g, "") // tras NFD: quita marcas combinantes y no-ASCII
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .trim();

  const firstToken = normalized.split(/\s+/).find((t) => t.length > 0);
  if (!firstToken) {
    return "ETIQ";
  }

  return firstToken.slice(0, 4);
}
