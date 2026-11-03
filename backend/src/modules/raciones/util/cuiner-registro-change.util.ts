import { PortionMovementType } from "@prisma/client";
import { portionsForSale, roundPortions } from "./portion-fifo.util";

/** Fila del historial del Contador de platos de Cuiner (es_registro). */
export interface CuinerRegistroRow {
  id: number;
  plato: string;
  operacion: string;
  unidades: number | null;
  cajero?: string | null;
  mesa?: string | null;
}

/** Terminal con el que ChefChek firma lo que escribe en Cuiner. */
export const CUINER_CHEFCHEK_CAJERO = "ChefChek";

/**
 * Qué supone en raciones una fila del historial de Cuiner. Salida = pedido
 * (unidades > 0), Borrado = anulación (unidades < 0), Stock = carga en Cuiner.
 * Las cargas de platos que Cuiner lleva por piezas con peso no se copian: se
 * cargan a mano en los dos sitios y la comparación avisa si no cuadran.
 */
export function cuinerRegistroChange(
  row: CuinerRegistroRow,
  dish: { portionsPerSale: number; perPiece: boolean },
): { delta: number; type: PortionMovementType; reason: string } | null {
  if (row.cajero === CUINER_CHEFCHEK_CAJERO || !row.unidades) {
    return null;
  }
  const where = [row.mesa ? `mesa ${row.mesa}` : null, row.cajero]
    .filter(Boolean)
    .join(" · ");
  if (row.operacion === "Salida" || row.operacion === "Borrado") {
    const delta = -portionsForSale(
      row.unidades,
      dish.portionsPerSale,
      dish.perPiece,
    );
    if (delta === 0) {
      return null;
    }
    const what = row.operacion === "Salida" ? "Pedido" : "Anulado";
    return {
      delta,
      type: PortionMovementType.ORDER,
      reason: where ? `${what} en Cuiner · ${where}` : `${what} en Cuiner`,
    };
  }
  if (row.operacion === "Stock" && !dish.perPiece) {
    const delta = roundPortions(row.unidades * dish.portionsPerSale);
    return delta === 0
      ? null
      : {
          delta,
          type: PortionMovementType.CUINER_LOAD,
          reason: where ? `Cargado en Cuiner · ${where}` : "Cargado en Cuiner",
        };
  }
  return null;
}
