import { getReferencePrice } from "../../common/utils/unit-conversions";
import { measureToReferenceQuantity } from "../cuiner/cuiner-recipe-consumption";

/** Enlace de un plato de Cuiner con lo que consume (ver CuinerDishMap). */
export interface DishCostSource {
  noStock?: boolean | null;
  recipe?: { totalCost: number; portions: number } | null;
  product?: {
    purchasePrice: number;
    unitSize: number;
    referenceUnit: string;
    /** Peso (kg o L) de una pieza: puente para medidas en unidades. */
    avgUnitWeight?: number | null;
  } | null;
  measure?: { quantity: number; unit: string } | null;
}

/**
 * Coste teórico de vender una unidad del plato, o null si no se sabe:
 * - Receta: coste del escandallo / raciones (una venta = una ración).
 * - Artículo de venta directa (bebidas): precio de referencia × la medida de
 *   servicio en la unidad de referencia (caña 20 cl de un barril en L), o una
 *   unidad de referencia si no hay medida (botellín, lata).
 * - Plato contenedor marcado sin stock: 0 (su coste va en los modificadores).
 * Sin enlace, o receta sin coste calculado: null (no se inventa un 0).
 */
export function unitCostOfDish(src: DishCostSource): number | null {
  if (src.noStock) {
    return 0;
  }
  if (src.recipe) {
    const { totalCost, portions } = src.recipe;
    return totalCost > 0 && portions > 0 ? totalCost / portions : null;
  }
  if (src.product) {
    const { purchasePrice, unitSize, referenceUnit } = src.product;
    if (!(purchasePrice > 0)) {
      return null;
    }
    const perReferenceUnit = getReferencePrice(purchasePrice, unitSize);
    // Misma conversión que el descuento de stock: una medida que no se puede
    // pasar a la unidad del artículo deja el coste desconocido, nunca 1 kg.
    const quantity = src.measure
      ? measureToReferenceQuantity(src.measure, {
          referenceUnit,
          avgUnitWeight: src.product.avgUnitWeight ?? null,
        })
      : 1;
    return quantity === null ? null : perReferenceUnit * quantity;
  }
  return null;
}
