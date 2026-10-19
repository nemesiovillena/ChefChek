import { normalizeProductDescription } from "../../common/utils/string-similarity";
import { getUnitMeta } from "../../common/utils/product-costing.util";

/**
 * Enlace masivo de platos «MARCA + MEDIDA» del TPV (BARCELO CHUPITO,
 * BARCELO PIEDRA…): se quita del nombre la palabra de la medida, se agrupan
 * los platos por la marca que queda y se propone el artículo de ChefChek
 * cuyo nombre contiene esa marca. Funciones puras; el servicio carga datos.
 */

export interface BulkDish {
  tipo: string;
  producto: string;
  nombre: string;
  sold: number;
}

export interface BulkProduct {
  id: string;
  name: string;
  referenceUnit: string;
  categoryName: string | null;
  avgUnitWeight?: number | null;
}

export interface BulkGroup {
  brand: string;
  dishes: BulkDish[];
  sold: number;
  suggestedProduct: BulkProduct | null;
  /** Todas las palabras de la marca están en el artículo propuesto. */
  exactMatch: boolean;
}

const SPACE = " ";

/** Palabras clave normalizadas (minúsculas, sin tildes), las largas primero. */
export function normalizeKeywords(keywords: string[]): string[] {
  const unique = new Set(
    keywords.map((k) => normalizeProductDescription(k)).filter(Boolean),
  );
  return [...unique].sort((a, b) => b.length - a.length);
}

/**
 * Marca del plato: su nombre sin las palabras de medida. Devuelve null si el
 * nombre no lleva ninguna (no es un plato de bebida servida por medida).
 * «BARCELO CHUPITO» → «barcelo»; «CAÑA» → «» (solo medida, sin marca).
 */
export function extractBrand(
  dishName: string,
  keywords: string[],
): string | null {
  let padded = `${SPACE}${normalizeProductDescription(dishName)}${SPACE}`;
  let found = false;
  for (const keyword of keywords) {
    const needle = `${SPACE}${keyword}${SPACE}`;
    while (padded.includes(needle)) {
      padded = padded.replace(needle, SPACE);
      found = true;
    }
  }
  return found ? padded.trim() : null;
}

const STOPWORDS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "con",
  "sin",
  "y",
]);

/** Palabras que identifican la marca: fuera vacías y letras sueltas. */
function brandWords(brand: string): string[] {
  return brand.split(SPACE).filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

/** ¿La palabra está en el nombre? Entera, o pegada al principio de otra si es larga («ballantines» en «ballantine s»). */
function nameHasWord(paddedName: string, word: string): boolean {
  if (paddedName.includes(` ${word} `)) {
    return true;
  }
  if (word.length < 6) {
    return false;
  }
  const words = paddedName.trim().split(SPACE);
  return words.some((_, i) => words.slice(i).join("").startsWith(word));
}

/**
 * Artículo cuyo nombre contiene más palabras de la marca; a igualdad, el de
 * nombre más corto (menos ruido). Solo artículos que se cuentan en volumen o
 * peso: una medida en cl no tiene sentido sobre un artículo en unidades.
 */
export function suggestProduct(
  brand: string,
  products: BulkProduct[],
): { product: BulkProduct; exactMatch: boolean } | null {
  const words = brandWords(brand);
  // Los números («12», «10») afinan, pero solos no identifican una marca.
  const named = words.filter((w) => !/^\d+$/.test(w));
  if (named.length === 0) {
    return null;
  }
  let best: { product: BulkProduct; hits: number; length: number } | null =
    null;
  for (const product of products) {
    const name = ` ${normalizeProductDescription(product.name)} `;
    if (!named.some((w) => nameHasWord(name, w))) {
      continue;
    }
    const hits = words.filter((w) => nameHasWord(name, w)).length;
    if (
      !best ||
      hits > best.hits ||
      (hits === best.hits && product.name.length < best.length)
    ) {
      best = { product, hits, length: product.name.length };
    }
  }
  if (!best) {
    return null;
  }
  const exactMatch = best.hits === words.length;
  // Coincidencia parcial con una sola palabra es casi siempre ruido
  // («ORUJO CREMA» → «queso crema»): no se propone.
  if (!exactMatch && best.hits < 2) {
    return null;
  }
  return { product: best.product, exactMatch };
}

type UnitCategory = "peso" | "volumen" | "unidad";

const unitCategoryOf = (unit: string): UnitCategory | null =>
  getUnitMeta(unit)?.category ?? null;

/** Medida tal como la necesita la agrupación: sus palabras y su unidad. */
export interface BulkMeasure {
  keywords: string[];
  unit: string;
}

/**
 * Unidad en que debe contarse el artículo de un plato según sus palabras de
 * medida: CHUPITO (cl) pide un artículo en volumen, CAFE (g) uno en peso.
 */
function dishUnitCategory(
  dishName: string,
  measures: { keywords: string[]; category: UnitCategory | null }[],
): UnitCategory | null {
  let best: { length: number; category: UnitCategory | null } | null = null;
  for (const measure of measures) {
    for (const keyword of measure.keywords) {
      if (
        extractBrand(dishName, [keyword]) !== null &&
        (!best || keyword.length > best.length)
      ) {
        best = { length: keyword.length, category: measure.category };
      }
    }
  }
  return best?.category ?? null;
}

/**
 * Agrupa por marca los platos que llevan palabra de medida. Los que solo
 * son medida («CAÑA», «CAFE CORTADO») van cada uno en su grupo, sin artículo
 * propuesto: la marca no dice de qué barril o paquete sale. El artículo
 * propuesto se cuenta en la misma magnitud que la medida (cl → litros).
 */
export function groupDishesByBrand(
  dishes: BulkDish[],
  measures: BulkMeasure[],
  products: BulkProduct[],
): BulkGroup[] {
  const keywords = normalizeKeywords(measures.flatMap((m) => m.keywords));
  const measureCategories = measures.map((m) => ({
    keywords: normalizeKeywords(m.keywords),
    category: unitCategoryOf(m.unit),
  }));
  const groups = new Map<string, BulkDish[]>();
  for (const dish of dishes) {
    const brand = extractBrand(dish.nombre, keywords);
    if (brand === null) {
      continue;
    }
    const key = brand || `#${dish.nombre}`;
    groups.set(key, [...(groups.get(key) ?? []), dish]);
  }
  return [...groups.entries()]
    .map(([key, groupDishes]) => {
      const brand = key.startsWith("#") ? "" : key;
      const category = dishUnitCategory(
        groupDishes[0].nombre,
        measureCategories,
      );
      const candidates = products.filter(
        (p) => category && unitCategoryOf(p.referenceUnit) === category,
      );
      const suggestion = brand ? suggestProduct(brand, candidates) : null;
      return {
        brand: brand ? brand.toUpperCase() : groupDishes[0].nombre,
        dishes: groupDishes.sort((a, b) => b.sold - a.sold),
        sold: groupDishes.reduce((sum, d) => sum + d.sold, 0),
        suggestedProduct: suggestion?.product ?? null,
        exactMatch: suggestion?.exactMatch ?? false,
      };
    })
    .sort((a, b) => b.sold - a.sold || a.brand.localeCompare(b.brand, "es"));
}
