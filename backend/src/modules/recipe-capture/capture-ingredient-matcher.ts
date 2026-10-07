import { Injectable } from "@nestjs/common";
import { ProductsService } from "../products/products.service";

/**
 * Sugerencia de artículo para un ingrediente capturado.
 *
 * Los nombres de ingrediente son genéricos ("harina de trigo") y los de
 * artículo vienen del proveedor ("HARINA TRIGO T55 SACO 25KG"), así que no
 * sirve comparar cadenas completas: se mira qué parte de las palabras del
 * ingrediente aparece en el nombre del artículo.
 */

export interface IngredientMatch {
  productId: string;
  /** 0..1: fracción de las palabras del ingrediente halladas en el artículo. */
  confidence: number;
}

// Por debajo de la mitad de las palabras la sugerencia estorba más que ayuda.
const MIN_CONFIDENCE = 0.5;

const STOPWORDS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "con",
  "sin",
  "para",
  "por",
  "una",
  "uno",
  "unos",
  "unas",
  "tipo",
]);

/** Palabras significativas de un nombre: minúsculas, sin acentos, ≥ 3 letras. */
export function significantWords(name: string): string[] {
  return (name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9ñ]+/)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

// "tomate" debe encontrar "tomates" y al revés.
function sameWord(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return (
    short.length >= 4 &&
    long.startsWith(short) &&
    long.length - short.length <= 2
  );
}

/**
 * Fracción de las palabras del ingrediente presentes en el nombre del artículo.
 *
 * Es 0 si la primera palabra del artículo (lo que el artículo ES) no está en
 * el ingrediente: "agua" no debe sugerir "PAN BARRA DE AGUA". Una sugerencia
 * equivocada acaba en un coste y unos alérgenos erróneos, así que se prefiere
 * no sugerir a sugerir mal.
 */
export function scoreProduct(
  ingredientName: string,
  productName: string,
): number {
  const wanted = significantWords(ingredientName);
  const available = significantWords(productName);
  if (!wanted.length || !available.length) {
    return 0;
  }
  if (!wanted.some((word) => sameWord(word, available[0]))) {
    return 0;
  }
  const found = wanted.filter((word) =>
    available.some((candidate) => sameWord(word, candidate)),
  );
  return found.length / wanted.length;
}

@Injectable()
export class CaptureIngredientMatcher {
  constructor(private readonly productsService: ProductsService) {}

  async match(
    tenantId: string,
    ingredientName: string,
  ): Promise<IngredientMatch | null> {
    if (!significantWords(ingredientName).length) {
      return null;
    }
    // Ya devuelve artículos del tenant no borrados, ordenados por número de
    // palabras coincidentes y, a igualdad, por nombre más corto.
    const candidates = await this.productsService.searchByNameLoose(
      tenantId,
      ingredientName,
    );

    let best: IngredientMatch | null = null;
    for (const candidate of candidates) {
      const confidence = scoreProduct(ingredientName, candidate.name);
      if (
        confidence >= MIN_CONFIDENCE &&
        (!best || confidence > best.confidence)
      ) {
        best = { productId: candidate.id, confidence };
      }
    }
    return best;
  }
}
